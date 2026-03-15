import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import passport from "passport";
import { storage } from "../storage";
import { registerSchema, loginSchema, type UserPreferences } from "@shared/schema";
import { authRateLimiter } from "../constants";
import { sendEmail, buildPasswordResetEmailHtml } from "../email";

const router = Router();

router.get("/api/auth/invite-required", (_req, res) => {
  res.json({ required: true });
});

router.post("/api/auth/register", authRateLimiter, async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);

    const submitted = (input.inviteCode ?? "").trim().toUpperCase();
    if (!submitted) {
      return res.status(400).json({ message: "An invite code is required to register." });
    }
    const inviteRecord = await storage.getInviteCode(submitted);
    if (!inviteRecord || inviteRecord.usedAt !== null) {
      return res.status(400).json({ message: "Invalid or already-used invite code." });
    }

    const existing = await storage.getUserByEmail(input.email);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await storage.createUser({ email: input.email, name: input.name, passwordHash });
    const initialPrefs: UserPreferences = { diet: null, allergies: [], excludedFoods: [], preferredFoods: [], micronutrientOptimize: false, onboardingComplete: false };
    await storage.updateUserPreferences(user.id, initialPrefs);
    await storage.markInviteCodeUsed(submitted, input.email);
    req.session.userId = user.id;
    const { passwordHash: _, ...publicUser } = user;
    req.session.save(() => res.status(201).json(publicUser));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

router.post("/api/auth/login", authRateLimiter, async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await storage.getUserByEmail(input.email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.passwordHash) {
      const providerName = user.provider ? user.provider.charAt(0).toUpperCase() + user.provider.slice(1) : "social";
      return res.status(401).json({ message: `This account uses ${providerName} sign-in. Please use the "${providerName}" button to log in.` });
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    req.session.userId = user.id;
    const { passwordHash: _, ...publicUser } = user;
    req.session.save(() => res.status(200).json(publicUser));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

router.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(200).json({ message: "Logged out" });
  });
});

router.get("/api/auth/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  const { passwordHash: _, ...publicUser } = user;
  res.status(200).json(publicUser);
});

router.get("/api/auth/providers", (_req, res) => {
  res.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
  });
});

router.get("/api/auth/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ message: "Google sign-in is not configured" });
  }
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

router.get("/api/auth/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false, failureRedirect: "/auth?error=google_failed" })(req, res, next);
  },
  (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) return res.redirect("/auth?error=google_failed");

    if (user.pendingOAuth) {
      req.session.pendingOAuth = {
        email: user.email,
        name: user.name,
        provider: user.provider,
        providerId: user.providerId,
      };
      return req.session.save(() =>
        res.redirect(`/auth?oauth_pending=google&email=${encodeURIComponent(user.email)}`)
      );
    }

    req.session.userId = user.id;
    req.session.save(() => res.redirect("/dashboard"));
  }
);

router.post("/api/auth/oauth-invite", authRateLimiter, async (req, res) => {
  const pending = req.session.pendingOAuth;
  if (!pending) {
    return res.status(400).json({ message: "No pending sign-in found. Please try signing in with Google again." });
  }

  const submittedOAuth = ((req.body.inviteCode as string) ?? "").trim().toUpperCase();
  if (!submittedOAuth) {
    return res.status(400).json({ message: "An invite code is required to register." });
  }
  const inviteRecordOAuth = await storage.getInviteCode(submittedOAuth);
  if (!inviteRecordOAuth || inviteRecordOAuth.usedAt !== null) {
    return res.status(400).json({ message: "Invalid or already-used invite code." });
  }

  try {
    const user = await storage.findOrCreateOAuthUser(pending);
    const initialPrefs: UserPreferences = { diet: null, allergies: [], excludedFoods: [], preferredFoods: [], micronutrientOptimize: false, onboardingComplete: false };
    await storage.updateUserPreferences(user.id, initialPrefs);
    await storage.markInviteCodeUsed(submittedOAuth, pending.email);
    delete req.session.pendingOAuth;
    req.session.userId = user.id;
    req.session.save(() => res.json({ ok: true }));
  } catch (err) {
    throw err;
  }
});

router.get("/api/auth/apple", (req, res, next) => {
  if (!process.env.APPLE_CLIENT_ID) {
    return res.status(503).json({ message: "Apple sign-in is not configured" });
  }
  passport.authenticate("apple", { session: false })(req, res, next);
});

router.post("/api/auth/apple/callback",
  (req, res, next) => {
    passport.authenticate("apple", { session: false, failureRedirect: "/auth?error=apple_failed" })(req, res, next);
  },
  (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) return res.redirect("/auth?error=apple_failed");
    req.session.userId = user.id;
    req.session.save(() => res.redirect("/dashboard"));
  }
);

router.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.json({ message: "If that email is registered you will receive a reset link." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await storage.createPasswordResetToken(user.id, token, expiresAt);
    const appUrl = process.env.APP_URL || `http://localhost:5000`;
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your Fuelr password",
      html: buildPasswordResetEmailHtml(resetUrl, user.name),
    });
    res.json({ message: "If that email is registered you will receive a reset link." });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = z.object({ token: z.string(), password: z.string().min(6) }).parse(req.body);
    const row = await storage.getPasswordResetToken(token);
    if (!row) return res.status(400).json({ message: "Invalid or expired reset link." });
    if (row.usedAt) return res.status(400).json({ message: "This reset link has already been used." });
    if (row.expiresAt < new Date()) return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
    const passwordHash = await bcrypt.hash(password, 12);
    await storage.updateUserPassword(row.userId, passwordHash);
    await storage.markPasswordResetTokenUsed(row.id);
    res.json({ message: "Password updated successfully." });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

export default router;
