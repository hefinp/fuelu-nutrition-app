import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

router.get("/api/my-foods", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const foods = await storage.getUserSavedFoods(req.session.userId);
    res.json(foods);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch saved foods" });
  }
});

router.post("/api/my-foods", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      name: z.string().min(1),
      calories100g: z.number().int().min(0),
      protein100g: z.number().min(0),
      carbs100g: z.number().min(0),
      fat100g: z.number().min(0),
      servingGrams: z.number().int().min(1).optional(),
    }).parse(req.body);
    const created = await storage.addUserSavedFood({ ...body, userId: req.session.userId });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to save food" });
  }
});

router.patch("/api/my-foods/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      name: z.string().min(1).optional(),
      calories100g: z.number().int().min(0).optional(),
      protein100g: z.number().min(0).optional(),
      carbs100g: z.number().min(0).optional(),
      fat100g: z.number().min(0).optional(),
      servingGrams: z.number().int().min(1).optional(),
    }).parse(req.body);
    const updated = await storage.updateUserSavedFood(Number(req.params.id), req.session.userId, body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update food" });
  }
});

router.delete("/api/my-foods/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    await storage.removeUserSavedFood(Number(req.params.id), req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove food" });
  }
});

export default router;
