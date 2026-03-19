import { Router } from "express";
import { storage } from "../storage";
import { calculateMacros } from "../meal-data";
import { computeAdaptiveTdee, buildExplanation } from "../lib/adaptive-tdee";
import { hasTierAccess } from "../tier";

const router = Router();

router.get("/api/adaptive-tdee/suggestion", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const user = await storage.getUserById(req.session.userId);
  if (!user || !(await hasTierAccess(user, "adaptive_tdee"))) {
    return res.status(403).json({ message: "Requires Advanced plan" });
  }
  const suggestion = await storage.getPendingAdaptiveSuggestion(req.session.userId);
  res.json(suggestion ?? null);
});

router.post("/api/adaptive-tdee/calculate", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const userId = req.session.userId;
  const user = await storage.getUserById(userId);
  if (!user || !(await hasTierAccess(user, "adaptive_tdee"))) {
    return res.status(403).json({ message: "Requires Advanced plan" });
  }

  const calcs = await storage.getCalculations(userId);
  const latest = calcs[0];
  if (!latest) return res.status(400).json({ message: "No calculation found" });

  const currentCalories = latest.dailyCalories;

  const override = await storage.getClientTargetOverrides(userId);
  const hasOverride = !!(override && (override.dailyCalories || override.proteinGoal || override.carbsGoal || override.fatGoal || override.fibreGoal));

  const lastSuggestionDate = await storage.getLastAdaptiveSuggestionDate(userId);
  if (lastSuggestionDate) {
    const daysSince = (Date.now() - lastSuggestionDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      const daysLeft = Math.ceil(7 - daysSince);
      return res.json({
        throttled: true,
        message: `Adaptive TDEE is checked weekly. Next check available in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
      });
    }
  }

  const weightEntries = await storage.getWeightEntries(userId);
  const now = new Date();
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fromStr = cutoff.toISOString().slice(0, 10);
  const toStr = now.toISOString().slice(0, 10);
  const foodLogs = await storage.getFoodLogEntriesRange(userId, fromStr, toStr);

  const result = computeAdaptiveTdee(weightEntries, foodLogs, 14);
  if (!result) {
    return res.json({
      eligible: false,
      message: "Not enough data yet — log food for at least 4 days and record 2+ weight entries in the past 14 days.",
    });
  }

  const formulaTdee = calculateMacros(
    parseFloat(String(latest.weight)),
    parseFloat(String(latest.height)),
    latest.age ?? 30,
    latest.gender ?? "male",
    latest.activityLevel ?? "moderate",
    latest.goal ?? "maintain"
  ).dailyCalories;

  const suggestedCalories = result.estimatedTdee;
  const delta = suggestedCalories - currentCalories;

  if (Math.abs(delta) < 50) {
    return res.json({
      eligible: true,
      noChange: true,
      estimatedTdee: result.estimatedTdee,
      formulaTdee,
      message: "Your targets are well-calibrated — no adjustment needed right now.",
    });
  }

  await storage.dismissAllPendingAdaptiveSuggestions(userId);

  const explanation = buildExplanation(currentCalories, suggestedCalories, result);
  const suggestion = await storage.createAdaptiveSuggestion({
    userId,
    suggestedCalories,
    currentCalories,
    formulaTdee,
    delta,
    explanation,
    confidence: result.confidence,
  });

  res.json({ eligible: true, hasOverride, suggestion });
});

router.post("/api/adaptive-tdee/suggestion/:id/accept", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const userId = req.session.userId;
  const user = await storage.getUserById(userId);
  if (!user || !(await hasTierAccess(user, "adaptive_tdee"))) {
    return res.status(403).json({ message: "Requires Advanced plan" });
  }

  const override = await storage.getClientTargetOverrides(userId);
  if (override && (override.dailyCalories || override.proteinGoal || override.carbsGoal || override.fatGoal || override.fibreGoal)) {
    return res.status(403).json({ message: "Cannot override nutritionist targets" });
  }

  const calcs = await storage.getCalculations(userId);
  const latest = calcs[0];
  if (!latest) return res.status(400).json({ message: "No calculation found" });

  const pendingSuggestion = await storage.getPendingAdaptiveSuggestion(userId);
  if (!pendingSuggestion || pendingSuggestion.id !== id) {
    return res.status(404).json({ message: "Suggestion not found or already acted upon" });
  }

  const newCalories = pendingSuggestion.suggestedCalories;

  const currentCalories = latest.dailyCalories;
  const currentProtein = latest.proteinGoal;
  const currentCarbs = latest.carbsGoal;
  const currentFat = latest.fatGoal;

  let proteinGoal: number;
  let carbsGoal: number;
  let fatGoal: number;

  if (currentCalories > 0) {
    const proteinRatio = (currentProtein * 4) / currentCalories;
    const carbsRatio = (currentCarbs * 4) / currentCalories;
    const fatRatio = (currentFat * 9) / currentCalories;
    proteinGoal = Math.round((newCalories * proteinRatio) / 4);
    carbsGoal = Math.round((newCalories * carbsRatio) / 4);
    fatGoal = Math.round((newCalories * fatRatio) / 9);
  } else {
    const baseMacros = calculateMacros(
      parseFloat(String(latest.weight)),
      parseFloat(String(latest.height)),
      latest.age ?? 30,
      latest.gender ?? "male",
      latest.activityLevel ?? "moderate",
      latest.goal ?? "maintain"
    );
    const ratio = newCalories / baseMacros.dailyCalories;
    proteinGoal = Math.round(baseMacros.proteinGoal * ratio);
    carbsGoal = Math.round(baseMacros.carbsGoal * ratio);
    fatGoal = Math.round(baseMacros.fatGoal * ratio);
  }

  await storage.createCalculation({
    userId,
    weight: String(latest.weight),
    height: String(latest.height),
    age: latest.age ?? 30,
    gender: latest.gender ?? "male",
    activityLevel: latest.activityLevel ?? "moderate",
    goal: latest.goal ?? "maintain",
    targetType: latest.targetType ?? "weekly",
    targetAmount: latest.targetAmount ?? null,
    dailyCalories: newCalories,
    weeklyCalories: newCalories * 7,
    proteinGoal,
    carbsGoal,
    fatGoal,
  });

  const accepted = await storage.acceptAdaptiveSuggestion(id, userId);
  if (!accepted) {
    return res.status(409).json({ message: "Suggestion could not be accepted — may have already been acted upon" });
  }

  res.json({ success: true, suggestion: accepted });
});

router.post("/api/adaptive-tdee/suggestion/:id/dismiss", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  const dismissUser = await storage.getUserById(req.session.userId);
  if (!dismissUser || !(await hasTierAccess(dismissUser, "adaptive_tdee"))) {
    return res.status(403).json({ message: "Requires Advanced plan" });
  }
  await storage.dismissAdaptiveSuggestion(id, req.session.userId);
  res.json({ success: true });
});

router.get("/api/adaptive-tdee/trend", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const userId = req.session.userId;
  const trendUser = await storage.getUserById(userId);
  if (!trendUser || !(await hasTierAccess(trendUser, "adaptive_tdee"))) {
    return res.status(403).json({ message: "Requires Advanced plan" });
  }

  const suggestions = await storage.getAdaptiveSuggestions(userId, 20);

  const acceptedSuggestions = suggestions.filter((s) => s.status === "accepted");

  if (!acceptedSuggestions.length) return res.json([]);

  const trendPoints = acceptedSuggestions.map((s) => {
    const date = s.actedAt
      ? new Date(s.actedAt).toISOString().slice(0, 10)
      : (s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : null);

    return {
      date,
      adaptiveTdee: s.suggestedCalories,
      formulaTdee: s.formulaTdee ?? null,
      confidence: s.confidence,
    };
  }).filter((p) => p.date !== null);

  trendPoints.sort((a, b) => a.date!.localeCompare(b.date!));

  res.json(trendPoints);
});

export default router;
