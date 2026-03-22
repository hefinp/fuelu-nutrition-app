import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage";
import { pool } from "../db";
import { insertNutritionistProfileSchema, insertNutritionistNoteSchema, nutritionistTierLimits, type NutritionistTier, goalTypeEnum, pipelineStageEnum, insertReengagementSequenceSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "client-documents");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed. Please upload PDF, image, or document files."));
    }
  },
});
import { sendEmail, buildWaitlistInviteEmailHtml } from "../email";

import OpenAI from "openai";
import { generateMealPlan } from "../meal-data";

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
    pipelineStage: z.enum(pipelineStageEnum).optional(),
    goalSummary: z.string().max(500).optional(),
    healthNotes: z.string().max(2000).optional(),
    referralSource: z.enum(["client", "social_media", "website", "other"]).nullable().optional(),
    referredByClientId: z.number().int().positive().nullable().optional(),
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

router.patch("/api/nutritionist/clients/:id/pipeline-stage", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid client ID" });

  const schema = z.object({ stage: z.enum(pipelineStageEnum) });

  try {
    const { stage } = schema.parse(req.body);
    const updated = await storage.updateClientPipelineStage(id, userId, stage);
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

  const schema = z.object({
    email: z.string().email(),
    referralSource: z.enum(["client", "social_media", "website", "other"]).optional(),
    referredByClientId: z.number().int().positive().nullable().optional(),
  });
  try {
    const { email, referralSource, referredByClientId } = schema.parse(req.body);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await storage.createNutritionistInvitation(userId, email, token, expiresAt, {
      referralSource,
      referredByClientId: referredByClientId ?? undefined,
    });
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
    await storage.addNutritionistClient(invitation.nutritionistId, clientUserId, {
      status: "onboarding",
      referralSource: invitation.referralSource ?? undefined,
      referredByClientId: invitation.referredByClientId ?? undefined,
    });
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
  const activeCount = await storage.getActiveNutritionistClientCount(userId);
  const maxClients = profile.maxClients ?? null;

  res.json({ tier, limit, count, activeCount, canAddMore: count < limit, maxClients });
});

router.get("/api/nutritionist/referrals/summary", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  try {
    const summary = await storage.getReferralSummary(userId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch referral summary" });
  }
});

const NUTRITIONIST_EMAILS = (process.env.NUTRITIONIST_EMAILS || "hefin.price@gmail.com").split(",").map(e => e.trim());

async function requireNutritionist(req: any, res: any): Promise<boolean> {
  if (!req.session.userId) {
    res.status(401).json({ message: "Not authenticated" });
    return false;
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || (!NUTRITIONIST_EMAILS.includes(user.email) && user.email !== "hefin.price@gmail.com")) {
    res.status(403).json({ message: "Nutritionist access required" });
    return false;
  }
  return true;
}

// ─── Client Management ───────────────────────────────────────────────────────

router.get("/api/nutritionist/clients", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  try {
    const clients = await storage.getNutritionistClients(req.session.userId!);
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch clients" });
  }
});

router.post("/api/nutritionist/clients", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const schema = z.object({
    clientEmail: z.string().email(),
    notes: z.string().optional(),
  });
  try {
    const { clientEmail, notes } = schema.parse(req.body);
    const clientUser = await storage.getUserByEmail(clientEmail);
    if (!clientUser) {
      return res.status(404).json({ message: "No user found with that email address" });
    }
    if (clientUser.id === req.session.userId) {
      return res.status(400).json({ message: "You cannot add yourself as a client" });
    }
    const entry = await storage.addNutritionistClient(req.session.userId!, clientUser.id, notes ? { notes } : undefined);
    res.status(201).json({ ...entry, client: clientUser });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    if ((err as any)?.code === "23505") return res.status(409).json({ message: "This client is already in your list" });
    res.status(500).json({ message: "Failed to add client" });
  }
});

router.delete("/api/nutritionist/clients/:clientId", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  try {
    await storage.removeNutritionistClient(req.session.userId!, clientId);
    res.json({ message: "Client removed" });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove client" });
  }
});

router.patch("/api/nutritionist/clients/:clientId/notes", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  const schema = z.object({ notes: z.string() });
  try {
    const { notes } = schema.parse(req.body);
    const relationship = await storage.getNutritionistClientByClientId(req.session.userId!, clientId);
    if (!relationship) return res.status(404).json({ message: "Client not found" });
    const updated = await storage.updateNutritionistClient(relationship.id, req.session.userId!, { healthNotes: notes });
    if (!updated) return res.status(404).json({ message: "Client not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update notes" });
  }
});

router.get("/api/nutritionist/clients/:clientId/profile", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  try {
    const clients = await storage.getNutritionistClients(req.session.userId!);
    const entry = clients.find(c => c.clientId === clientId);
    if (!entry) return res.status(404).json({ message: "Client not found in your list" });
    const [calculations] = await Promise.all([
      storage.getCalculations(clientId),
    ]);
    res.json({
      client: entry.client,
      notes: entry.notes,
      latestCalculation: calculations[0] ?? null,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch client profile" });
  }
});

// ─── Plans ───────────────────────────────────────────────────────────────────

router.get("/api/nutritionist/plans", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
  try {
    const plans = await storage.getNutritionistPlans(req.session.userId!, clientId);
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch plans" });
  }
});

router.get("/api/nutritionist/plans/pending-review", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  try {
    const plans = await storage.getPendingReviewPlans(req.session.userId!);
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch pending plans" });
  }
});

router.get("/api/nutritionist/clients/:clientId/plans", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  try {
    const plans = await storage.getClientPlanHistory(req.session.userId!, clientId);
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch plan history" });
  }
});

router.get("/api/nutritionist/plans/:id", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid plan ID" });
  try {
    const plan = await storage.getNutritionistPlanById(id, req.session.userId!);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    const annotations = await storage.getPlanAnnotations(id);
    res.json({ ...plan, annotations });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch plan" });
  }
});

const createPlanSchema = z.object({
  clientId: z.number().int().positive(),
  name: z.string().min(1).max(200).optional(),
  planType: z.enum(["daily", "weekly"]).optional(),
  planData: z.record(z.any()),
  promptNote: z.string().optional(),
  scheduledDeliverAt: z.string().optional(),
});

router.post("/api/nutritionist/plans", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  try {
    const input = createPlanSchema.parse(req.body);
    const clients = await storage.getNutritionistClients(req.session.userId!);
    const clientEntry = clients.find(c => c.clientId === input.clientId);
    if (!clientEntry) return res.status(403).json({ message: "This client is not in your list" });

    const plan = await storage.createNutritionistPlan({
      nutritionistId: req.session.userId!,
      clientId: input.clientId,
      name: input.name ?? "Meal Plan",
      planType: input.planType ?? "weekly",
      planData: input.planData,
      status: "draft",
      promptNote: input.promptNote ?? null,
      scheduledDeliverAt: input.scheduledDeliverAt ? new Date(input.scheduledDeliverAt) : null,
    });
    res.status(201).json(plan);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to create plan" });
  }
});

router.patch("/api/nutritionist/plans/:id", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid plan ID" });
  const schema = z.object({
    name: z.string().min(1).max(200).optional(),
    planData: z.record(z.any()).optional(),
    status: z.enum(["draft", "pending_review", "approved", "delivered"]).optional(),
    promptNote: z.string().optional(),
    scheduledDeliverAt: z.string().nullable().optional(),
  });
  try {
    const input = schema.parse(req.body);
    const updates: any = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.planData !== undefined) updates.planData = input.planData;
    if (input.status !== undefined) updates.status = input.status;
    if (input.promptNote !== undefined) updates.promptNote = input.promptNote;
    if (input.scheduledDeliverAt !== undefined) {
      updates.scheduledDeliverAt = input.scheduledDeliverAt ? new Date(input.scheduledDeliverAt) : null;
    }
    const updated = await storage.updateNutritionistPlan(id, req.session.userId!, updates);
    if (!updated) return res.status(404).json({ message: "Plan not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update plan" });
  }
});

router.delete("/api/nutritionist/plans/:id", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid plan ID" });
  try {
    await storage.deleteNutritionistPlan(id, req.session.userId!);
    res.json({ message: "Plan deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete plan" });
  }
});

router.post("/api/nutritionist/plans/:id/approve", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid plan ID" });
  try {
    const updated = await storage.updateNutritionistPlan(id, req.session.userId!, { status: "approved" });
    if (!updated) return res.status(404).json({ message: "Plan not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to approve plan" });
  }
});

router.post("/api/nutritionist/plans/:id/deliver", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid plan ID" });
  try {
    const plan = await storage.getNutritionistPlanById(id, req.session.userId!);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    if (plan.status !== "approved") return res.status(400).json({ message: "Plan must be approved before delivery" });
    const delivered = await storage.deliverNutritionistPlan(id, req.session.userId!);
    res.json(delivered);
  } catch (err) {
    res.status(500).json({ message: "Failed to deliver plan" });
  }
});

// ─── AI Plan Generation ──────────────────────────────────────────────────────

router.post("/api/nutritionist/plans/generate", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const schema = z.object({
    clientId: z.number().int().positive(),
    promptNote: z.string().optional(),
    planType: z.enum(["daily", "weekly"]).optional(),
    mealStyle: z.string().optional(),
  });
  try {
    const input = schema.parse(req.body);
    const clients = await storage.getNutritionistClients(req.session.userId!);
    const clientEntry = clients.find(c => c.clientId === input.clientId);
    if (!clientEntry) return res.status(403).json({ message: "This client is not in your list" });

    const fullClientUser = await storage.getUserById(input.clientId);
    const rawPrefs = fullClientUser?.preferences as Record<string, unknown> | null;
    const clientPrefs = {
      diet: typeof rawPrefs?.diet === "string" ? rawPrefs.diet : null,
      allergies: Array.isArray(rawPrefs?.allergies) ? rawPrefs.allergies as string[] : [],
      excludedFoods: Array.isArray(rawPrefs?.excludedFoods) ? rawPrefs.excludedFoods as string[] : [],
    };
    const effectiveTargets = await storage.getEffectiveTargets(input.clientId);
    const calculations = await storage.getCalculations(input.clientId);
    const latestCalc = calculations[0];

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(503).json({ message: "AI generation is not configured" });
    }
    const openai = new OpenAI({ apiKey: openaiKey });

    const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const planType = input.planType ?? "weekly";

    const clientContext = [
      `Client name: ${clientEntry.client.name}`,
      effectiveTargets ? `Daily calorie target: ${effectiveTargets.dailyCalories} kcal${effectiveTargets.hasOverrides ? " (nutritionist override)" : ""}` : null,
      effectiveTargets ? `Protein: ${effectiveTargets.proteinGoal}g, Carbs: ${effectiveTargets.carbsGoal}g, Fat: ${effectiveTargets.fatGoal}g` : null,
      latestCalc ? `Goal: ${latestCalc.goal}, Activity: ${latestCalc.activityLevel}` : null,
      clientPrefs.diet ? `Dietary preference: ${clientPrefs.diet}` : null,
      clientPrefs.allergies?.length ? `Allergies: ${clientPrefs.allergies.join(", ")}` : null,
      clientPrefs.excludedFoods?.length ? `Excluded foods: ${clientPrefs.excludedFoods.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const slots = ["breakfast", "lunch", "dinner", "snack"];

    const systemPrompt = `You are a professional nutritionist AI assistant. Generate a ${planType} meal plan as a JSON object.
For a weekly plan, return an object with keys monday through sunday. Each day should have keys: breakfast, lunch, dinner, snack.
For a daily plan, return an object with keys: breakfast, lunch, dinner, snack.
Each meal entry should be an object with: { meal: string, calories: number, protein: number, carbs: number, fat: number }.
Return ONLY the JSON object, no markdown, no explanation.`;

    const userPrompt = `Generate a ${planType} meal plan for this client:\n${clientContext}${input.promptNote ? `\n\nClinical adjustment note from nutritionist: ${input.promptNote}` : ""}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 3000,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let planData: any;
    try {
      planData = JSON.parse(raw);
    } catch {
      return res.status(500).json({ message: "AI returned invalid plan data" });
    }

    const plan = await storage.createNutritionistPlan({
      nutritionistId: req.session.userId!,
      clientId: input.clientId,
      name: `AI Plan for ${clientEntry.client.name}`,
      planType,
      planData,
      status: "pending_review",
      promptNote: input.promptNote ?? null,
      scheduledDeliverAt: null,
    });

    res.status(201).json(plan);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    console.error("[nutritionist] AI generation error:", err);
    res.status(500).json({ message: "Failed to generate plan" });
  }
});

// ─── Annotations ─────────────────────────────────────────────────────────────

router.get("/api/nutritionist/plans/:planId/annotations", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const planId = parseInt(req.params.planId);
  if (isNaN(planId)) return res.status(400).json({ message: "Invalid plan ID" });
  try {
    const plan = await storage.getNutritionistPlanById(planId, req.session.userId!);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    const annotations = await storage.getPlanAnnotations(planId);
    res.json(annotations);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch annotations" });
  }
});

router.put("/api/nutritionist/plans/:planId/annotations", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const planId = parseInt(req.params.planId);
  if (isNaN(planId)) return res.status(400).json({ message: "Invalid plan ID" });
  const schema = z.object({
    day: z.string().min(1),
    slot: z.string().nullable().optional(),
    note: z.string().min(1).max(1000),
  });
  try {
    const plan = await storage.getNutritionistPlanById(planId, req.session.userId!);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    const input = schema.parse(req.body);
    const annotation = await storage.upsertPlanAnnotation({
      planId,
      day: input.day,
      slot: input.slot ?? null,
      note: input.note,
    });
    res.json(annotation);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to save annotation" });
  }
});

router.delete("/api/nutritionist/plans/:planId/annotations/:annotationId", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const planId = parseInt(req.params.planId);
  const annotationId = parseInt(req.params.annotationId);
  if (isNaN(planId) || isNaN(annotationId)) return res.status(400).json({ message: "Invalid ID" });
  try {
    const plan = await storage.getNutritionistPlanById(planId, req.session.userId!);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    await storage.deletePlanAnnotation(annotationId, planId);
    res.json({ message: "Annotation deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete annotation" });
  }
});

// ─── Templates ───────────────────────────────────────────────────────────────

router.get("/api/nutritionist/templates", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  try {
    const templates = await storage.getPlanTemplates(req.session.userId!);
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch templates" });
  }
});

router.post("/api/nutritionist/templates", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const schema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    planType: z.enum(["daily", "weekly"]).optional(),
    planData: z.record(z.any()),
  });
  try {
    const input = schema.parse(req.body);
    const template = await storage.createPlanTemplate({
      nutritionistId: req.session.userId!,
      name: input.name,
      description: input.description ?? null,
      planType: input.planType ?? "weekly",
      planData: input.planData,
    });
    res.status(201).json(template);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to create template" });
  }
});

router.patch("/api/nutritionist/templates/:id", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid template ID" });
  const schema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    planData: z.record(z.any()).optional(),
  });
  try {
    const input = schema.parse(req.body);
    const updated = await storage.updatePlanTemplate(id, req.session.userId!, input as any);
    if (!updated) return res.status(404).json({ message: "Template not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update template" });
  }
});

router.delete("/api/nutritionist/templates/:id", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid template ID" });
  try {
    await storage.deletePlanTemplate(id, req.session.userId!);
    res.json({ message: "Template deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete template" });
  }
});

// ─── Save plan as template ────────────────────────────────────────────────────

router.post("/api/nutritionist/plans/:id/save-as-template", async (req, res) => {
  if (!await requireNutritionist(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid plan ID" });
  const schema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
  });
  try {
    const plan = await storage.getNutritionistPlanById(id, req.session.userId!);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    const input = schema.parse(req.body);
    const template = await storage.createPlanTemplate({
      nutritionistId: req.session.userId!,
      name: input.name,
      description: input.description ?? null,
      planType: plan.planType,
      planData: plan.planData as any,
    });
    res.status(201).json(template);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to save as template" });
  }
});

// ─── Client-facing: delivered plans ──────────────────────────────────────────

router.get("/api/nutritionist/clients/:clientId/target-overrides", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const calcs = await storage.getCalculations(clientId);
  const latestCalc = calcs.length > 0 ? calcs[0] : null;
  const overrides = await storage.getClientTargetOverrides(clientId);
  const effective = await storage.getEffectiveTargets(clientId);

  res.json({
    calculated: latestCalc ? {
      dailyCalories: latestCalc.dailyCalories,
      proteinGoal: latestCalc.proteinGoal,
      carbsGoal: latestCalc.carbsGoal,
      fatGoal: latestCalc.fatGoal,
      fibreGoal: latestCalc.fibreGoal,
    } : null,
    overrides: overrides ?? null,
    effective,
  });
});

// ─── Client Intake Forms ──────────────────────────────────────────────────────

router.get("/api/nutritionist/clients/:clientId/intake", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const form = await storage.getClientIntakeForm(userId, clientId);
  res.json(form ?? null);
});

router.post("/api/nutritionist/clients/:clientId/intake", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const existing = await storage.getClientIntakeForm(userId, clientId);
  if (existing) return res.status(409).json({ message: "Intake form already exists for this client." });

  const schema = z.object({
    medicalHistory: z.string().max(5000).optional(),
    medications: z.string().max(3000).optional(),
    lifestyle: z.string().max(3000).optional(),
    dietaryRestrictions: z.string().max(3000).optional(),
    foodPreferences: z.string().max(3000).optional(),
    notes: z.string().max(5000).optional(),
  });

  try {
    const data = schema.parse(req.body);
    const form = await storage.createClientIntakeForm({
      nutritionistClientId: relationship.id,
      nutritionistId: userId,
      clientId,
      ...data,
      completedAt: new Date(),
    });

    await storage.updateNutritionistClient(relationship.id, userId, { status: "active", lastActivityAt: new Date() });

    res.status(201).json(form);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.put("/api/nutritionist/clients/:clientId/intake", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const existing = await storage.getClientIntakeForm(userId, clientId);
  if (!existing) return res.status(404).json({ message: "No intake form found." });

  const schema = z.object({
    medicalHistory: z.string().max(5000).optional(),
    medications: z.string().max(3000).optional(),
    lifestyle: z.string().max(3000).optional(),
    dietaryRestrictions: z.string().max(3000).optional(),
    foodPreferences: z.string().max(3000).optional(),
    notes: z.string().max(5000).optional(),
  });

  try {
    const data = schema.parse(req.body);
    const updated = await storage.updateClientIntakeForm(existing.id, userId, data);
    res.json(updated);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

// ─── Client Goals ─────────────────────────────────────────────────────────────

router.get("/api/nutritionist/clients/:clientId/goals", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const goals = await storage.getClientGoals(userId, clientId);

  const enrichedGoals = await Promise.all(goals.map(async (goal) => {
    let computedCurrentValue = goal.currentValue;

    if (goal.goalType === "weight") {
      const weightEntries = await storage.getWeightEntries(clientId);
      if (weightEntries.length > 0) {
        computedCurrentValue = weightEntries[weightEntries.length - 1].weight;
      }
    } else if (goal.goalType === "macro_average") {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const fromStr = weekAgo.toISOString().split("T")[0];
      const toStr = now.toISOString().split("T")[0];
      const foodLogs = await storage.getFoodLogEntriesRange(clientId, fromStr, toStr);
      if (foodLogs.length > 0) {
        const unit = (goal.unit || "").toLowerCase();
        let total = 0;
        for (const entry of foodLogs) {
          if (unit.includes("protein")) total += entry.protein ?? 0;
          else if (unit.includes("carb")) total += entry.carbs ?? 0;
          else if (unit.includes("fat")) total += entry.fat ?? 0;
          else if (unit.includes("cal")) total += entry.calories ?? 0;
        }
        const uniqueDays = new Set(foodLogs.map(e => e.date)).size;
        computedCurrentValue = uniqueDays > 0 ? String(Math.round(total / uniqueDays)) : computedCurrentValue;
      }
    }

    let progress = null;
    const baseline = goal.currentValue ? parseFloat(String(goal.currentValue)) : null;
    if (goal.targetValue && computedCurrentValue) {
      const target = parseFloat(String(goal.targetValue));
      const current = parseFloat(String(computedCurrentValue));
      if (!isNaN(target) && !isNaN(current)) {
        if (baseline !== null && !isNaN(baseline) && baseline !== target) {
          const totalChange = Math.abs(target - baseline);
          const actualChange = Math.abs(current - baseline);
          const movingCorrectDirection =
            (target > baseline && current >= baseline) ||
            (target < baseline && current <= baseline);
          if (movingCorrectDirection) {
            progress = Math.min(100, Math.round((actualChange / totalChange) * 100));
          } else {
            progress = 0;
          }
        } else if (target > 0) {
          if (current <= target) {
            progress = Math.min(100, Math.round((current / target) * 100));
          } else {
            progress = 100;
          }
        }
      }
    }

    let onTrack = null;
    if (goal.targetDate && progress !== null) {
      const now = new Date();
      const targetDate = new Date(goal.targetDate);
      const createdAt = new Date(goal.createdAt!);
      const totalDuration = targetDate.getTime() - createdAt.getTime();
      const elapsed = now.getTime() - createdAt.getTime();
      const expectedProgress = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 100;
      onTrack = progress >= expectedProgress * 0.8;
    }

    return {
      ...goal,
      currentValue: computedCurrentValue,
      progress,
      onTrack,
    };
  }));

  res.json(enrichedGoals);
});

router.put("/api/nutritionist/clients/:clientId/target-overrides", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const schema = z.object({
    dailyCalories: z.number().int().min(500).max(10000).nullable().optional(),
    proteinGoal: z.number().int().min(0).max(1000).nullable().optional(),
    carbsGoal: z.number().int().min(0).max(1000).nullable().optional(),
    fatGoal: z.number().int().min(0).max(500).nullable().optional(),
    fibreGoal: z.number().int().min(0).max(200).nullable().optional(),
    rationale: z.string().max(500).nullable().optional(),
  });

  try {
    const data = schema.parse(req.body);
    const result = await storage.upsertClientTargetOverrides(userId, clientId, data);
    const effective = await storage.getEffectiveTargets(clientId);
    res.json({ overrides: result, effective });
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.post("/api/nutritionist/clients/:clientId/goals", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const schema = z.object({
    goalType: z.enum(goalTypeEnum).default("custom"),
    title: z.string().min(1).max(200),
    targetValue: z.string().optional(),
    unit: z.string().max(50).optional(),
    targetDate: z.string().optional().refine(
      (v) => !v || !isNaN(new Date(v).getTime()),
      { message: "Invalid date format" }
    ),
  });

  try {
    const data = schema.parse(req.body);
    const goal = await storage.createClientGoal({
      nutritionistClientId: relationship.id,
      nutritionistId: userId,
      clientId,
      goalType: data.goalType,
      title: data.title,
      targetValue: data.targetValue,
      unit: data.unit,
      targetDate: data.targetDate,
      status: "active",
    });
    res.status(201).json(goal);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.delete("/api/nutritionist/clients/:clientId/target-overrides", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  await storage.clearClientTargetOverrides(userId, clientId);
  res.json({ success: true });
});

router.put("/api/nutritionist/clients/:clientId/goals/:goalId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const goalId = parseInt(req.params.goalId);
  if (isNaN(clientId) || isNaN(goalId)) return res.status(400).json({ message: "Invalid ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const schema = z.object({
    title: z.string().min(1).max(200).optional(),
    goalType: z.enum(goalTypeEnum).optional(),
    targetValue: z.string().optional(),
    currentValue: z.string().optional(),
    unit: z.string().max(50).optional(),
    targetDate: z.string().optional().refine(
      (v) => !v || !isNaN(new Date(v).getTime()),
      { message: "Invalid date format" }
    ),
    status: z.enum(["active", "completed", "paused"]).optional(),
  });

  try {
    const data = schema.parse(req.body);
    const updates: Partial<{ title: string; goalType: string; targetValue: string; currentValue: string; unit: string; targetDate: Date; status: string }> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.goalType !== undefined) updates.goalType = data.goalType;
    if (data.targetValue !== undefined) updates.targetValue = data.targetValue;
    if (data.currentValue !== undefined) updates.currentValue = data.currentValue;
    if (data.unit !== undefined) updates.unit = data.unit;
    if (data.targetDate !== undefined) updates.targetDate = new Date(data.targetDate);
    if (data.status !== undefined) updates.status = data.status;
    const updated = await storage.updateClientGoal(goalId, userId, clientId, updates);
    if (!updated) return res.status(404).json({ message: "Goal not found" });
    res.json(updated);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.delete("/api/nutritionist/clients/:clientId/goals/:goalId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const goalId = parseInt(req.params.goalId);
  if (isNaN(clientId) || isNaN(goalId)) return res.status(400).json({ message: "Invalid ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  await storage.deleteClientGoal(goalId, userId, clientId);
  res.json({ success: true });
});

// ─── Client-facing intake form ───────────────────────────────────────────────

router.get("/api/my-intake-form", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const relationship = await storage.getNutritionistClientByClientIdAny(req.session.userId);
  if (!relationship) return res.status(404).json({ message: "You are not linked to a nutritionist." });

  const form = await storage.getClientIntakeForm(relationship.nutritionistId, req.session.userId);
  res.json(form ?? null);
});

router.post("/api/my-intake-form", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const relationship = await storage.getNutritionistClientByClientIdAny(req.session.userId);
  if (!relationship) return res.status(404).json({ message: "You are not linked to a nutritionist." });

  const existing = await storage.getClientIntakeForm(relationship.nutritionistId, req.session.userId);

  const schema = z.object({
    medicalHistory: z.string().max(5000).optional(),
    medications: z.string().max(3000).optional(),
    lifestyle: z.string().max(3000).optional(),
    dietaryRestrictions: z.string().max(3000).optional(),
    foodPreferences: z.string().max(3000).optional(),
    notes: z.string().max(5000).optional(),
  });

  try {
    const data = schema.parse(req.body);

    if (existing) {
      const updated = await storage.updateClientIntakeForm(existing.id, relationship.nutritionistId, {
        ...data,
        completedAt: existing.completedAt ? undefined : new Date(),
      });
      res.json(updated);
    } else {
      const form = await storage.createClientIntakeForm({
        nutritionistClientId: relationship.id,
        nutritionistId: relationship.nutritionistId,
        clientId: req.session.userId,
        ...data,
        completedAt: new Date(),
      });

      await storage.updateNutritionistClient(relationship.id, relationship.nutritionistId, {
        status: "active",
        lastActivityAt: new Date(),
      });

      res.status(201).json(form);
    }
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.get("/api/my-nutritionist-plans", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const plans = await storage.getDeliveredPlansForClient(req.session.userId);
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your plans" });
  }
});

// ─── Messaging ───────────────────────────────────────────────────────────────

router.get("/api/nutritionist/clients/:clientId/messages", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before ? parseInt(req.query.before as string) : undefined;

  const messages = await storage.getMessages(userId, clientId, limit, before);
  await storage.markMessagesRead(userId, clientId, userId);
  res.json(messages);
});

router.post("/api/nutritionist/clients/:clientId/messages", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const schema = z.object({ body: z.string().min(1).max(5000) });
  try {
    const { body } = schema.parse(req.body);
    const message = await storage.createMessage(userId, clientId, userId, body);
    res.status(201).json(message);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.post("/api/nutritionist/clients/:clientId/messages/mark-read", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  await storage.markMessagesRead(userId, clientId, userId);
  res.json({ success: true });
});

router.get("/api/nutritionist/messages/unread-counts", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const counts = await storage.getUnreadCountForNutritionist(userId);
  res.json(counts);
});

router.get("/api/my-nutritionist/messages", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const clientId = req.session.userId;
  const relationship = await storage.getNutritionistClientByClientIdAny(clientId);
  if (!relationship) return res.status(403).json({ message: "You are not linked to a nutritionist." });

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before ? parseInt(req.query.before as string) : undefined;

  const messages = await storage.getMessages(relationship.nutritionistId, clientId, limit, before);
  await storage.markMessagesRead(relationship.nutritionistId, clientId, clientId);
  res.json(messages);
});

router.post("/api/my-nutritionist/messages", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const clientId = req.session.userId;
  const relationship = await storage.getNutritionistClientByClientIdAny(clientId);
  if (!relationship) return res.status(403).json({ message: "You are not linked to a nutritionist." });

  const schema = z.object({ body: z.string().min(1).max(5000) });
  try {
    const { body } = schema.parse(req.body);
    const message = await storage.createMessage(relationship.nutritionistId, clientId, clientId, body);
    res.status(201).json(message);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.post("/api/my-nutritionist/messages/mark-read", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const clientId = req.session.userId;
  const relationship = await storage.getNutritionistClientByClientIdAny(clientId);
  if (!relationship) return res.status(403).json({ message: "You are not linked to a nutritionist." });

  await storage.markMessagesRead(relationship.nutritionistId, clientId, clientId);
  res.json({ success: true });
});

router.get("/api/my-nutritionist/messages/unread-count", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const count = await storage.getUnreadCountForClient(req.session.userId);
  res.json({ count });
});

// ─── Client Progress Reports ──────────────────────────────────────────────────

router.get("/api/nutritionist/clients/:clientId/reports", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const reports = await storage.getClientReports(userId, clientId);
  res.json(reports);
});

router.get("/api/nutritionist/clients/:clientId/reports/:reportId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const reportId = parseInt(req.params.reportId);
  if (isNaN(clientId) || isNaN(reportId)) return res.status(400).json({ message: "Invalid ID" });

  const report = await storage.getClientReportById(reportId, userId);
  if (!report || report.clientId !== clientId) return res.status(404).json({ message: "Report not found" });

  res.json(report);
});

router.post("/api/nutritionist/clients/:clientId/reports/generate", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const schema = z.object({
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    clinicalSummary: z.string().max(5000).nullable().optional(),
    title: z.string().min(1).max(200).optional(),
  });

  try {
    const input = schema.parse(req.body);

    if (input.fromDate > input.toDate) return res.status(400).json({ message: "fromDate must be before or equal to toDate" });

    const client = await storage.getUserById(clientId);
    if (!client) return res.status(404).json({ message: "Client user not found" });

    const logs = await storage.getFoodLogEntriesRange(clientId, input.fromDate, input.toDate);
    const weightEntriesAll = await storage.getWeightEntries(clientId);
    const effectiveTargets = await storage.getEffectiveTargets(clientId);
    const calculations = await storage.getCalculations(clientId);
    const latestCalc = calculations[0] ?? null;
    const overrides = await storage.getClientTargetOverrides(clientId);
    const notes = await storage.getNutritionistNotes(userId, clientId);

    const fromTs = new Date(input.fromDate).getTime();
    const toTs = new Date(input.toDate + "T23:59:59").getTime();
    const weightTrend = weightEntriesAll
      .filter(w => {
        const t = new Date(w.recordedAt ?? new Date()).getTime();
        return t >= fromTs && t <= toTs;
      })
      .map(w => ({
        date: new Date(w.recordedAt ?? new Date()).toISOString().split("T")[0],
        weight: parseFloat(String(w.weight)),
      }));

    const logsByDate: Record<string, typeof logs> = {};
    for (const entry of logs) {
      if (!logsByDate[entry.date]) logsByDate[entry.date] = [];
      logsByDate[entry.date].push(entry);
    }

    const daysLogged = Object.keys(logsByDate).length;
    const totalCalories = logs.reduce((s, l) => s + l.calories, 0);
    const totalProtein = logs.reduce((s, l) => s + l.protein, 0);
    const totalCarbs = logs.reduce((s, l) => s + l.carbs, 0);
    const totalFat = logs.reduce((s, l) => s + l.fat, 0);

    const avgIntake = daysLogged > 0 ? {
      calories: Math.round(totalCalories / daysLogged),
      protein: Math.round(totalProtein / daysLogged),
      carbs: Math.round(totalCarbs / daysLogged),
      fat: Math.round(totalFat / daysLogged),
    } : null;

    let adherenceScore: number | null = null;
    if (effectiveTargets && avgIntake) {
      const variance = Math.abs(avgIntake.calories - effectiveTargets.dailyCalories) / effectiveTargets.dailyCalories;
      adherenceScore = Math.max(0, Math.round((1 - variance) * 100));
    }

    const totalDays = Math.ceil((new Date(input.toDate).getTime() - new Date(input.fromDate).getTime()) / 86400000) + 1;

    const periodNotes = notes
      .filter(n => {
        const t = new Date(n.createdAt ?? new Date()).getTime();
        return t >= fromTs && t <= toTs;
      })
      .map(n => ({ note: n.note, date: new Date(n.createdAt ?? new Date()).toISOString().split("T")[0] }));

    const goals = await storage.getClientGoals(userId, clientId);
    const goalProgress = goals.map(goal => ({
      title: goal.title,
      goalType: goal.goalType,
      targetValue: goal.targetValue ? String(goal.targetValue) : null,
      currentValue: goal.currentValue ? String(goal.currentValue) : null,
      unit: goal.unit,
      status: goal.status,
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split("T")[0] : null,
    }));

    let intakeVsTargets: { caloriesDelta: number; proteinDelta: number; carbsDelta: number; fatDelta: number } | null = null;
    if (effectiveTargets && avgIntake) {
      intakeVsTargets = {
        caloriesDelta: avgIntake.calories - effectiveTargets.dailyCalories,
        proteinDelta: avgIntake.protein - effectiveTargets.proteinGoal,
        carbsDelta: avgIntake.carbs - effectiveTargets.carbsGoal,
        fatDelta: avgIntake.fat - effectiveTargets.fatGoal,
      };
    }

    const { passwordHash: _, stripeCustomerId: _s, stripeSubscriptionId: _si, paymentFailedAt: _p, provider: _pr, providerId: _pid, managedByNutritionistId: _mn, ...safeClient } = client;

    const reportData = {
      client: {
        name: safeClient.name,
        email: safeClient.email,
        preferences: safeClient.preferences,
        createdAt: safeClient.createdAt,
      },
      period: { fromDate: input.fromDate, toDate: input.toDate, totalDays },
      targets: effectiveTargets,
      overrides: overrides ? {
        dailyCalories: overrides.dailyCalories,
        proteinGoal: overrides.proteinGoal,
        carbsGoal: overrides.carbsGoal,
        fatGoal: overrides.fatGoal,
        rationale: overrides.rationale,
      } : null,
      latestCalculation: latestCalc ? {
        goal: latestCalc.goal,
        activityLevel: latestCalc.activityLevel,
        dailyCalories: latestCalc.dailyCalories,
        proteinGoal: latestCalc.proteinGoal,
        carbsGoal: latestCalc.carbsGoal,
        fatGoal: latestCalc.fatGoal,
      } : null,
      weightTrend,
      avgIntake,
      intakeVsTargets,
      adherenceScore,
      daysLogged,
      totalDays,
      clinicalNotes: periodNotes,
      goalSummary: relationship.goalSummary,
      healthNotes: relationship.healthNotes,
      goalProgress,
    };

    const title = input.title ?? `Progress Report — ${safeClient.name} (${input.fromDate} to ${input.toDate})`;

    const report = await storage.createClientReport(userId, clientId, {
      title,
      fromDate: input.fromDate,
      toDate: input.toDate,
      clinicalSummary: input.clinicalSummary ?? null,
      reportData,
    });

    res.status(201).json(report);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    console.error("[nutritionist] Report generation error:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

router.patch("/api/nutritionist/clients/:clientId/reports/:reportId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const reportId = parseInt(req.params.reportId);
  if (isNaN(clientId) || isNaN(reportId)) return res.status(400).json({ message: "Invalid ID" });

  const updateSchema = z.object({
    clinicalSummary: z.string().max(5000).nullable().optional(),
    title: z.string().min(1).max(200).optional(),
  });

  try {
    const updates = updateSchema.parse(req.body);
    const existing = await storage.getClientReportById(reportId, userId);
    if (!existing || existing.clientId !== clientId) return res.status(404).json({ message: "Report not found" });
    const updated = await storage.updateClientReport(reportId, userId, updates);
    if (!updated) return res.status(404).json({ message: "Report not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    res.status(500).json({ message: "Failed to update report" });
  }
});

router.delete("/api/nutritionist/clients/:clientId/reports/:reportId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const reportId = parseInt(req.params.reportId);
  if (isNaN(clientId) || isNaN(reportId)) return res.status(400).json({ message: "Invalid ID" });

  const existing = await storage.getClientReportById(reportId, userId);
  if (!existing || existing.clientId !== clientId) return res.status(404).json({ message: "Report not found" });

  await storage.deleteClientReport(reportId, userId);
  res.json({ success: true });
});

// ─── Client Metrics (Outcome Tracking) ───────────────────────────────────────

router.get("/api/nutritionist/clients/:clientId/metrics", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const metrics = await storage.getClientMetrics(userId, clientId);
  res.json(metrics);
});

router.post("/api/nutritionist/clients/:clientId/metrics", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const schema = z.object({
    metricType: z.enum(["weight", "body_fat", "waist_circumference", "blood_pressure_systolic", "blood_pressure_diastolic", "blood_glucose", "custom"]),
    customLabel: z.string().max(100).optional(),
    value: z.string().min(1),
    unit: z.string().max(50).optional(),
    notes: z.string().max(500).optional(),
    recordedAt: z.string().optional(),
  });

  try {
    const data = schema.parse(req.body);
    const metric = await storage.createClientMetric(userId, clientId, {
      ...data,
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
    });
    res.status(201).json(metric);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

// ─── Re-engagement Sequences ─────────────────────────────────────────────────

router.get("/api/nutritionist/reengagement/sequences", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const sequences = await storage.getReengagementSequences(userId);
  res.json(sequences);
});

router.post("/api/nutritionist/reengagement/sequences", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  try {
    const data = insertReengagementSequenceSchema.parse(req.body);
    const sequence = await storage.createReengagementSequence(userId, data);
    res.status(201).json(sequence);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.delete("/api/nutritionist/clients/:clientId/metrics/:metricId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const metricId = parseInt(req.params.metricId);
  if (isNaN(clientId) || isNaN(metricId)) return res.status(400).json({ message: "Invalid ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  await storage.deleteClientMetric(metricId, userId, clientId);
  res.json({ success: true });
});

// ─── Client-facing Metrics ────────────────────────────────────────────────────

router.get("/api/my-nutritionist/metrics", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const metrics = await storage.getClientMetricsByClientId(userId);
  res.json(metrics);
});

// ─── Client Tags & Segmentation ──────────────────────────────────────────────

router.get("/api/nutritionist/tags", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const tags = await storage.getTagsWithClientCounts(userId);
  res.json(tags);
});

router.post("/api/nutritionist/tags", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const schema = z.object({ name: z.string().min(1).max(50), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() });
  try {
    const { name, color } = schema.parse(req.body);
    const tag = await storage.createClientTag(userId, { name, color });
    res.status(201).json(tag);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to create tag" });
  }
});

router.put("/api/nutritionist/tags/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid tag ID" });
  const schema = z.object({ name: z.string().min(1).max(50).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() });
  try {
    const data = schema.parse(req.body);
    const updated = await storage.updateClientTag(id, userId, data);
    if (!updated) return res.status(404).json({ message: "Tag not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update tag" });
  }
});

router.delete("/api/nutritionist/tags/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid tag ID" });
  await storage.deleteClientTag(id, userId);
  res.json({ success: true });
});

router.get("/api/nutritionist/tags/:id/clients", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid tag ID" });
  const clients = await storage.getClientsByTag(userId, id);
  res.json(clients);
});

router.get("/api/nutritionist/clients/:clientId/tags", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });
  const tags = await storage.getTagAssignmentsForClient(userId, clientId);
  res.json(tags);
});

router.put("/api/nutritionist/clients/:clientId/tags", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });
  const schema = z.object({ tagIds: z.array(z.number().int()) });
  try {
    const { tagIds } = schema.parse(req.body);
    await storage.setClientTags(userId, clientId, tagIds);
    const updated = await storage.getTagAssignmentsForClient(userId, clientId);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update client tags" });
  }
});

router.post("/api/nutritionist/segments/bulk-message", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const schema = z.object({
    clientIds: z.array(z.number().int()).min(1, "Select at least one client"),
    message: z.string().min(1, "Message cannot be empty").max(5000),
    tagId: z.number().int().optional(),
  });

  try {
    const { clientIds, message, tagId } = schema.parse(req.body);

    const clients = await storage.getNutritionistClients(userId);
    const validClientIds = clients.map(c => c.clientId);
    const filteredIds = clientIds.filter(id => validClientIds.includes(id));
    if (filteredIds.length === 0) return res.status(400).json({ message: "None of the selected clients are in your roster." });

    for (const clientId of filteredIds) {
      await storage.createMessage(userId, clientId, userId, message);
    }

    const log = await storage.createBulkActionLog(userId, "bulk_message", filteredIds, tagId ?? null, { message });
    res.status(201).json({ success: true, sentTo: filteredIds.length, logId: log.id });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to send bulk message" });
  }
});

router.post("/api/nutritionist/segments/bulk-assign-template", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const schema = z.object({
    clientIds: z.array(z.number().int()).min(1, "Select at least one client"),
    templateId: z.number().int().positive("Template ID is required"),
    tagId: z.number().int().optional(),
  });

  try {
    const { clientIds, templateId, tagId } = schema.parse(req.body);

    const template = await storage.getPlanTemplates(userId);
    const tpl = template.find(t => t.id === templateId);
    if (!tpl) return res.status(404).json({ message: "Template not found" });

    const clients = await storage.getNutritionistClients(userId);
    const validClientIds = clients.map(c => c.clientId);
    const filteredIds = clientIds.filter(id => validClientIds.includes(id));
    if (filteredIds.length === 0) return res.status(400).json({ message: "None of the selected clients are in your roster." });

    for (const clientId of filteredIds) {
      await storage.createNutritionistPlan({
        nutritionistId: userId,
        clientId,
        name: tpl.name,
        planType: tpl.planType as "daily" | "weekly",
        planData: tpl.planData as Record<string, unknown>,
        status: "draft",
        promptNote: null,
        scheduledDeliverAt: null,
      });
    }

    const log = await storage.createBulkActionLog(userId, "bulk_assign_template", filteredIds, tagId ?? null, { templateId, templateName: tpl.name });
    res.status(201).json({ success: true, assignedTo: filteredIds.length, logId: log.id });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to bulk assign template" });
  }
});

router.get("/api/nutritionist/bulk-action-logs", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const logs = await storage.getBulkActionLogs(userId, limit);
  res.json(logs);
});

router.put("/api/nutritionist/reengagement/sequences/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
  try {
    const data = insertReengagementSequenceSchema.partial().parse(req.body);
    const updated = await storage.updateReengagementSequence(id, userId, data);
    if (!updated) return res.status(404).json({ message: "Sequence not found" });
    res.json(updated);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.delete("/api/nutritionist/reengagement/sequences/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
  await storage.deleteReengagementSequence(id, userId);
  res.json({ success: true });
});

// ─── Active Re-engagement Jobs ────────────────────────────────────────────────

router.get("/api/nutritionist/reengagement/jobs", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const jobs = await storage.getActiveReengagementJobs(userId);
  res.json(jobs);
});

router.get("/api/nutritionist/clients/:clientId/reengagement", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });
  const job = await storage.getActiveReengagementJobByClient(userId, clientId);
  res.json(job ?? null);
});

router.post("/api/nutritionist/clients/:clientId/reengagement/start", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const schema = z.object({ sequenceId: z.number().int().positive() });
  try {
    const { sequenceId } = schema.parse(req.body);
    const sequence = await storage.getReengagementSequenceById(sequenceId, userId);
    if (!sequence) return res.status(404).json({ message: "Sequence not found" });
    const messages = sequence.messages as { delayDays: number; body: string }[];
    if (!messages || messages.length === 0) return res.status(400).json({ message: "Sequence has no messages" });
    const firstMsg = messages[0];
    const nextSendAt = new Date(Date.now() + firstMsg.delayDays * 24 * 60 * 60 * 1000);
    const job = await storage.createActiveReengagementJob(userId, clientId, sequenceId, nextSendAt);
    res.status(201).json(job);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.post("/api/nutritionist/clients/:clientId/reengagement/pause", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });
  const job = await storage.getActiveReengagementJobByClient(userId, clientId);
  if (!job) return res.status(404).json({ message: "No active sequence for this client" });
  const updated = await storage.updateActiveReengagementJob(job.id, { status: "paused" });
  res.json(updated);
});

router.post("/api/nutritionist/clients/:clientId/reengagement/resume", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });
  const job = await storage.getActiveReengagementJobByClient(userId, clientId);
  if (!job) return res.status(404).json({ message: "No sequence found for this client" });
  const updated = await storage.updateActiveReengagementJob(job.id, { status: "active" });
  res.json(updated);
});

router.post("/api/nutritionist/clients/:clientId/reengagement/cancel", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });
  const job = await storage.getActiveReengagementJobByClient(userId, clientId);
  if (!job) return res.status(404).json({ message: "No sequence found for this client" });
  const updated = await storage.updateActiveReengagementJob(job.id, { status: "cancelled" });
  res.json(updated);
});

// ─── Document Vault ───────────────────────────────────────────────────────────

router.get("/api/nutritionist/clients/:clientId/documents", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const { rows } = await pool.query(
    `SELECT cd.*, u.name AS uploader_name, u.email AS uploader_email
     FROM client_documents cd
     JOIN users u ON u.id = cd.uploader_id
     WHERE cd.nutritionist_id = $1 AND cd.client_id = $2
     ORDER BY cd.created_at DESC`,
    [userId, clientId],
  );
  res.json(rows.map((r: any) => ({
    id: r.id,
    nutritionistId: r.nutritionist_id,
    clientId: r.client_id,
    uploaderId: r.uploader_id,
    uploaderName: r.uploader_name,
    uploaderEmail: r.uploader_email,
    filename: r.filename,
    storagePath: r.storage_path,
    mimeType: r.mime_type,
    size: r.size,
    sharedWithClient: r.shared_with_client,
    createdAt: r.created_at,
  })));
});

router.post("/api/nutritionist/clients/:clientId/documents", upload.single("file"), async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const sharedWithClient = req.body.sharedWithClient === "true";

  try {
    const doc = await storage.createClientDocument({
      nutritionistId: userId,
      clientId,
      uploaderId: userId,
      filename: req.file.originalname,
      storagePath: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      sharedWithClient,
    });
    res.status(201).json(doc);
  } catch (err) {
    if (req.file) {
      fs.unlink(path.join(UPLOADS_DIR, req.file.filename), () => {});
    }
    res.status(500).json({ message: "Failed to save document" });
  }
});

router.patch("/api/nutritionist/clients/:clientId/documents/:docId/sharing", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const docId = parseInt(req.params.docId);
  if (isNaN(clientId) || isNaN(docId)) return res.status(400).json({ message: "Invalid ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const schema = z.object({ sharedWithClient: z.boolean() });
  try {
    const { sharedWithClient } = schema.parse(req.body);
    const updated = await storage.toggleClientDocumentSharing(docId, userId, sharedWithClient);
    if (!updated) return res.status(404).json({ message: "Document not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input" });
    res.status(500).json({ message: "Failed to update sharing" });
  }
});

router.delete("/api/nutritionist/clients/:clientId/documents/:docId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const docId = parseInt(req.params.docId);
  if (isNaN(clientId) || isNaN(docId)) return res.status(400).json({ message: "Invalid ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const doc = await storage.getClientDocumentById(docId);
  if (!doc || doc.nutritionistId !== userId || doc.clientId !== clientId) {
    return res.status(404).json({ message: "Document not found" });
  }

  await storage.deleteClientDocument(docId, userId);
  fs.unlink(path.join(UPLOADS_DIR, doc.storagePath), () => {});
  res.json({ success: true });
});

router.get("/api/nutritionist/clients/:clientId/documents/:docId/download", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const clientId = parseInt(req.params.clientId);
  const docId = parseInt(req.params.docId);
  if (isNaN(clientId) || isNaN(docId)) return res.status(400).json({ message: "Invalid ID" });

  const relationship = await storage.getNutritionistClientByClientId(userId, clientId);
  if (!relationship) return res.status(403).json({ message: "This client is not linked to your practice." });

  const doc = await storage.getClientDocumentById(docId);
  if (!doc || doc.nutritionistId !== userId || doc.clientId !== clientId) {
    return res.status(404).json({ message: "Document not found" });
  }

  const filePath = path.join(UPLOADS_DIR, doc.storagePath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found on disk" });

  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.filename)}"`);
  res.setHeader("Content-Type", doc.mimeType);
  fs.createReadStream(filePath).pipe(res);
});

// ─── Client-facing document endpoints ────────────────────────────────────────

router.get("/api/client/documents", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const user = await storage.getUserById(userId);
  if (!user || !user.isManagedClient || !user.managedByNutritionistId) {
    return res.status(403).json({ message: "You are not a managed client." });
  }

  const docs = await storage.getSharedDocumentsForClient(userId, user.managedByNutritionistId);
  res.json(docs);
});

router.get("/api/client/documents/:docId/download", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const user = await storage.getUserById(userId);
  if (!user || !user.isManagedClient || !user.managedByNutritionistId) {
    return res.status(403).json({ message: "You are not a managed client." });
  }

  const docId = parseInt(req.params.docId);
  if (isNaN(docId)) return res.status(400).json({ message: "Invalid document ID" });

  const doc = await storage.getClientDocumentById(docId);
  if (!doc || doc.clientId !== userId || doc.nutritionistId !== user.managedByNutritionistId || !doc.sharedWithClient) {
    return res.status(404).json({ message: "Document not found" });
  }

  const filePath = path.join(UPLOADS_DIR, doc.storagePath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found on disk" });

  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.filename)}"`);
  res.setHeader("Content-Type", doc.mimeType);
  fs.createReadStream(filePath).pipe(res);
});

// ─── Waitlist ─────────────────────────────────────────────────────────────────

router.get("/api/nutritionist/waitlist", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const entries = await storage.getWaitlistEntries(userId);
  res.json(entries);
});

router.post("/api/nutritionist/waitlist", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const schema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    notes: z.string().max(2000).optional(),
  });

  try {
    const data = schema.parse(req.body);
    const entry = await storage.addWaitlistEntry(userId, data);
    res.status(201).json(entry);
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.put("/api/nutritionist/waitlist/reorder", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const schema = z.object({ orderedIds: z.array(z.number().int()) });
  try {
    const { orderedIds } = schema.parse(req.body);
    await storage.reorderWaitlistEntries(userId, orderedIds);
    res.json({ success: true });
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.post("/api/nutritionist/waitlist/:id/invite", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

  const entry = await storage.getWaitlistEntryById(id, userId);
  if (!entry) return res.status(404).json({ message: "Waitlist entry not found." });
  if (entry.status !== "waiting") return res.status(400).json({ message: "This prospect has already been invited or converted." });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = await storage.createNutritionistInvitation(userId, entry.email, token, expiresAt);
  const inviteUrl = `${req.protocol}://${req.get("host")}/auth?tab=register&nutritionist_invite=${token}`;

  await storage.updateWaitlistEntry(id, userId, { status: "invited", invitedAt: new Date() });

  const nutritionistUser = await storage.getUserById(userId);
  const nutritionistName = nutritionistUser?.name ?? "Your nutritionist";

  try {
    await sendEmail({
      to: entry.email,
      subject: `${nutritionistName} has invited you to join FuelU`,
      html: buildWaitlistInviteEmailHtml({
        prospectName: entry.name,
        nutritionistName,
        inviteUrl,
      }),
    });
  } catch (emailErr) {
    console.error("[waitlist] Email send failed:", emailErr);
  }

  res.json({ ...invitation, inviteUrl });
});

router.delete("/api/nutritionist/waitlist/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile." });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

  await storage.removeWaitlistEntry(id, userId);
  res.json({ success: true });
});

// Public waitlist sign-up (no auth required)
router.get("/api/public/waitlist/:nutritionistId", async (req, res) => {
  const nutritionistId = parseInt(req.params.nutritionistId);
  if (isNaN(nutritionistId)) return res.status(400).json({ message: "Invalid nutritionist ID" });

  const nutritionist = await storage.getNutritionistByIdPublic(nutritionistId);
  if (!nutritionist) return res.status(404).json({ message: "Nutritionist not found." });

  res.json({ id: nutritionist.id, name: nutritionist.name });
});

router.post("/api/public/waitlist/:nutritionistId", async (req, res) => {
  const nutritionistId = parseInt(req.params.nutritionistId);
  if (isNaN(nutritionistId)) return res.status(400).json({ message: "Invalid nutritionist ID" });

  const nutritionist = await storage.getNutritionistByIdPublic(nutritionistId);
  if (!nutritionist) return res.status(404).json({ message: "Nutritionist not found." });

  const schema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    notes: z.string().max(2000).optional(),
  });

  try {
    const data = schema.parse(req.body);
    const entry = await storage.addWaitlistEntry(nutritionistId, data);
    res.status(201).json({ success: true, id: entry.id });
  } catch (err) {
    if (isZodError(err)) return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }

export default router;
