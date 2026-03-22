import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import path from "path";
import { registerRoutes, passport } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";
import { runMigrations } from "./migrate";

const PgSession = connectPgSimple(session);

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
    pendingOAuth?: {
      email: string;
      name: string;
      provider: string;
      providerId: string;
    };
    stravaOAuthState?: string;
  }
}

const sessionSecret = process.env.SESSION_SECRET || "fuelu-fallback-secret";
if (!process.env.SESSION_SECRET) {
  console.warn("[security] SESSION_SECRET env var is not set — using insecure fallback. Set this before deploying.");
}

const isDev = process.env.NODE_ENV !== "production";

// Security headers — in dev, relax frame/CORS headers so Replit preview can embed the app
app.use(
  helmet({
    contentSecurityPolicy: isDev
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://pagead2.googlesyndication.com",
              "https://tpc.googlesyndication.com",
              "https://www.googletagservices.com",
              "https://adservice.google.com",
              "https://www.google.com",
              "https://www.gstatic.com",
            ],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
              "'self'",
              "https://pagead2.googlesyndication.com",
              "https://adservice.google.com",
              "https://www.google.com",
            ],
            frameSrc: [
              "'self'",
              "https://googleads.g.doubleclick.net",
              "https://tpc.googlesyndication.com",
            ],
          },
        },
    crossOriginEmbedderPolicy: false,
    // In dev: allow Replit's canvas/preview iframe to embed the app from a different origin
    frameguard: isDev ? false : { action: "sameorigin" },
    crossOriginResourcePolicy: isDev ? false : { policy: "same-origin" },
    crossOriginOpenerPolicy: isDev ? false : { policy: "same-origin" },
  })
);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// NOTE: /uploads/client-documents is NOT served statically - documents are served only
// through authenticated API endpoints to enforce access control

app.use(
  session({
    store: new PgSession({ pool, tableName: "session" }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  })
);

app.use(passport.initialize());

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await runMigrations();

  const { storage } = await import("./storage");
  storage.cleanupBadCanonicalFoods()
    .then(() => {
      console.log("[init] Canonical food cleanup complete");
      return storage.fixCommunityMealIngredients();
    })
    .then(() => console.log("[init] Community meal ingredient fix complete"))
    .catch(err => console.error("[init] Canonical/community cleanup failed:", err));

  await registerRoutes(httpServer, app);

  const { registerStravaWebhook } = await import("./routes/strava");
  registerStravaWebhook().catch(err =>
    console.error("[init] Strava webhook registration failed:", err)
  );

  const { runReengagementWorker } = await import("./reengagement-worker");
  runReengagementWorker().catch(err =>
    console.error("[init] Re-engagement worker failed to start:", err)
  );

  storage.upsertFeatureGate("strava_activity_level", "advanced", 0, "Strava-derived activity level in calculator").catch(err =>
    console.error("[init] Failed to seed strava_activity_level feature gate:", err)
  );

  // Run the survey milestone job on startup and then every 24 hours
  const { runSurveyMilestoneJob } = await import("./lib/survey-milestone-job");
  runSurveyMilestoneJob().catch(err => console.error("[surveys] Initial milestone job failed:", err));
  setInterval(() => {
    runSurveyMilestoneJob().catch(err => console.error("[surveys] Milestone job failed:", err));
  }, 24 * 60 * 60 * 1000);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "::",
      reusePort: true,
      ipv6Only: false,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
