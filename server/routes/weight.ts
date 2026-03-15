import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

router.get("/api/weight-entries", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const entries = await storage.getWeightEntries(req.session.userId);
  res.status(200).json(entries);
});

router.post("/api/weight-entries", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  try {
    const body = z.object({
      weight: z.string().min(1),
      recordedAt: z.string().optional(),
    }).parse(req.body);
    const entry = await storage.createWeightEntry({
      userId: req.session.userId,
      weight: body.weight,
      recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
    });
    res.status(201).json(entry);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

router.delete("/api/weight-entries/:id", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const id = parseInt(req.params.id);
  await storage.deleteWeightEntry(id, req.session.userId);
  res.status(204).send();
});

export default router;
