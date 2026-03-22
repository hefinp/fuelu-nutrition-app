import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

function requireAuth(req: Request, res: Response): number | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return userId;
}

router.get("/api/practice", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const asAdmin = await storage.getPracticeByAdmin(userId);
  if (asAdmin) return res.json({ ...asAdmin, role: "admin" });

  const asMember = await storage.getPracticeByMember(userId);
  if (asMember) return res.json({ ...asMember, role: "member" });

  res.json(null);
});

router.post("/api/practice", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profile = await storage.getNutritionistProfile(userId);
  if (!profile) return res.status(403).json({ message: "You must have a nutritionist profile to create a practice." });
  if (profile.tier !== "practice") return res.status(403).json({ message: "You must be on the practice tier to create a practice account." });

  const existing = await storage.getPracticeByAdmin(userId);
  if (existing) return res.status(409).json({ message: "You already have a practice account." });

  const schema = z.object({
    name: z.string().min(2).max(200),
    maxSeats: z.number().int().min(2).max(100).optional(),
  });
  try {
    const { name, maxSeats } = schema.parse(req.body);
    const practice = await storage.createPracticeAccount(userId, name, maxSeats ?? 5);
    await storage.addPracticeMember(practice.id, userId, "admin");
    res.status(201).json({ ...practice, role: "admin" });
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.put("/api/practice/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid practice ID" });

  const practice = await storage.getPracticeById(id);
  if (!practice) return res.status(404).json({ message: "Practice not found" });
  if (practice.adminUserId !== userId) return res.status(403).json({ message: "Only the practice admin can update practice settings." });

  const schema = z.object({
    name: z.string().min(2).max(200).optional(),
    maxSeats: z.number().int().min(1).max(100).optional(),
  });
  try {
    const updates = schema.parse(req.body);
    const updated = await storage.updatePracticeAccount(id, updates);
    res.json(updated);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.get("/api/practice/:id/members", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid practice ID" });

  const practice = await storage.getPracticeById(id);
  if (!practice) return res.status(404).json({ message: "Practice not found" });

  const isMember = await storage.getPracticeMemberByNutritionist(id, userId);
  if (!isMember && practice.adminUserId !== userId) {
    return res.status(403).json({ message: "Not a member of this practice." });
  }

  const members = await storage.getPracticeMembers(id);
  res.json(members);
});

router.get("/api/practice/lookup-nutritionist", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const email = String(req.query.email ?? "").trim().toLowerCase();
  if (!email) return res.status(400).json({ message: "Email is required" });

  const targetUser = await storage.getUserByEmail(email);
  if (!targetUser) return res.status(404).json({ message: "No user found with that email address" });

  const targetProfile = await storage.getNutritionistProfile(targetUser.id);
  if (!targetProfile) return res.status(404).json({ message: "That user does not have a nutritionist profile" });

  res.json({ id: targetUser.id, name: targetUser.name, email: targetUser.email, profile: targetProfile });
});

router.post("/api/practice/:id/members", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid practice ID" });

  const practice = await storage.getPracticeById(id);
  if (!practice) return res.status(404).json({ message: "Practice not found" });
  if (practice.adminUserId !== userId) return res.status(403).json({ message: "Only the practice admin can add members." });

  const schema = z.object({
    nutritionistUserId: z.number().int(),
    role: z.enum(["admin", "member"]).default("member"),
  });

  try {
    const { nutritionistUserId, role } = schema.parse(req.body);

    const currentMembers = await storage.getPracticeMembers(id);
    if (currentMembers.length >= practice.maxSeats) {
      return res.status(403).json({ message: `Practice seat limit reached (${practice.maxSeats}). Increase max seats first.` });
    }

    const existing = await storage.getPracticeMemberByNutritionist(id, nutritionistUserId);
    if (existing) return res.status(409).json({ message: "This nutritionist is already a member of this practice." });

    const targetProfile = await storage.getNutritionistProfile(nutritionistUserId);
    if (!targetProfile) return res.status(404).json({ message: "Target user does not have a nutritionist profile." });

    const member = await storage.addPracticeMember(id, nutritionistUserId, role);
    await storage.updateNutritionistProfile(nutritionistUserId, { tier: "practice" });
    res.status(201).json(member);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.put("/api/practice/:id/members/:nutritionistUserId/role", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  const nutritionistUserId = parseInt(req.params.nutritionistUserId);
  if (isNaN(id) || isNaN(nutritionistUserId)) return res.status(400).json({ message: "Invalid ID" });

  const practice = await storage.getPracticeById(id);
  if (!practice) return res.status(404).json({ message: "Practice not found" });
  if (practice.adminUserId !== userId) return res.status(403).json({ message: "Only the practice admin can change roles." });

  const schema = z.object({ role: z.enum(["admin", "member"]) });
  try {
    const { role } = schema.parse(req.body);
    const updated = await storage.updatePracticeMemberRole(id, nutritionistUserId, role);
    if (!updated) return res.status(404).json({ message: "Member not found" });
    res.json(updated);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

router.delete("/api/practice/:id/members/:nutritionistUserId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  const nutritionistUserId = parseInt(req.params.nutritionistUserId);
  if (isNaN(id) || isNaN(nutritionistUserId)) return res.status(400).json({ message: "Invalid ID" });

  const practice = await storage.getPracticeById(id);
  if (!practice) return res.status(404).json({ message: "Practice not found" });
  if (practice.adminUserId !== userId) return res.status(403).json({ message: "Only the practice admin can remove members." });
  if (nutritionistUserId === userId) return res.status(400).json({ message: "Practice admin cannot remove themselves." });

  await storage.removePracticeMember(id, nutritionistUserId);
  await storage.updateNutritionistProfile(nutritionistUserId, { tier: "professional" });
  res.json({ success: true });
});

router.get("/api/practice/:id/capacity", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid practice ID" });

  const practice = await storage.getPracticeById(id);
  if (!practice) return res.status(404).json({ message: "Practice not found" });

  const isMember = await storage.getPracticeMemberByNutritionist(id, userId);
  if (!isMember && practice.adminUserId !== userId) {
    return res.status(403).json({ message: "Not a member of this practice." });
  }

  const stats = await storage.getCapacityStatsByPractice(id);
  res.json(stats);
});

router.get("/api/practice/:id/clients", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid practice ID" });

  const practice = await storage.getPracticeById(id);
  if (!practice) return res.status(404).json({ message: "Practice not found" });

  const isMember = await storage.getPracticeMemberByNutritionist(id, userId);
  if (!isMember && practice.adminUserId !== userId) {
    return res.status(403).json({ message: "Not a member of this practice." });
  }

  const members = await storage.getPracticeMembers(id);
  const allClients: Array<{
    nutritionistId: number;
    nutritionistName: string;
    clients: Awaited<ReturnType<typeof storage.getNutritionistClients>>;
  }> = [];

  for (const member of members) {
    const clients = await storage.getNutritionistClients(member.nutritionistUserId);
    allClients.push({
      nutritionistId: member.nutritionistUserId,
      nutritionistName: member.nutritionist.name,
      clients,
    });
  }

  res.json(allClients);
});

router.post("/api/practice/:id/reassign-client", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid practice ID" });

  const practice = await storage.getPracticeById(id);
  if (!practice) return res.status(404).json({ message: "Practice not found" });
  if (practice.adminUserId !== userId) return res.status(403).json({ message: "Only the practice admin can reassign clients." });

  const schema = z.object({
    clientId: z.number().int(),
    fromNutritionistId: z.number().int(),
    toNutritionistId: z.number().int(),
  });

  try {
    const { clientId, fromNutritionistId, toNutritionistId } = schema.parse(req.body);

    const fromMember = await storage.getPracticeMemberByNutritionist(id, fromNutritionistId);
    const toMember = await storage.getPracticeMemberByNutritionist(id, toNutritionistId);
    if (!fromMember || !toMember) return res.status(403).json({ message: "Both nutritionists must be members of this practice." });

    const clientRecord = await storage.getNutritionistClientByClientId(fromNutritionistId, clientId);
    if (!clientRecord) return res.status(404).json({ message: "Client not found under the source nutritionist." });

    await storage.removeNutritionistClient(clientRecord.id, fromNutritionistId);
    const newRecord = await storage.addNutritionistClient(toNutritionistId, clientId, {
      status: clientRecord.status,
      goalSummary: clientRecord.goalSummary ?? undefined,
    });
    await storage.setManagedClientFlag(clientId, true, toNutritionistId);
    res.json(newRecord);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ message: "Invalid input", errors: err.errors });
    throw err;
  }
});

export default router;
