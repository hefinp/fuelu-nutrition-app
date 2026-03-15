import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { storage } from "../storage";
import type { UserPreferences } from "@shared/schema";
import { searchMedicalLiterature } from "../ai-research";
import { nDaysAgo, getCycleDay, energyScore, moodScore, getMostCommon } from "./cycle";

const router = Router();

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

router.post("/api/food-log/weekly-insights", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI unavailable" });

  const { entries, targets, weekLabel } = req.body as {
    entries: { date: string; calories: number; protein: number; carbs: number; fat: number }[];
    targets: { calories: number; protein: number; carbs: number; fat: number };
    weekLabel?: string;
  };
  if (!entries?.length) return res.status(400).json({ error: "No entries provided" });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const logSummary = entries.map(e =>
      `${e.date}: ${e.calories}kcal, ${e.protein}g protein, ${e.carbs}g carbs, ${e.fat}g fat`
    ).join("\n");
    const prompt = `Here are a user's food log totals by day${weekLabel ? ` for ${weekLabel}` : ""}:\n${logSummary}\n\nDaily targets: ${targets.calories}kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat.\n\nWrite 2-4 short bullet points (use • character) that: summarise macro targets hit or missed, highlight the best and weakest days, and give one practical tip for the coming week. Keep it encouraging, specific, and concise. Plain text only.`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    });
    const summary = resp.choices[0]?.message?.content?.trim() ?? "";
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

export default router;
