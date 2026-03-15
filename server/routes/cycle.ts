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

async function syncPrefsFromPeriodLogs(userId: number): Promise<void> {
  const logs = await storage.getCyclePeriodLogs(userId);
  const user = await storage.getUserById(userId);
  const currentPrefs: UserPreferences = (user as any)?.preferences ?? {};
  if (logs.length === 0) return;
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

    const existing = await storage.getCyclePeriodLogs(req.session.userId);
    let computedCycleLength: number | null = null;
    if (existing.length > 0) {
      const prev = new Date(existing[0].periodStartDate + "T00:00:00");
      const curr = new Date(body.periodStartDate + "T00:00:00");
      const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 14 && diff < 60) computedCycleLength = diff;
    }

    const log = await storage.createCyclePeriodLog({
      userId: req.session.userId,
      periodStartDate: body.periodStartDate,
      periodEndDate: body.periodEndDate ?? null,
      computedCycleLength,
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
      periodEndDate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(req.body);
    const updated = await storage.updateCyclePeriodLog(id, req.session.userId, body);
    if (!updated) return res.status(404).json({ message: "Not found" });
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

function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function getCycleDay(dateStr: string, periods: { periodStartDate: string }[], prefs: UserPreferences): number | null {
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

function energyScore(v: string | null | undefined): number | null {
  if (v === "high") return 3; if (v === "medium") return 2; if (v === "low") return 1; return null;
}
function moodScore(v: string | null | undefined): number | null {
  if (v === "balanced") return 3; if (v === "anxious") return 2; if (v === "low") return 1; return null;
}
function getMostCommon(arr: (string | null | undefined)[]): string | null {
  const counts: Record<string, number> = {};
  for (const v of arr) { if (v) counts[v] = (counts[v] ?? 0) + 1; }
  let best: string | null = null, bestN = 0;
  for (const [k, n] of Object.entries(counts)) { if (n > bestN) { best = k; bestN = n; } }
  return best;
}

router.get("/api/cycle/insights", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const userId = req.session.userId;
  const today = new Date().toISOString().split("T")[0];
  const from = nDaysAgo(90);

  const [symptoms, foodLogs, periods, user] = await Promise.all([
    storage.getCycleSymptoms(userId, from, today),
    storage.getFoodLogEntriesRange(userId, from, today),
    storage.getCyclePeriodLogs(userId),
    storage.getUserById(userId),
  ]);

  const prefs: UserPreferences = (user as any)?.preferences ?? {};
  const daysLogged = symptoms.length;
  const hasEnoughData = daysLogged >= 7 && foodLogs.length >= 7;

  const byDay: Record<number, { energySum: number; moodSum: number; count: number }> = {};
  for (const s of symptoms) {
    const day = getCycleDay(s.date, periods, prefs);
    if (day === null || day < 1 || day > 35) continue;
    if (!byDay[day]) byDay[day] = { energySum: 0, moodSum: 0, count: 0 };
    const es = energyScore(s.energy); const ms = moodScore(s.mood);
    if (es !== null) byDay[day].energySum += es;
    if (ms !== null) byDay[day].moodSum += ms;
    byDay[day].count++;
  }
  const symptomByDay = Object.entries(byDay)
    .map(([day, d]) => ({
      cycleDay: parseInt(day),
      avgEnergy: d.count > 0 ? Math.round((d.energySum / d.count) * 10) / 10 : null,
      avgMood: d.count > 0 ? Math.round((d.moodSum / d.count) * 10) / 10 : null,
      count: d.count,
    }))
    .sort((a, b) => a.cycleDay - b.cycleDay);

  const symByDate: Record<string, typeof symptoms[0]> = {};
  for (const s of symptoms) symByDate[s.date] = s;
  const foodEnergy: Record<string, { sum: number; count: number; high: number }> = {};
  for (const entry of foodLogs) {
    const sym = symByDate[entry.date]; if (!sym) continue;
    const es = energyScore(sym.energy); if (es === null) continue;
    const name = entry.mealName.toLowerCase().trim().split(" ").slice(0, 3).join(" ");
    if (!foodEnergy[name]) foodEnergy[name] = { sum: 0, count: 0, high: 0 };
    foodEnergy[name].sum += es; foodEnergy[name].count++; if (es === 3) foodEnergy[name].high++;
  }
  const allE = symptoms.filter(s => s.energy).map(s => energyScore(s.energy)!);
  const avgE = allE.length > 0 ? allE.reduce((a, b) => a + b, 0) / allE.length : 2;
  const foodCorrelations = Object.entries(foodEnergy)
    .filter(([_, d]) => d.count >= 2 && d.sum / d.count > avgE)
    .map(([food, d]) => ({
      food, count: d.count,
      avgEnergy: Math.round((d.sum / d.count) * 10) / 10,
      highEnergyRate: Math.round((d.high / d.count) * 100),
    }))
    .sort((a, b) => b.avgEnergy - a.avgEnergy)
    .slice(0, 6);

  const weekFrom = nDaysAgo(6);
  const weekSym = symptoms.filter(s => s.date >= weekFrom);
  const weekSummary = {
    loggedDays: weekSym.length,
    topEnergy: getMostCommon(weekSym.map(s => s.energy)),
    topMood: getMostCommon(weekSym.map(s => s.mood)),
    topCravings: getMostCommon(weekSym.map(s => s.cravings)),
    avgEnergy: weekSym.length > 0
      ? Math.round((weekSym.map(s => energyScore(s.energy) ?? 0).reduce((a, b) => a + b, 0) / weekSym.length) * 10) / 10
      : null,
  };

  res.json({ symptomByDay, foodCorrelations, weekSummary, hasEnoughData, daysLogged, totalFoodLogs: foodLogs.length });
});

const phaseEvidenceCache = new Map<string, { data: object; expiresAt: number }>();

router.get("/api/cycle/phase-evidence", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI unavailable" });

  const phase = z.enum(["menstrual", "follicular", "ovulatory", "luteal"]).parse(req.query.phase);
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const cacheKey = `${phase}:${week}`;
  const cached = phaseEvidenceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    const phaseDescriptions: Record<string, string> = {
      menstrual: "the menstrual phase (days 1-5, low oestrogen and progesterone, prostaglandin inflammation, iron loss from bleeding)",
      follicular: "the follicular phase (days 6-13, rising oestrogen, improved insulin sensitivity, serotonin increase)",
      ovulatory: "the ovulatory phase (days 14-16, oestrogen peak, LH surge, high energy and motivation)",
      luteal: "the luteal phase (days 17-28, progesterone dominance, increased appetite, PMS symptoms, serotonin dip)",
    };
    const prompt = `You are a women's health nutrition researcher. For ${phaseDescriptions[phase]}, provide exactly 3 concise evidence-based nutrition recommendations (1 sentence each). Each should cite a specific nutrient, food, or dietary pattern. Search PubMed or NIH for supporting research. Format as a plain numbered list 1. 2. 3. No headers or extra text.`;

    const result = await searchMedicalLiterature(prompt);
    const lines = result.text.split("\n").map(l => l.trim()).filter(l => /^\d\./.test(l));
    const bullets = lines.slice(0, 3).map((l, i) => ({
      text: l.replace(/^\d\.\s*/, "").trim(),
      source: result.sources[i] ?? result.sources[0] ?? null,
    }));

    const data = { bullets };
    phaseEvidenceCache.set(cacheKey, { data, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    res.json({ ...data, cached: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch phase evidence" });
  }
});

router.get("/api/cycle/ai-insights", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI unavailable" });

  const userId = req.session.userId;
  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `ai-insights:${today}`;

  const existing = await storage.getAiInsightsCache(userId, cacheKey);
  if (existing && existing.expiresAt > new Date()) {
    return res.json({ ...(existing.narrativeJson as object), cached: true });
  }

  const from = nDaysAgo(30);
  const [symptoms, foodLogs, periods] = await Promise.all([
    storage.getCycleSymptoms(userId, from, today),
    storage.getFoodLogEntriesRange(userId, from, today),
    storage.getCyclePeriodLogs(userId),
  ]);

  if (symptoms.length < 5) {
    return res.json({ narrative: null, sources: [], insufficientData: true, cached: false });
  }

  const energyByDay = symptoms.map(s => `Day ${s.date.slice(5)}: energy=${s.energy ?? "?"},mood=${s.mood ?? "?"}`).slice(0, 15).join("; ");
  const topFoods = Array.from(new Set(foodLogs.map(f => f.mealName.toLowerCase().trim()).slice(0, 30))).slice(0, 10).join(", ");
  const cycleInfo = periods.length > 0 ? `Last period started ${periods[0].periodStartDate}${periods[0].computedCycleLength ? `, cycle length ~${periods[0].computedCycleLength} days` : ""}.` : "";

  const prompt = `You are an expert women's health nutrition researcher analysing one woman's personal data. Here is her recent data (last 30 days): ${cycleInfo} Energy and mood snapshot: ${energyByDay}. Frequently logged foods: ${topFoods}. Write a personalised 2-3 paragraph nutrition insight: identify one meaningful pattern in her data, find current peer-reviewed research (from PubMed or NIH) that helps explain or support it, and give one specific dietary recommendation. Write in second person ("you"), warm but professional. Plain text only.`;

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

const researchPulseCache = new Map<string, { data: object; expiresAt: number }>();

router.get("/api/cycle/research-pulse", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI unavailable" });

  const phase = z.enum(["menstrual", "follicular", "ovulatory", "luteal"]).parse(req.query.phase);
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const cacheKey = `${phase}:${week}`;
  const cached = researchPulseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    const prompt = `Search PubMed, NIH, or nutrition journals for recent research (published within the last 2 years) on nutrition and diet during the ${phase} phase of the menstrual cycle. Summarise 3 key findings in plain English. Format as a numbered list: 1. [Finding in 1-2 sentences]. 2. [Finding]. 3. [Finding]. Include the source for each finding.`;

    const result = await searchMedicalLiterature(prompt);
    const lines = result.text.split("\n").map(l => l.trim()).filter(l => /^\d\./.test(l));
    const items = lines.slice(0, 3).map((l, i) => ({
      summary: l.replace(/^\d\.\s*/, "").trim(),
      source: result.sources[i] ?? result.sources[0] ?? null,
    }));

    const data = { items, phase };
    researchPulseCache.set(cacheKey, { data, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    res.json({ ...data, cached: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch research pulse" });
  }
});

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
