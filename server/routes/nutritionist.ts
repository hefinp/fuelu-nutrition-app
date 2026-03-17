import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage";
import { insertNutritionistProfileSchema, insertNutritionistNoteSchema, nutritionistTierLimits, type NutritionistTier } from "@shared/schema";

const router = Router();

function isZodError(err: unknown): err is { name: string; errors: unknown[] } {
  return typeof err === "object" && err !== null && (err as { name?: string }).name === "ZodError";
}

function requireAuth(req: Request, res: Response): number | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return userId;
}

router.get("/api/nutritionist/profile", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  res.json(profile ?? null);
});

router.post("/api/nutritionist/profile", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const existing = await storage.getNutritionistProfile(userId);
  if (existing) return res.status(409).json({ message: "Nutritionist profile already exists" });

  try {
    const data = insertNutritionistProfileSchema.parse(req.body);
    const profile = await storage.createNutritionistProfile(userId, data);
    res.status(201).json(profile);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.put("/api/nutritionist/profile", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const data = insertNutritionistProfileSchema.partial().parse(req.body);
    const updated = await storage.updateNutritionistProfile(userId, data);
    if (!updated) return res.status(404).json({ message: "Nutritionist profile not found" });
    res.json(updated);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.get("/api/nutritionist/clients", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile to access this." });

  const clients = await storage.getNutritionistClients(userId);
  res.json(clients);
});

router.put("/api/nutritionist/clients/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid client ID" });

  const schema = z.object({
    status: z.enum(["onboarding", "active", "paused"]).optional(),
    goalSummary: z.string().max(500).optional(),
    healthNotes: z.string().max(2000).optional(),
  });

  try {
    const updates = schema.parse(req.body);
    const updated = await storage.updateNutritionistClient(id, userId, updates);
    if (!updated) return res.status(404).json({ message: "Client not found" });
    res.json(updated);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.delete("/api/nutritionist/clients/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid client ID" });

  const clients = await storage.getNutritionistClients(userId);
  const clientRecord = clients.find(c => c.id === id);

  if (!clientRecord) return res.status(404).json({ message: "Client not found" });

  await storage.removeNutritionistClient(id, userId);
  await storage.setManagedClientFlag(clientRecord.clientId, false, null);
  res.json({ success: true });
});

router.get("/api/nutritionist/clients/:clientId/profile", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const client = await storage.getUserById(clientId);
  if (!client) return res.status(404).json({ message: "Client user not found" });

  const { passwordHash: _, stripeCustomerId: _s, stripeSubscriptionId: _si, paymentFailedAt: _p, provider: _pr, providerId: _pid, managedByNutritionistId: _mn, ...safeClient } = client;
  const prefs = client.preferences as Record<string, unknown> | null;

  res.json({
    ...relationship,
    client: safeClient,
    preferences: prefs,
  });
});

router.post("/api/nutritionist/invitations", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientLimit = nutritionistTierLimits[profile.tier as NutritionistTier] ?? 15;
  const currentCount = await storage.getNutritionistClientCount(userId);

  if (currentCount >= clientLimit) {
    return res.status(403).json({
      message: `You have reached your client limit (${clientLimit}) for the ${profile.tier} tier. Please upgrade to add more clients.`,
      limitReached: true,
      currentCount,
      limit: clientLimit,
      tier: profile.tier,
    });
  }

  const schema = z.object({ email: z.string().email() });
  try {
    const { email } = schema.parse(req.body);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await storage.createNutritionistInvitation(userId, email, token, expiresAt);
    res.status(201).json({ ...invitation, inviteUrl: `/auth?tab=register&nutritionist_invite=${token}` });
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid email", errors: err.errors });
    throw err;
  }
});

router.get("/api/nutritionist/invitations", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const invitations = await storage.getNutritionistInvitations(userId);
  res.json(invitations);
});

router.post("/api/nutritionist/invitations/accept", async (req, res) => {
  const schema = z.object({ token: z.string() });
  try {
    const { token } = schema.parse(req.body);
    const invitation = await storage.getNutritionistInvitationByToken(token);
    if (!invitation) return res.status(404).json({ message: "Invitation not found or expired." });
    if (invitation.acceptedAt) return res.status(400).json({ message: "Invitation already accepted." });
    if (invitation.expiresAt < new Date()) return res.status(400).json({ message: "Invitation has expired." });

    const clientUserId = req.session?.userId;
    if (!clientUserId) return res.status(401).json({ message: "You must be logged in to accept an invitation." });

    const clientUser = await storage.getUserById(clientUserId);
    if (!clientUser) return res.status(404).json({ message: "User not found." });

    if (clientUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({
        message: "This invitation was sent to a different email address. Please sign in with the email address that received the invitation.",
      });
    }

    const existingRelationship = await storage.getNutritionistClientByClientIdAny(clientUserId);
    if (existingRelationship) {
      return res.status(409).json({ message: "You are already linked to a nutritionist. A client may only be managed by one nutritionist at a time." });
    }

    const profile = await storage.getNutritionistProfile(invitation.nutritionistId);
    if (!profile) return res.status(404).json({ message: "Nutritionist not found." });

    const clientLimit = nutritionistTierLimits[profile.tier as NutritionistTier] ?? 15;
    const currentCount = await storage.getNutritionistClientCount(invitation.nutritionistId);
    if (currentCount >= clientLimit) return res.status(403).json({ message: "Nutritionist has reached their client limit." });

    await storage.acceptNutritionistInvitation(token);
    await storage.addNutritionistClient(invitation.nutritionistId, clientUserId, { status: "onboarding" });
    await storage.setManagedClientFlag(clientUserId, true, invitation.nutritionistId);

    res.json({ success: true });
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.get("/api/nutritionist/clients/:clientId/notes", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const notes = await storage.getNutritionistNotes(userId, clientId);
  res.json(notes);
});

router.post("/api/nutritionist/clients/:clientId/notes", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  try {
    const { note } = insertNutritionistNoteSchema.parse(req.body);
    const created = await storage.createNutritionistNote(userId, clientId, note);
    res.status(201).json(created);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.put("/api/nutritionist/clients/:clientId/notes/:noteId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const noteId = parseInt(req.params.noteId);
  if (isNaN(clientId) || isNaN(noteId)) return res.status(400).json({ message: "Invalid ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  try {
    const { note } = insertNutritionistNoteSchema.parse(req.body);
    const updated = await storage.updateNutritionistNote(noteId, userId, clientId, note);
    if (!updated) return res.status(404).json({ message: "Note not found" });
    res.json(updated);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.delete("/api/nutritionist/clients/:clientId/notes/:noteId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const noteId = parseInt(req.params.noteId);
  if (isNaN(clientId) || isNaN(noteId)) return res.status(400).json({ message: "Invalid ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  await storage.deleteNutritionistNote(noteId, userId, clientId);
  res.json({ success: true });
});

router.get("/api/nutritionist/capacity", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(404).json({ message: "No nutritionist profile found" });

  const tier = profile.tier as NutritionistTier;
  const limit = nutritionistTierLimits[tier] ?? 15;
  const count = await storage.getNutritionistClientCount(userId);

  res.json({ tier, limit, count, canAddMore: count < limit });
});

export default router;
