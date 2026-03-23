import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import passport from "passport";
import { storage } from "../storage";
import { registerSchema, loginSchema, usernameSchema, type UserPreferences, type User, nutritionistTierLimits, type NutritionistTier, calculateAge, MINIMUM_AGE_EU } from "@shared/schema";
import { computeTrialInfo } from "@shared/trial";
import { authRateLimiter } from "../constants";
import { sendEmail, buildPasswordResetEmailHtml, verifyUnsubscribeToken } from "../email";
import { emailPreferencesSchema } from "@shared/schema";

function toPublicUser(user: User) {
  const { passwordHash: _, stripeCustomerId: _s, stripeSubscriptionId: _si, paymentFailedAt: _p, ...pub } = user;
  return pub;
}

const router = Router();

router.get("/api/auth/invite-required", (_req, res) => {
  res.json({ required: true });
});

router.get("/api/auth/check-username", async (req, res) => {
  const username = (req.query.username as string ?? "").trim();
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) {
    return res.json({ available: false, message: parsed.error.errors[0].message });
  }
  const existing = await storage.getUserByUsername(username);
  if (existing && existing.id !== req.session?.userId) {
    return res.json({ available: false, message: "Username is already taken" });
  }
  return res.json({ available: true });
});

router.post("/api/auth/register", authRateLimiter, async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);

    const nutritionistInviteToken = (input.nutritionistInviteToken ?? "").trim();

    // Validate authorization BEFORE creating user — either a nutritionist invite or a platform invite code
    let nutritionistInvitation: { id: number; nutritionistId: number; email: string; expiresAt: Date; acceptedAt: Date | null } | null = null;
    let platformInviteCode: string | null = null;

    if (nutritionistInviteToken) {
      // Nutritionist invite path: validate token, email match, nutritionist profile, and capacity
      const inv = await storage.getNutritionistInvitationByToken(nutritionistInviteToken);
      if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
        return res.status(400).json({ message: "The nutritionist invitation link is invalid or has expired. Please request a new one from your nutritionist." });
      }
      if (inv.email.toLowerCase() !== input.email.toLowerCase()) {
        return res.status(403).json({ message: "This invitation was sent to a different email address. Please register with the email address your nutritionist used." });
      }
      const nutritionistProfile = await storage.getNutritionistProfile(inv.nutritionistId);
      if (!nutritionistProfile) {
        return res.status(400).json({ message: "The nutritionist who sent this invitation no longer has a valid account. Please contact them." });
      }
      const clientLimit = nutritionistTierLimits[nutritionistProfile.tier as NutritionistTier] ?? 15;
      const currentCount = await storage.getNutritionistClientCount(inv.nutritionistId);
      if (currentCount >= clientLimit) {
        return res.status(403).json({ message: "Your nutritionist has reached their maximum client capacity and cannot accept new clients at this time." });
      }
      nutritionistInvitation = inv;
    } else {
      const submitted = (input.inviteCode ?? "").trim().toUpperCase();
      if (!submitted) {
        return res.status(400).json({ message: "An invite code is required to register." });
      }
      const inviteRecord = await storage.getInviteCode(submitted);
      if (!inviteRecord || inviteRecord.usedAt !== null) {
        return res.status(400).json({ message: "Invalid or already-used invite code." });
      }
      platformInviteCode = submitted;
    }

    const dobMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.dateOfBirth);
    if (!dobMatch) {
      return res.status(400).json({ message: "Please enter a valid date of birth." });
    }
    const dobYear = parseInt(dobMatch[1]);
    const dobMonth = parseInt(dobMatch[2]) - 1;
    const dobDay = parseInt(dobMatch[3]);
    const dob = new Date(dobYear, dobMonth, dobDay);
    if (isNaN(dob.getTime()) || dob.getFullYear() !== dobYear || dob.getMonth() !== dobMonth || dob.getDate() !== dobDay) {
      return res.status(400).json({ message: "Please enter a valid date of birth." });
    }
    const age = calculateAge(dob);
    if (age < MINIMUM_AGE_EU) {
      return res.status(403).json({ message: `You must be at least ${MINIMUM_AGE_EU} years old to create an account. Users in the EU/UK must be at least 16, and users in other regions must be at least 13.` });
    }

    const existing = await storage.getUserByEmail(input.email);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    const existingUsername = await storage.getUserByUsername(input.username);
    if (existingUsername) {
      return res.status(409).json({ message: "This username is already taken" });
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await storage.createUser({ email: input.email, name: input.name, username: input.username, passwordHash, dateOfBirth: dob });
    const initialPrefs: UserPreferences = { diet: null, allergies: [], excludedFoods: [], preferredFoods: [], micronutrientOptimize: false, onboardingComplete: false };
    await storage.updateUserPreferences(user.id, initialPrefs);
    if (!user.betaUser) {
      await storage.updateUserTrial(user.id, { trialStartDate: new Date(), trialStatus: "active" });
    }

    if (nutritionistInvitation) {
      // Accept invitation and link client atomically after account creation
      await storage.acceptNutritionistInvitation(nutritionistInviteToken);
      await storage.addNutritionistClient(nutritionistInvitation.nutritionistId, user.id, { status: "onboarding" });
      await storage.setManagedClientFlag(user.id, true, nutritionistInvitation.nutritionistId);
      await storage.updateUserTier(user.id, { betaUser: false, tier: "free" });
    } else if (platformInviteCode) {
      await storage.markInviteCodeUsed(platformInviteCode, input.email);
      await storage.updateUserTier(user.id, { betaUser: true, tier: "advanced" });
    }

    req.session.userId = user.id;
    const updatedUser = await storage.getUserById(user.id);
    const publicUser = toPublicUser(updatedUser!);
    const trialInfo = computeTrialInfo(
      publicUser.trialStatus, publicUser.trialStartDate, publicUser.trialStepDownSeen, publicUser.trialExpiredSeen, publicUser.betaUser, publicUser.tier
    );
    req.session.save(() => res.status(201).json({ ...publicUser, trialInfo }));
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
    const user = input.identifier.includes("@")
      ? await storage.getUserByEmail(input.identifier)
      : await storage.getUserByUsername(input.identifier);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (!user.passwordHash) {
      const providerName = user.provider ? user.provider.charAt(0).toUpperCase() + user.provider.slice(1) : "social";
      return res.status(401).json({ message: `This account uses ${providerName} sign-in. Please use the "${providerName}" button to log in.` });
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const trialInfo = computeTrialInfo(
      user.trialStatus, user.trialStartDate, user.trialStepDownSeen, user.trialExpiredSeen, user.betaUser, user.tier
    );
    if (trialInfo.phase === "expired" && user.trialStatus === "active") {
      await storage.updateUserTrial(user.id, { trialStatus: "expired" });
      await storage.updateUserTier(user.id, { tier: "free" });
    }
    req.session.userId = user.id;
    const freshUser = await storage.getUserById(user.id);
    const publicUser = toPublicUser(freshUser!);
    const freshTrialInfo = computeTrialInfo(
      publicUser.trialStatus, publicUser.trialStartDate, publicUser.trialStepDownSeen, publicUser.trialExpiredSeen, publicUser.betaUser, publicUser.tier
    );
    req.session.save(() => res.status(200).json({ ...publicUser, trialInfo: freshTrialInfo }));
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
  const trialInfo = computeTrialInfo(
    user.trialStatus, user.trialStartDate, user.trialStepDownSeen, user.trialExpiredSeen, user.betaUser, user.tier
  );
  if (trialInfo.phase === "expired" && user.trialStatus === "active") {
    await storage.updateUserTrial(user.id, { trialStatus: "expired" });
    await storage.updateUserTier(user.id, { tier: "free" });
    const freshUser = await storage.getUserById(user.id);
    const publicUser = toPublicUser(freshUser!);
    const freshTrialInfo = computeTrialInfo(
      publicUser.trialStatus, publicUser.trialStartDate, publicUser.trialStepDownSeen, publicUser.trialExpiredSeen, publicUser.betaUser, publicUser.tier
    );
    return res.status(200).json({ ...publicUser, trialInfo: freshTrialInfo });
  }
  const publicUser = toPublicUser(user);
  res.status(200).json({ ...publicUser, trialInfo });
});

router.post("/api/auth/trial/acknowledge-stepdown", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  await storage.updateUserTrial(req.session.userId, { trialStepDownSeen: true });
  res.json({ ok: true });
});

router.post("/api/auth/trial/acknowledge-expired", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  await storage.updateUserTrial(req.session.userId, { trialExpiredSeen: true });
  res.json({ ok: true });
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

  const oauthUsername = ((req.body.username as string) ?? "").trim();
  const parsedUsername = usernameSchema.safeParse(oauthUsername);
  if (!parsedUsername.success) {
    return res.status(400).json({ message: parsedUsername.error.errors[0].message });
  }
  const existingUsername = await storage.getUserByUsername(oauthUsername);
  if (existingUsername) {
    return res.status(409).json({ message: "This username is already taken" });
  }

  try {
    const user = await storage.findOrCreateOAuthUser(pending);
    await storage.updateUserProfile(user.id, { username: oauthUsername });
    const initialPrefs: UserPreferences = { diet: null, allergies: [], excludedFoods: [], preferredFoods: [], micronutrientOptimize: false, onboardingComplete: false };
    await storage.updateUserPreferences(user.id, initialPrefs);
    if (!user.betaUser && user.trialStatus === "none") {
      await storage.updateUserTrial(user.id, { trialStartDate: new Date(), trialStatus: "active" });
    }
    await storage.markInviteCodeUsed(submittedOAuth, pending.email);
    await storage.updateUserTier(user.id, { betaUser: true, tier: "advanced" });
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
      subject: "Reset your FuelU password",
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

router.put("/api/auth/profile", async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const input = z.object({
      name: z.string().min(2, "Name must be at least 2 characters").optional(),
      email: z.string().email("Invalid email address").optional(),
      username: usernameSchema.optional(),
    }).refine(data => data.name !== undefined || data.email !== undefined || data.username !== undefined, {
      message: "At least one of name, email, or username must be provided",
    }).parse(req.body);
    if (input.email) {
      const existing = await storage.getUserByEmail(input.email);
      if (existing && existing.id !== req.session.userId) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }
    if (input.username) {
      const existing = await storage.getUserByUsername(input.username);
      if (existing && existing.id !== req.session.userId) {
        return res.status(400).json({ message: "Username is already taken" });
      }
    }
    const updated = await storage.updateUserProfile(req.session.userId, input);
    res.json(toPublicUser(updated));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.put("/api/auth/password", async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const input = z.object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().min(6, "New password must be at least 6 characters"),
    }).parse(req.body);
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.passwordHash) {
      return res.status(400).json({ message: "Cannot change password for OAuth accounts" });
    }
    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await storage.updateUserPassword(req.session.userId, passwordHash);
    res.json({ message: "Password updated successfully." });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.get("/api/auth/export-data", async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const data = await storage.exportUserData(req.session.userId);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="my-data-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(data);
  } catch (err) {
    return res.status(500).json({ message: "Failed to export data" });
  }
});

router.delete("/api/auth/account", async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.passwordHash) {
      const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Incorrect password" });
    }

    await storage.deleteUser(user.id);

    req.session.destroy(() => {
      res.status(200).json({ message: "Account deleted successfully" });
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Password is required to delete your account" });
    throw err;
  }
});

router.get("/api/email-preferences", async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).json({ message: "Missing token" });

  const result = verifyUnsubscribeToken(token);
  if (!result) return res.status(400).json({ message: "Invalid or expired unsubscribe link." });

  if ("userId" in result) {
    const user = await storage.getUserById(result.userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    const preferences = await storage.getEmailPreferences(result.userId);
    return res.json({ preferences, name: user.name });
  }

  const preferences = await storage.getEmailOptoutPreferences(result.email);
  res.json({ preferences, name: result.email });
});

router.put("/api/email-preferences", async (req, res) => {
  const { token, preferences } = req.body;
  if (!token) return res.status(400).json({ message: "Missing token" });

  const result = verifyUnsubscribeToken(token);
  if (!result) return res.status(400).json({ message: "Invalid or expired unsubscribe link." });

  try {
    const parsed = emailPreferencesSchema.parse(preferences);
    if ("userId" in result) {
      const user = await storage.getUserById(result.userId);
      if (!user) return res.status(404).json({ message: "User not found." });
      await storage.updateEmailPreferences(result.userId, parsed);
    } else {
      await storage.updateEmailOptoutPreferences(result.email, parsed);
    }
    res.json({ message: "Preferences updated", preferences: parsed });
  } catch (err) {
    return res.status(400).json({ message: "Invalid preferences" });
  }
});

router.get("/api/user/email-preferences", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const preferences = await storage.getEmailPreferences(req.session.userId);
  res.json(preferences);
});

router.put("/api/user/email-preferences", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const parsed = emailPreferencesSchema.parse(req.body);
    await storage.updateEmailPreferences(req.session.userId, parsed);
    res.json({ message: "Preferences updated", preferences: parsed });
  } catch (err) {
    return res.status(400).json({ message: "Invalid preferences" });
  }
});

export default router;
