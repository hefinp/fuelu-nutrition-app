import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

router.get("/api/hydration", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const date = z.string().min(1).parse(req.query.date as string);
  const logs = await storage.getHydrationLogs(req.session.userId, date);
  const totalMl = logs.reduce((sum, l) => sum + l.amountMl, 0);
  res.json({ logs, totalMl });
});

router.post("/api/hydration", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      date: z.string().min(1),
      amountMl: z.number().int().min(1).max(5000),
    }).parse(req.body);
    const log = await storage.createHydrationLog({ ...body, userId: req.session.userId });
    res.status(201).json(log);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.delete("/api/hydration/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  await storage.deleteHydrationLog(id, req.session.userId);
  res.status(204).send();
});

export default router;
