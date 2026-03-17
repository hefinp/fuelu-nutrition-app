import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import passport from "passport";

import authRouter from "./routes/auth";
import calculationsRouter from "./routes/calculations";
import mealPlansRouter from "./routes/meal-plans";
import weightRouter from "./routes/weight";
import cycleRouter from "./routes/cycle";
import hydrationRouter from "./routes/hydration";
import foodLogRouter from "./routes/food-log";
import recipesRouter from "./routes/recipes";
import myFoodsRouter from "./routes/my-foods";
import communityRouter from "./routes/community";
import adminRouter from "./routes/admin";
import insightsRouter from "./routes/insights";
import testSetupRouter from "./routes/test-setup";
import mealIngredientsRouter from "./routes/meal-ingredients";
import userMealsRouter from "./routes/user-meals";
import mealTemplatesRouter from "./routes/meal-templates";
import stripeRouter from "./routes/stripe";
import vitalityRouter from "./routes/vitality";
import nutritionistRouter from "./routes/nutritionist";
import practiceRouter from "./routes/practice";
import monitoringRouter from "./routes/monitoring";

function setupPassportStrategies() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appleClientId = process.env.APPLE_CLIENT_ID;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const appleKeyId = process.env.APPLE_KEY_ID;
  const applePrivateKey = process.env.APPLE_PRIVATE_KEY;

  if (googleClientId && googleClientSecret) {
    const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
    passport.use(new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: "/api/auth/google/callback",
        scope: ["profile", "email"],
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: Function) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName || profile.emails?.[0]?.value || "Google User";
          if (!email) return done(new Error("No email returned from Google"));

          if (process.env.INVITE_CODES) {
            const existing = await storage.getUserByEmail(email);
            if (!existing) {
              return done(null, { pendingOAuth: true, email, name, provider: "google", providerId: profile.id });
            }
          }

          const user = await storage.findOrCreateOAuthUser({
            email,
            name,
            provider: "google",
            providerId: profile.id,
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ));
  }

  if (appleClientId && appleTeamId && appleKeyId && applePrivateKey) {
    const AppleStrategy = require("passport-apple");
    passport.use(new AppleStrategy(
      {
        clientID: appleClientId,
        teamID: appleTeamId,
        keyID: appleKeyId,
        privateKeyString: applePrivateKey.replace(/\\n/g, "\n"),
        callbackURL: "/api/auth/apple/callback",
        scope: ["name", "email"],
        passReqToCallback: false,
      },
      async (_accessToken: string, _refreshToken: string, idToken: any, profile: any, done: Function) => {
        try {
          const email = idToken?.email || profile?.email;
          const firstName = profile?.name?.firstName || "";
          const lastName = profile?.name?.lastName || "";
          const name = [firstName, lastName].filter(Boolean).join(" ") || email || "Apple User";
          const sub = idToken?.sub || profile?.id;
          if (!email || !sub) return done(new Error("Insufficient data from Apple"));
          const user = await storage.findOrCreateOAuthUser({
            email,
            name,
            provider: "apple",
            providerId: sub,
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ));
  }

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });
}

setupPassportStrategies();

export { passport };

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(authRouter);
  app.use(calculationsRouter);
  app.use(mealPlansRouter);
  app.use(weightRouter);
  app.use(cycleRouter);
  app.use(hydrationRouter);
  app.use(foodLogRouter);
  app.use(recipesRouter);
  app.use(myFoodsRouter);
  app.use(communityRouter);
  app.use(adminRouter);
  app.use(insightsRouter);
  app.use(mealIngredientsRouter);
  app.use(userMealsRouter);
  app.use(mealTemplatesRouter);
  app.use(stripeRouter);
  app.use(vitalityRouter);
  app.use(nutritionistRouter);
  app.use(practiceRouter);
  app.use(monitoringRouter);
  if (process.env.NODE_ENV !== "production") {
    app.use(testSetupRouter);
  }

  return httpServer;
}
