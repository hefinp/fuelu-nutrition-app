import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import type { UserPreferences } from "@shared/schema";
import { searchMedicalLiterature } from "../ai-research";

const router = Router();

const cycleTipCache = new Map<string, { tip: string; source: { title: string; url: string } | null }>();

router.get("/api/cycle/daily-tip", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI unavailable" });

  const phase = z.enum(["menstrual", "follicular", "ovulatory", "luteal"]).parse(req.query.phase);
  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `${phase}:${today}`;

  if (cycleTipCache.has(cacheKey)) {
    const cached = cycleTipCache.get(cacheKey)!;
    return res.json({ ...cached, cached: true });
  }

  try {
    const phaseNames: Record<string, string> = {
      menstrual: "menstrual (days 1–5, low hormones, iron/magnesium focus)",
      follicular: "follicular (days 6–13, rising oestrogen, light foods focus)",
      ovulatory: "ovulatory (days 14–16, peak energy, antioxidants focus)",
      luteal: "luteal (days 17–28, progesterone rise, complex carbs/B6 focus)",
    };
    const prompt = `You are a women's health nutrition assistant. Give one practical, specific nutrition tip (2 sentences max) for a woman in the ${phaseNames[phase]} phase of her menstrual cycle. Name one specific food or nutrient backed by research. Find a supporting study from PubMed or a reputable nutrition journal. Be warm and actionable. Plain text only, no markdown, no bullet points.`;

    const result = await searchMedicalLiterature(prompt);
    const tip = result.text.trim();
    const source = result.sources[0] ?? null;
    const cacheValue = { tip, source };
    cycleTipCache.set(cacheKey, cacheValue);
    res.json({ ...cacheValue, cached: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate tip" });
  }
});

async function recomputeAllCycleLengths(userId: number): Promise<void> {
  const logs = await storage.getCyclePeriodLogs(userId);
  for (let i = 0; i < logs.length; i++) {
    const current = logs[i];
    const next = logs[i + 1];
    let computedLen: number | null = null;
    if (next) {
      const curr = new Date(current.periodStartDate + "T00:00:00");
      const prev = new Date(next.periodStartDate + "T00:00:00");
      const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 14 && diff < 60) computedLen = diff;
    }
    if (computedLen !== current.computedCycleLength) {
      await storage.updateCyclePeriodLog(current.id, userId, { computedCycleLength: computedLen });
    }
  }
}

async function syncPrefsFromPeriodLogs(userId: number): Promise<void> {
  await recomputeAllCycleLengths(userId);
  const logs = await storage.getCyclePeriodLogs(userId);
  const user = await storage.getUserById(userId);
  const currentPrefs: UserPreferences = (user as any)?.preferences ?? {};
  if (logs.length === 0) {
    await storage.updateUserPreferences(userId, { ...currentPrefs, lastPeriodDate: undefined, cycleLength: undefined });
    return;
  }
  const updates: Partial<UserPreferences> = { lastPeriodDate: logs[0].periodStartDate };
  const withLen = logs.filter(l => l.computedCycleLength != null).slice(0, 3);
  if (withLen.length >= 2) {
    updates.cycleLength = Math.round(
      withLen.reduce((s, l) => s + l.computedCycleLength!, 0) / withLen.length
    );
  }
  await storage.updateUserPreferences(userId, { ...currentPrefs, ...updates });
}

router.get("/api/cycle/periods", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const logs = await storage.getCyclePeriodLogs(req.session.userId);
  res.json(logs);
});

router.post("/api/cycle/periods", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      periodStartDate: z.string().min(1),
      periodEndDate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(req.body);

    const log = await storage.createCyclePeriodLog({
      userId: req.session.userId,
      periodStartDate: body.periodStartDate,
      periodEndDate: body.periodEndDate ?? null,
      computedCycleLength: null,
      notes: body.notes ?? null,
    });

    await syncPrefsFromPeriodLogs(req.session.userId);
    res.status(201).json(log);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.patch("/api/cycle/periods/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const body = z.object({
      periodStartDate: z.string().optional().nullable(),
      periodEndDate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(req.body);
    const updates: { periodStartDate?: string; periodEndDate?: string | null; notes?: string | null } = {};
    if (body.periodEndDate !== undefined) updates.periodEndDate = body.periodEndDate;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.periodStartDate) updates.periodStartDate = body.periodStartDate;
    const updated = await storage.updateCyclePeriodLog(id, req.session.userId, updates);
    if (!updated) return res.status(404).json({ message: "Not found" });
    await syncPrefsFromPeriodLogs(req.session.userId);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.delete("/api/cycle/periods/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  await storage.deleteCyclePeriodLog(id, req.session.userId);
  await syncPrefsFromPeriodLogs(req.session.userId);
  res.json({ success: true });
});

router.delete("/api/user/cycle-data", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  await storage.deleteAllCycleData(req.session.userId);
  res.json({ ok: true });
});

export function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export function getCycleDay(dateStr: string, periods: { periodStartDate: string }[], prefs: UserPreferences): number | null {
  const sorted = [...periods]
    .filter(p => p.periodStartDate <= dateStr)
    .sort((a, b) => b.periodStartDate.localeCompare(a.periodStartDate));
  if (sorted.length > 0) {
    const start = new Date(sorted[0].periodStartDate + "T00:00:00");
    const date = new Date(dateStr + "T00:00:00");
    return Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;
  }
  if (prefs?.lastPeriodDate) {
    const start = new Date(prefs.lastPeriodDate + "T00:00:00");
    const date = new Date(dateStr + "T00:00:00");
    const diff = Math.floor((date.getTime() - start.getTime()) / 86400000);
    const cl = prefs.cycleLength ?? 28;
    return (((diff % cl) + cl) % cl) + 1;
  }
  return null;
}

export function energyScore(v: string | null | undefined): number | null {
  if (v === "high") return 3; if (v === "medium") return 2; if (v === "low") return 1; return null;
}
export function moodScore(v: string | null | undefined): number | null {
  if (v === "balanced") return 3; if (v === "anxious") return 2; if (v === "low") return 1; return null;
}
export function getMostCommon(arr: (string | null | undefined)[]): string | null {
  const counts: Record<string, number> = {};
  for (const v of arr) { if (v) counts[v] = (counts[v] ?? 0) + 1; }
  let best: string | null = null, bestN = 0;
  for (const [k, n] of Object.entries(counts)) { if (n > bestN) { best = k; bestN = n; } }
  return best;
}


router.get("/api/cycle/symptoms", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const { from, to } = z.object({
      from: z.string().min(1),
      to: z.string().min(1),
    }).parse(req.query);
    const symptoms = await storage.getCycleSymptoms(req.session.userId, from, to);
    res.json(symptoms);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.post("/api/cycle/symptoms", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      date: z.string().min(1),
      energy: z.enum(["low", "medium", "high"]).nullable().optional(),
      bloating: z.enum(["none", "mild", "severe"]).nullable().optional(),
      cravings: z.enum(["none", "sweet", "salty", "both"]).nullable().optional(),
      mood: z.enum(["balanced", "anxious", "low"]).nullable().optional(),
      appetite: z.enum(["low", "normal", "high"]).nullable().optional(),
    }).parse(req.body);
    const symptom = await storage.upsertCycleSymptom({ ...body, userId: req.session.userId });
    res.status(201).json(symptom);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

export default router;
