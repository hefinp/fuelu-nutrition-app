import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import type { UserPreferences } from "@shared/schema";
import { searchMedicalLiterature } from "../ai-research";

const router = Router();

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function isPremium(user: { tier: string; betaUser: boolean }): boolean {
  return user.betaUser || user.tier !== "free";
}

async function requirePremiumVitality(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  if (!isPremium(user)) return res.status(403).json({ message: "Premium required" });
  const prefs = (user.preferences as Record<string, unknown> | null) ?? {};
  if (!prefs.vitalityInsightsEnabled) return res.status(403).json({ message: "Vitality tracking not enabled" });
  next();
}

router.get("/api/vitality/symptoms", requirePremiumVitality, async (req, res) => {
  try {
    const { from, to } = z.object({
      from: z.string().regex(DATE_REGEX, "Invalid date format (YYYY-MM-DD)"),
      to: z.string().regex(DATE_REGEX, "Invalid date format (YYYY-MM-DD)"),
    }).parse(req.query);
    const symptoms = await storage.getVitalitySymptoms(req.session.userId!, from, to);
    res.json(symptoms);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.post("/api/vitality/symptoms", requirePremiumVitality, async (req, res) => {
  try {
    const body = z.object({
      date: z.string().regex(DATE_REGEX, "Invalid date format (YYYY-MM-DD)"),
      energy: z.enum(["low", "medium", "high"]).nullable().optional(),
      motivation: z.enum(["low", "medium", "high"]).nullable().optional(),
      focus: z.enum(["low", "medium", "high"]).nullable().optional(),
      stress: z.enum(["low", "medium", "high"]).nullable().optional(),
      sleepQuality: z.enum(["poor", "fair", "good"]).nullable().optional(),
      libido: z.enum(["low", "normal", "high"]).nullable().optional(),
    }).parse(req.body);
    const symptom = await storage.upsertVitalitySymptom({ ...body, userId: req.session.userId! });
    res.status(201).json(symptom);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.delete("/api/user/vitality-data", requirePremiumVitality, async (req, res) => {
  await storage.deleteAllVitalityData(req.session.userId!);
  res.json({ ok: true });
});

const vitalityTipCache = new Map<string, { tip: string; source: { title: string; url: string } | null }>();

router.get("/api/vitality/daily-tip", requirePremiumVitality, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI unavailable" });

  const phase = z.enum(["morning", "afternoon", "evening"]).parse(req.query.phase);
  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `vitality:${phase}:${today}`;

  if (vitalityTipCache.has(cacheKey)) {
    const cached = vitalityTipCache.get(cacheKey)!;
    return res.json({ ...cached, cached: true });
  }

  try {
    const phaseNames: Record<string, string> = {
      morning: "morning (peak energy, cortisol awakening response, protein and zinc focus)",
      afternoon: "afternoon (energy plateau, sustained energy via complex carbs and healthy fats)",
      evening: "evening (recovery phase, magnesium and zinc for overnight recovery, sleep quality)",
    };
    const prompt = `You are a men's nutrition and wellbeing assistant. Give one practical, specific nutrition tip (2 sentences max) for a man during the ${phaseNames[phase]} phase of his daily energy rhythm. Name one specific food or nutrient backed by research. Find a supporting study from PubMed or a reputable nutrition journal. Be warm and actionable. Plain text only, no markdown, no bullet points.`;

    const result = await searchMedicalLiterature(prompt);
    const tip = result.text.trim();
    const source = result.sources[0] ?? null;
    const cacheValue = { tip, source };
    vitalityTipCache.set(cacheKey, cacheValue);
    res.json({ ...cacheValue, cached: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate tip" });
  }
});

function energyScore(v: string | null | undefined): number | null {
  if (v === "high") return 3; if (v === "medium") return 2; if (v === "low") return 1; return null;
}

function focusScore(v: string | null | undefined): number | null {
  if (v === "high") return 3; if (v === "medium") return 2; if (v === "low") return 1; return null;
}

function motivationScore(v: string | null | undefined): number | null {
  if (v === "high") return 3; if (v === "medium") return 2; if (v === "low") return 1; return null;
}

function stressScore(v: string | null | undefined): number | null {
  if (v === "low") return 3; if (v === "medium") return 2; if (v === "high") return 1; return null;
}

function sleepScore(v: string | null | undefined): number | null {
  if (v === "good") return 3; if (v === "fair") return 2; if (v === "poor") return 1; return null;
}

function getMostCommon(arr: (string | null | undefined)[]): string | null {
  const counts: Record<string, number> = {};
  for (const v of arr) { if (v) counts[v] = (counts[v] ?? 0) + 1; }
  let best: string | null = null, bestN = 0;
  for (const [k, n] of Object.entries(counts)) { if (n > bestN) { best = k; bestN = n; } }
  return best;
}

router.get("/api/vitality/insights", requirePremiumVitality, async (req, res) => {
  const userId = req.session.userId!;
  const today = new Date().toISOString().split("T")[0];
  const days = parseInt(req.query.days as string) || 90;
  const from = nDaysAgo(days);

  const [symptoms, foodLogs] = await Promise.all([
    storage.getVitalitySymptoms(userId, from, today),
    storage.getFoodLogEntriesRange(userId, from, today),
  ]);

  const daysLogged = symptoms.length;
  const hasEnoughData = daysLogged >= 7 && foodLogs.length >= 7;

  const trendData = symptoms.map(s => ({
    date: s.date,
    energy: energyScore(s.energy),
    focus: focusScore(s.focus),
    motivation: motivationScore(s.motivation),
  })).sort((a, b) => a.date.localeCompare(b.date));

  const symByDate: Record<string, typeof symptoms[0]> = {};
  for (const s of symptoms) symByDate[s.date] = s;
  const foodVitality: Record<string, { eSum: number; fSum: number; count: number; highEnergy: number; highFocus: number }> = {};
  for (const entry of foodLogs) {
    const sym = symByDate[entry.date]; if (!sym) continue;
    const es = energyScore(sym.energy);
    const fs = focusScore(sym.focus);
    if (es === null && fs === null) continue;
    const name = entry.mealName.toLowerCase().trim().split(" ").slice(0, 3).join(" ");
    if (!foodVitality[name]) foodVitality[name] = { eSum: 0, fSum: 0, count: 0, highEnergy: 0, highFocus: 0 };
    foodVitality[name].count++;
    if (es !== null) { foodVitality[name].eSum += es; if (es === 3) foodVitality[name].highEnergy++; }
    if (fs !== null) { foodVitality[name].fSum += fs; if (fs === 3) foodVitality[name].highFocus++; }
  }
  const allE = symptoms.filter(s => s.energy).map(s => energyScore(s.energy)!);
  const avgE = allE.length > 0 ? allE.reduce((a, b) => a + b, 0) / allE.length : 2;
  const foodCorrelations = Object.entries(foodVitality)
    .filter(([_, d]) => d.count >= 2 && d.eSum / d.count > avgE)
    .map(([food, d]) => ({
      food, count: d.count,
      avgEnergy: Math.round((d.eSum / d.count) * 10) / 10,
      avgFocus: d.fSum > 0 ? Math.round((d.fSum / d.count) * 10) / 10 : null,
      highEnergyRate: Math.round((d.highEnergy / d.count) * 100),
      highFocusRate: Math.round((d.highFocus / d.count) * 100),
    }))
    .sort((a, b) => b.avgEnergy - a.avgEnergy)
    .slice(0, 6);

  const weekFrom = nDaysAgo(6);
  const weekSym = symptoms.filter(s => s.date >= weekFrom);
  const weekSummary = {
    loggedDays: weekSym.length,
    topEnergy: getMostCommon(weekSym.map(s => s.energy)),
    topFocus: getMostCommon(weekSym.map(s => s.focus)),
    topMotivation: getMostCommon(weekSym.map(s => s.motivation)),
    topStress: getMostCommon(weekSym.map(s => s.stress)),
    topSleep: getMostCommon(weekSym.map(s => s.sleepQuality)),
  };

  res.json({ trendData, foodCorrelations, weekSummary, hasEnoughData, daysLogged, totalFoodLogs: foodLogs.length });
});

router.get("/api/vitality/ai-insights", requirePremiumVitality, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI unavailable" });

  const userId = req.session.userId!;
  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `vitality-ai-insights:${today}`;

  const existing = await storage.getAiInsightsCache(userId, cacheKey);
  if (existing && existing.expiresAt > new Date()) {
    return res.json({ ...(existing.narrativeJson as object), cached: true });
  }

  const from = nDaysAgo(30);
  const [symptoms, foodLogs] = await Promise.all([
    storage.getVitalitySymptoms(userId, from, today),
    storage.getFoodLogEntriesRange(userId, from, today),
  ]);

  if (symptoms.length < 5) {
    return res.json({ narrative: null, sources: [], insufficientData: true, cached: false });
  }

  const snapshot = symptoms.map(s => `Day ${s.date.slice(5)}: energy=${s.energy ?? "?"},focus=${s.focus ?? "?"},motivation=${s.motivation ?? "?"},stress=${s.stress ?? "?"},sleep=${s.sleepQuality ?? "?"}`).slice(0, 15).join("; ");
  const topFoods = Array.from(new Set(foodLogs.map(f => f.mealName.toLowerCase().trim()).slice(0, 30))).slice(0, 10).join(", ");

  const prompt = `You are an expert men's nutrition researcher analysing one man's personal data. Here is his recent data (last 30 days): Energy, focus, motivation, stress, and sleep snapshot: ${snapshot}. Frequently logged foods: ${topFoods}. Write a personalised 2-3 paragraph nutrition insight focused on men's energy and wellbeing: identify one meaningful pattern in his data, find current peer-reviewed research (from PubMed or NIH) that helps explain or support it related to energy, stress management, or overall vitality, and give one specific dietary recommendation. Write in second person ("you"), warm but professional. Plain text only.`;

  try {
    const result = await searchMedicalLiterature(prompt);
    const payload = { narrative: result.text.trim(), sources: result.sources.slice(0, 3), insufficientData: false };

    const expiresAt = new Date();
    expiresAt.setHours(23, 59, 59, 999);
    await storage.upsertAiInsightsCache(userId, cacheKey, payload, expiresAt);

    res.json({ ...payload, cached: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate AI insights" });
  }
});

const vitalityResearchCache = new Map<string, { data: object; expiresAt: number }>();

router.get("/api/vitality/research-pulse", requirePremiumVitality, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI unavailable" });

  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const cacheKey = `vitality-research:${week}`;
  const cached = vitalityResearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    const prompt = `Search PubMed, NIH, or sports science and nutrition journals for recent research (published within the last 2 years) on nutrition and diet for men's energy, wellbeing, stress management, and vitality. Summarise 3 key findings in plain English. Format as a numbered list: 1. [Finding in 1-2 sentences]. 2. [Finding]. 3. [Finding]. Include the source for each finding.`;

    const result = await searchMedicalLiterature(prompt);
    const lines = result.text.split("\n").map(l => l.trim()).filter(l => /^\d\./.test(l));
    const items = lines.slice(0, 3).map((l, i) => ({
      summary: l.replace(/^\d\.\s*/, "").trim(),
      source: result.sources[i] ?? result.sources[0] ?? null,
    }));

    const data = { items };
    vitalityResearchCache.set(cacheKey, { data, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    res.json({ ...data, cached: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch research pulse" });
  }
});

export default router;
