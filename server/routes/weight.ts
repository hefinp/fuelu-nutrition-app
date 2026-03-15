import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
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

router.post("/api/weight/insights", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI unavailable" });

  const { entries, goal, targetWeight } = req.body as {
    entries: { date: string; weightKg: number }[];
    goal?: string;
    targetWeight?: number;
  };
  if (!entries || entries.length < 3) return res.status(400).json({ error: "Need at least 3 entries" });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const entrySummary = entries.map(e => `${e.date}: ${e.weightKg}kg`).join(", ");
    const prompt = `The user's weight log (oldest to newest): ${entrySummary}.${targetWeight ? ` Their goal weight is ${targetWeight}kg.` : ""}${goal ? ` Their goal is to ${goal}.` : ""}
Write 1-2 sentences analysing their trend: rate of change, whether they're on track, and one concrete actionable suggestion. Keep it encouraging and practical. Plain text, no markdown.`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.7,
    });
    const insight = resp.choices[0]?.message?.content?.trim() ?? "";
    res.json({ insight });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate insight" });
  }
});

export default router;
