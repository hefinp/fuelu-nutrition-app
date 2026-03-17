import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage";
import { insertNutritionistProfileSchema, insertNutritionistNoteSchema, nutritionistTierLimits, type NutritionistTier } from "@shared/schema";

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
    const entry = await storage.addNutritionistClient(req.session.userId!, clientUser.id, notes);
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
    const updated = await storage.updateNutritionistClientNotes(req.session.userId!, clientId, notes);
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

    const clientUser = clientEntry.client;
    const clientPrefs = (clientUser.preferences as UserPreferences | null) ?? {};
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
      `Client name: ${clientUser.name}`,
      latestCalc ? `Daily calorie target: ${latestCalc.dailyCalories} kcal` : null,
      latestCalc ? `Protein: ${latestCalc.proteinGoal}g, Carbs: ${latestCalc.carbsGoal}g, Fat: ${latestCalc.fatGoal}g` : null,
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
      name: `AI Plan for ${clientUser.name}`,
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

router.get("/api/my-nutritionist-plans", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const plans = await storage.getDeliveredPlansForClient(req.session.userId);
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your plans" });
  }
});

export default router;
