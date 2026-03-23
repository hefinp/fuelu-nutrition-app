import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { api, mealPlanSchema } from "@shared/routes";
import type { UserPreferences } from "@shared/schema";
import { RECIPES } from "@shared/recipes";
import { sendEmail, buildMealPlanEmailHtml, buildUnsubscribeUrl } from "../email";
import { hasTierAccess, deductCredits } from "../tier";
import {
  type MealEntry, type MealDb,
  MEAL_DATABASE, FANCY_MEAL_DATABASE, GOURMET_MEAL_DATABASE,
  filterMealDbByPreferences, filterMealDbByRecentLog,
  scaleMeal, pickBestMeal, buildDayPlan, generateDayPlan, generateMealPlan,
  computeCyclePhase, addDaysToDate, getPastSlotsForDate,
  buildExcludeKeywords, containsExcludedKeyword,
} from "../meal-data";

const router = Router();

const GENERATION_LIMITS: Record<string, { daily: number; weekly: number }> = {
  free: { daily: 3, weekly: 1 },
  simple: { daily: 6, weekly: 2 },
  advanced: { daily: Infinity, weekly: Infinity },
  payg: { daily: 3, weekly: 1 },
};

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

router.get("/api/meal-plans/generation-limits", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Login required" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "User not found" });

  const tier = (user.betaUser || user.tier === 'advanced') ? 'advanced' : (user.tier || 'free');
  const limits = GENERATION_LIMITS[tier] || GENERATION_LIMITS.free;
  const monthKey = getCurrentMonthKey();
  const counts = await storage.getMealPlanGenerationCounts(req.session.userId, monthKey);

  res.json({
    tier,
    limits: { daily: limits.daily === Infinity ? null : limits.daily, weekly: limits.weekly === Infinity ? null : limits.weekly },
    used: { daily: counts.dailyCount, weekly: counts.weeklyCount },
    remaining: {
      daily: limits.daily === Infinity ? null : Math.max(0, limits.daily - counts.dailyCount),
      weekly: limits.weekly === Infinity ? null : Math.max(0, limits.weekly - counts.weeklyCount),
    },
  });
});

router.post(api.mealPlans.generate.path, async (req, res) => {
  try {
    const input = mealPlanSchema.parse(req.body);
    const now = new Date();

    if (req.session.userId) {
      const user = await storage.getUserById(req.session.userId);
      if (user && !(await hasTierAccess(user, "ai_meal_plan"))) {
        return res.status(403).json({ message: "Upgrade your plan to generate meal plans" });
      }
    }

    let baseDb: MealDb = input.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : input.mealStyle === 'fancy' ? FANCY_MEAL_DATABASE : MEAL_DATABASE;

    let prefs: UserPreferences | null = null;
    if (req.session.userId) {
      const user = await storage.getUserById(req.session.userId);
      prefs = (user?.preferences as UserPreferences | null) ?? null;
      if (prefs?.vitalityMeals && user && !(user.betaUser || user.tier !== "free")) {
        prefs = { ...prefs, vitalityMeals: false };
      }
      baseDb = filterMealDbByPreferences(baseDb, prefs);
      const excludeKws = buildExcludeKeywords(prefs);
      const dislikedSet = new Set((prefs?.dislikedMeals ?? []).map(m => m.toLowerCase()));

      if (prefs?.recipeWebsitesEnabled) {
        const userMealsResult = await storage.getUserMeals(req.session.userId);
        const userMealsList = userMealsResult.items;
        const style = input.mealStyle ?? 'simple';
        const limit = (prefs as any).recipeWeeklyLimit ?? 5;
        const enabledSlots: string[] = (prefs as any).recipeEnabledSlots ?? ["breakfast", "lunch", "dinner", "snack"];
        const eligible = userMealsList.filter(r =>
          r.caloriesPerServing > 0 && r.proteinPerServing > 0 && r.carbsPerServing > 0 && r.fatPerServing > 0 &&
          r.mealStyle === style &&
          r.mealSlot && enabledSlots.includes(r.mealSlot) &&
          !containsExcludedKeyword(r.name, excludeKws, { ingredients: r.ingredients, ingredientsJson: r.ingredientsJson }) &&
          !dislikedSet.has(r.name.toLowerCase())
        );
        const capped = [...eligible].sort(() => Math.random() - 0.5).slice(0, limit);
        for (const r of capped) {
          baseDb[r.mealSlot as keyof MealDb].push({
            meal: r.name,
            calories: r.caloriesPerServing,
            protein: r.proteinPerServing,
            carbs: r.carbsPerServing,
            fat: r.fatPerServing,
            microScore: 3,
          });
        }
      }

      if ((prefs as any)?.includeCommunityMeals !== false) {
        const communityList = await storage.getCommunityMeals({ style: input.mealStyle ?? 'simple' });
        for (const cm of communityList) {
          const slot = cm.slot as keyof MealDb;
          if (baseDb[slot] && !containsExcludedKeyword(cm.name, excludeKws, { ingredients: cm.ingredients, ingredientsJson: cm.ingredientsJson }) && !dislikedSet.has(cm.name.toLowerCase())) {
            baseDb[slot].push({ meal: cm.name, calories: cm.caloriesPerServing, protein: cm.proteinPerServing, carbs: cm.carbsPerServing, fat: cm.fatPerServing, microScore: cm.microScore });
          }
        }
      }

      const from14 = new Date(now); from14.setDate(now.getDate() - 14);
      const recentEntries = await storage.getFoodLogEntriesRange(
        req.session.userId,
        from14.toISOString().split("T")[0],
        now.toISOString().split("T")[0],
      );
      const recentMealNames = Array.from(new Set(recentEntries.map(e => e.mealName)));
      baseDb = filterMealDbByRecentLog(baseDb, recentMealNames);
    }

    const hasCycle = !!(prefs?.cycleTrackingEnabled && prefs?.lastPeriodDate);

    if (input.planType === 'weekly') {
      const serverTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const effectiveTodayStr = input.clientToday ?? serverTodayStr;
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

      let perDayPhases: Record<string, string | null> | undefined = undefined;
      if (hasCycle && input.weekStartDate) {
        perDayPhases = {};
        dayNames.forEach((dayName, i) => {
          const dateStr = addDaysToDate(input.weekStartDate!, i);
          perDayPhases![dayName] = computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, dateStr);
        });
      }

      const isCurrentWeek = input.weekStartDate
        ? (() => {
            const ws = input.weekStartDate;
            const weekEnd = addDaysToDate(ws, 6);
            return effectiveTodayStr >= ws && effectiveTodayStr <= weekEnd;
          })()
        : false;

      let mealPlan: any;
      if (isCurrentWeek && input.weekStartDate) {
        const result: Record<string, any> = { planType: 'weekly' as const };
        let weekTotalCalories = 0, weekTotalProtein = 0, weekTotalCarbs = 0, weekTotalFat = 0;
        const canonicalSlots = ['breakfast', 'lunch', 'dinner', 'snack'];
        const userExclude: string[] = input.excludeSlots ?? [];

        dayNames.forEach((dayName, i) => {
          const dateStr = addDaysToDate(input.weekStartDate!, i);

          if (dateStr < effectiveTodayStr) {
            return;
          }

          const pastSlots = dateStr === effectiveTodayStr ? getPastSlotsForDate(dateStr, now) : [];
          const dayFullyPast = canonicalSlots.every(s => userExclude.includes(s) || pastSlots.includes(s));

          if (dayFullyPast) {
            return;
          }

          const dayExclude = [...userExclude, ...pastSlots.filter(s => !userExclude.includes(s))];
          const dayPhase = perDayPhases?.[dayName] ?? null;
          const dayPlan = generateDayPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, baseDb, prefs, dayPhase, dayName, dayExclude);
          result[dayName] = dayPlan;
          weekTotalCalories += dayPlan.dayTotalCalories;
          weekTotalProtein += dayPlan.dayTotalProtein;
          weekTotalCarbs += dayPlan.dayTotalCarbs;
          weekTotalFat += dayPlan.dayTotalFat;
        });

        result.weekStartDate = input.weekStartDate;
        result.weekTotalCalories = weekTotalCalories;
        result.weekTotalProtein = weekTotalProtein;
        result.weekTotalCarbs = weekTotalCarbs;
        result.weekTotalFat = weekTotalFat;
        result.cyclePhaseByDay = perDayPhases ?? null;
        mealPlan = result;
      } else {
        const fallbackPhase = hasCycle ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28) : null;
        mealPlan = generateMealPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, true, baseDb, prefs, fallbackPhase, perDayPhases, undefined, input.excludeSlots);
        if (input.weekStartDate) (mealPlan as any).weekStartDate = input.weekStartDate;
      }

      if (req.session.userId) await deductCredits(req.session.userId, "ai_meal_plan");
      res.status(201).json(mealPlan);
    } else if (input.targetDates && input.targetDates.length > 1) {
      const plans: Record<string, any> = {};
      const cyclePhaseByDate: Record<string, string | null> = {};
      for (const dateStr of input.targetDates) {
        const pastSlots = getPastSlotsForDate(dateStr, now);
        const mdCanonicalSlots = ['breakfast', 'lunch', 'dinner', 'snack'];
        const mdUserExclude: string[] = input.excludeSlots ?? [];
        const dayFullyPast = mdCanonicalSlots.every(s => mdUserExclude.includes(s) || pastSlots.includes(s));
        if (dayFullyPast) continue;

        const dayExclude = [...mdUserExclude, ...pastSlots.filter(s => !mdUserExclude.includes(s))];
        const phase = hasCycle ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, dateStr) : null;
        cyclePhaseByDate[dateStr] = phase;
        const [y, mo, da] = dateStr.split("-").map(Number);
        const dateObj = new Date(y, mo - 1, da);
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dateObj.getDay()];
        const dayPlan = generateDayPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, baseDb, prefs, phase, dayName, dayExclude);
        plans[dateStr] = { ...dayPlan, cyclePhase: phase };
      }
      if (req.session.userId) await deductCredits(req.session.userId, "ai_meal_plan");
      res.status(201).json({ planType: 'multi-daily', days: plans, targetDates: input.targetDates, cyclePhaseByDate });
    } else {
      const targetDate = input.targetDates?.[0];
      const cyclePhase = hasCycle
        ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, targetDate)
        : null;
      let singleDayName: string | undefined;
      if (targetDate) {
        const [y, mo, da] = targetDate.split("-").map(Number);
        const dateObj = new Date(y, mo - 1, da);
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        singleDayName = dayNames[dateObj.getDay()];
      }
      const sdUserExclude: string[] = input.excludeSlots ?? [];
      const singleExclude = targetDate
        ? [...sdUserExclude, ...getPastSlotsForDate(targetDate, now).filter(s => !sdUserExclude.includes(s))]
        : input.excludeSlots;
      const mealPlan = generateMealPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, false, baseDb, prefs, cyclePhase, undefined, singleDayName, singleExclude);
      if (targetDate) (mealPlan as any).targetDate = targetDate;
      if (req.session.userId) await deductCredits(req.session.userId, "ai_meal_plan");
      res.status(201).json(mealPlan);
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join('.'),
      });
    }
    throw err;
  }
});

const autofillSchema = z.object({
  dailyCalories: z.number(),
  proteinGoal: z.number(),
  carbsGoal: z.number(),
  fatGoal: z.number(),
  mealStyle: z.enum(['simple', 'fancy', 'gourmet']).optional().default('simple'),
  slots: z.record(z.string(), z.record(z.string(), z.array(z.object({
    meal: z.string(),
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    ingredientsJson: z.any().optional(),
  })))),
  planType: z.enum(['daily', 'weekly']).default('daily'),
  targetDate: z.string().optional(),
  weekStartDate: z.string().optional(),
  clientToday: z.string().optional(),
  excludeSlots: z.array(z.string()).optional(),
  ignoreCycle: z.boolean().optional().default(false),
});

function enrichMealsWithIngredients(meals: any[]): any[] {
  return meals.map(m => {
    if (m.ingredientsJson && Array.isArray(m.ingredientsJson) && m.ingredientsJson.length > 0) return m;
    const recipe = RECIPES[m.meal];
    if (recipe) {
      return {
        ...m,
        ingredientsJson: recipe.ingredients.map(ing => ({ name: ing.item, quantity: ing.quantity })),
        ...(!m.instructions ? { instructions: recipe.instructions } : {}),
      };
    }
    return m;
  });
}

function enrichDayPlan(dayPlan: Record<string, any>): Record<string, any> {
  const slotKeys = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const enriched = { ...dayPlan };
  for (const sk of slotKeys) {
    if (Array.isArray(enriched[sk])) {
      enriched[sk] = enrichMealsWithIngredients(enriched[sk]);
    }
  }
  return enriched;
}

router.post("/api/meal-plans/autofill", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Login required" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (user && !(await hasTierAccess(user, "ai_meal_plan"))) {
      return res.status(403).json({ message: "Upgrade your plan to use autofill" });
    }

    const input = autofillSchema.parse(req.body);

    if (user) {
      const tier = (user.betaUser || user.tier === 'advanced') ? 'advanced' : (user.tier || 'free');
      const limits = GENERATION_LIMITS[tier] || GENERATION_LIMITS.free;
      const monthKey = getCurrentMonthKey();
      const counts = await storage.getMealPlanGenerationCounts(req.session.userId, monthKey);
      const genType = input.planType === 'weekly' ? 'weekly' : 'daily';
      const limit = genType === 'weekly' ? limits.weekly : limits.daily;
      const used = genType === 'weekly' ? counts.weeklyCount : counts.dailyCount;
      if (limit !== Infinity && used >= limit) {
        return res.status(429).json({
          message: `You've reached your ${genType} generation limit for this month. Upgrade for more.`,
          remaining: { daily: Math.max(0, limits.daily === Infinity ? 999 : limits.daily - counts.dailyCount), weekly: Math.max(0, limits.weekly === Infinity ? 999 : limits.weekly - counts.weeklyCount) },
        });
      }
    }

    let baseDb: MealDb = input.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : input.mealStyle === 'fancy' ? FANCY_MEAL_DATABASE : MEAL_DATABASE;

    let prefs: UserPreferences | null = null;
    if (user) {
      prefs = (user.preferences as UserPreferences | null) ?? null;
      if (prefs?.vitalityMeals && !(user.betaUser || user.tier !== "free")) {
        prefs = { ...prefs, vitalityMeals: false };
      }
      baseDb = filterMealDbByPreferences(baseDb, prefs);
    }

    const hasCycle = !input.ignoreCycle && !!(prefs?.cycleTrackingEnabled && prefs?.lastPeriodDate);
    const slotKeys = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
    const normalizedExclude = (input.excludeSlots ?? []).map(s => s === 'snacks' ? 'snack' : s);
    const excludeSet = new Set([...(input.excludeSlots ?? []), ...normalizedExclude]);
    const backendExclude = (s: string) => excludeSet.has(s) || excludeSet.has(s === 'snacks' ? 'snack' : s);

    if (input.planType === 'weekly') {
      const now = new Date();
      const serverTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const effectiveTodayStr = input.clientToday ?? serverTodayStr;
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const result: Record<string, any> = {};
      let weekTotalCalories = 0, weekTotalProtein = 0, weekTotalCarbs = 0, weekTotalFat = 0;

      for (const dayName of dayNames) {
        const dayIndex = dayNames.indexOf(dayName);
        const dateStr = input.weekStartDate ? addDaysToDate(input.weekStartDate, dayIndex) : null;

        if (dateStr && dateStr < effectiveTodayStr) {
          continue;
        }

        const rawUserSlots = input.slots[dayName] || {};
        const userSlots: Record<string, any[]> = {};
        for (const sk of slotKeys) {
          userSlots[sk] = (rawUserSlots[sk] || []).filter((m: any) => m.meal !== '__past__');
        }

        const hasAnyUserMeals = slotKeys.some(s => (userSlots[s]?.length ?? 0) > 0);

        if (hasAnyUserMeals) {
          const cyclePhase = hasCycle && input.weekStartDate
            ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, addDaysToDate(input.weekStartDate, dayIndex))
            : null;
          const generated = generateDayPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, baseDb, prefs, cyclePhase, dayName, normalizedExclude);
          const dayPlan: Record<string, any> = {};
          for (const sk of slotKeys) {
            if (backendExclude(sk)) { dayPlan[sk] = userSlots[sk] || []; continue; }
            dayPlan[sk] = (userSlots[sk]?.length ?? 0) > 0 ? userSlots[sk] : generated[sk];
          }
          const allMeals = slotKeys.flatMap(s => dayPlan[s] || []);
          dayPlan.dayTotalCalories = allMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
          dayPlan.dayTotalProtein = allMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
          dayPlan.dayTotalCarbs = allMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
          dayPlan.dayTotalFat = allMeals.reduce((sum: number, m: any) => sum + m.fat, 0);
          result[dayName] = enrichDayPlan(dayPlan);
        } else {
          const cyclePhase = hasCycle && input.weekStartDate
            ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, addDaysToDate(input.weekStartDate, dayIndex))
            : null;
          const dayPlan = generateDayPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, baseDb, prefs, cyclePhase, dayName, normalizedExclude);
          result[dayName] = enrichDayPlan(dayPlan);
        }
        weekTotalCalories += result[dayName].dayTotalCalories;
        weekTotalProtein += result[dayName].dayTotalProtein;
        weekTotalCarbs += result[dayName].dayTotalCarbs;
        weekTotalFat += result[dayName].dayTotalFat;
      }

      if (input.weekStartDate) (result as any).weekStartDate = input.weekStartDate;

      if (req.session.userId) {
        await storage.incrementMealPlanGeneration(req.session.userId, getCurrentMonthKey(), 'weekly');
      }

      res.status(200).json({
        planType: 'weekly',
        ...result,
        weekStartDate: input.weekStartDate,
        weekTotalCalories, weekTotalProtein, weekTotalCarbs, weekTotalFat,
      });
    } else {
      const userSlots = Object.values(input.slots)[0] || {};
      const cyclePhase = hasCycle
        ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, input.targetDate)
        : null;
      const generated = generateDayPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, baseDb, prefs, cyclePhase, undefined, normalizedExclude);
      const dayPlan: Record<string, any> = {};
      for (const sk of slotKeys) {
        if (backendExclude(sk)) { dayPlan[sk] = userSlots[sk] || []; continue; }
        dayPlan[sk] = (userSlots[sk]?.length ?? 0) > 0 ? userSlots[sk] : generated[sk];
      }
      const allMeals = slotKeys.flatMap(s => dayPlan[s] || []);
      dayPlan.dayTotalCalories = allMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
      dayPlan.dayTotalProtein = allMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
      dayPlan.dayTotalCarbs = allMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
      dayPlan.dayTotalFat = allMeals.reduce((sum: number, m: any) => sum + m.fat, 0);
      dayPlan.planType = 'daily';
      if (input.targetDate) dayPlan.targetDate = input.targetDate;

      if (req.session.userId) {
        await storage.incrementMealPlanGeneration(req.session.userId, getCurrentMonthKey(), 'daily');
      }

      res.status(200).json(enrichDayPlan(dayPlan));
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

const replaceMealSchema = z.object({
  slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  mealStyle: z.enum(['simple', 'fancy', 'gourmet']).optional().default('simple'),
  dailyCalories: z.number(),
  proteinGoal: z.number(),
  carbsGoal: z.number(),
  fatGoal: z.number(),
  currentMealName: z.string().optional(),
  targetDate: z.string().optional(),
});

router.post("/api/meal-plans/replace-meal", async (req, res) => {
  try {
    const input = replaceMealSchema.parse(req.body);
    let baseDb: MealDb = input.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : input.mealStyle === 'fancy' ? FANCY_MEAL_DATABASE : MEAL_DATABASE;

    let prefs: UserPreferences | null = null;
    if (req.session.userId) {
      const user = await storage.getUserById(req.session.userId);
      prefs = (user?.preferences as UserPreferences | null) ?? null;
      if (prefs?.vitalityMeals && user && !(user.betaUser || user.tier !== "free")) {
        prefs = { ...prefs, vitalityMeals: false };
      }
      baseDb = filterMealDbByPreferences(baseDb, prefs);
      const excludeKws = buildExcludeKeywords(prefs);
      const dislikedSet = new Set((prefs?.dislikedMeals ?? []).map(m => m.toLowerCase()));

      if (prefs?.recipeWebsitesEnabled) {
        const userMealsResult = await storage.getUserMeals(req.session.userId);
        const userMealsList = userMealsResult.items;
        const style = input.mealStyle ?? 'simple';
        const limit = (prefs as any).recipeWeeklyLimit ?? 5;
        const enabledSlots: string[] = (prefs as any).recipeEnabledSlots ?? ["breakfast", "lunch", "dinner", "snack"];
        const eligible = userMealsList.filter(r =>
          r.caloriesPerServing > 0 && r.proteinPerServing > 0 && r.carbsPerServing > 0 && r.fatPerServing > 0 &&
          r.mealStyle === style &&
          r.mealSlot && enabledSlots.includes(r.mealSlot) &&
          !containsExcludedKeyword(r.name, excludeKws, { ingredients: r.ingredients, ingredientsJson: r.ingredientsJson }) &&
          !dislikedSet.has(r.name.toLowerCase())
        );
        const capped = [...eligible].sort(() => Math.random() - 0.5).slice(0, limit);
        for (const r of capped) {
          baseDb[r.mealSlot as keyof MealDb].push({
            meal: r.name,
            calories: r.caloriesPerServing,
            protein: r.proteinPerServing,
            carbs: r.carbsPerServing,
            fat: r.fatPerServing,
            microScore: 3,
          });
        }
      }

      if ((prefs as any)?.includeCommunityMeals !== false) {
        const communityList = await storage.getCommunityMeals({ style: input.mealStyle ?? 'simple' });
        for (const cm of communityList) {
          const slot = cm.slot as keyof MealDb;
          if (baseDb[slot] && !containsExcludedKeyword(cm.name, excludeKws, { ingredients: cm.ingredients, ingredientsJson: cm.ingredientsJson }) && !dislikedSet.has(cm.name.toLowerCase())) {
            baseDb[slot].push({ meal: cm.name, calories: cm.caloriesPerServing, protein: cm.proteinPerServing, carbs: cm.carbsPerServing, fat: cm.fatPerServing, microScore: cm.microScore });
          }
        }
      }
    }

    const pool = baseDb[input.slot === 'snack' ? 'snack' : input.slot];
    const filtered = input.currentMealName
      ? pool.filter(m => m.meal !== input.currentMealName)
      : pool;
    const candidates = filtered.length > 0 ? filtered : pool;

    const totalMacroCals = input.proteinGoal * 4 + input.carbsGoal * 4 + input.fatGoal * 9;
    const tProtein = (input.proteinGoal * 4) / totalMacroCals;
    const tCarbs = (input.carbsGoal * 4) / totalMacroCals;
    const tFat = (input.fatGoal * 9) / totalMacroCals;

    const replCyclePhase = (prefs?.cycleTrackingEnabled && prefs?.lastPeriodDate)
      ? computeCyclePhase(prefs.lastPeriodDate, prefs.cycleLength ?? 28, input.targetDate)
      : null;
    const picked = pickBestMeal(candidates, tProtein, tCarbs, tFat, prefs, replCyclePhase);

    if (!picked) {
      return res.status(200).json({ meal: null, message: "No safe replacement available for your dietary restrictions." });
    }

    const slotCalMap: Record<string, number> = {
      breakfast: 0.25,
      lunch: 0.30,
      dinner: 0.35,
      snack: 0.10,
    };
    const targetCals = Math.round(input.dailyCalories * slotCalMap[input.slot]);
    const scaled = scaleMeal(picked, targetCals);

    res.status(200).json(scaled);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

router.post("/api/saved-meal-plans", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  try {
    const body = z.object({
      planData: z.any(),
      planType: z.enum(['daily', 'weekly']),
      mealStyle: z.enum(['simple', 'fancy', 'gourmet']).optional().default('simple'),
      calculationId: z.number().optional(),
      name: z.string().min(1).max(100).optional().default('My Plan'),
    }).parse(req.body);

    const saved = await storage.saveMealPlan({
      userId: req.session.userId,
      calculationId: body.calculationId,
      planType: body.planType,
      mealStyle: body.mealStyle,
      planData: body.planData,
      name: body.name,
    });

    try {
      const foodLogRows: Array<{ userId: number; date: string; mealName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot: string; confirmed: boolean }> = [];
      const planData = body.planData as any;

      const extractMeals = (dayData: any, dateStr: string) => {
        const slots = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
        for (const slot of slots) {
          const meals = dayData?.[slot];
          if (!Array.isArray(meals)) continue;
          for (const m of meals) {
            if (m?.meal && typeof m.calories === 'number') {
              foodLogRows.push({
                userId: req.session.userId!,
                date: dateStr,
                mealName: m.meal,
                calories: Math.round(m.calories),
                protein: Math.round(m.protein ?? 0),
                carbs: Math.round(m.carbs ?? 0),
                fat: Math.round(m.fat ?? 0),
                mealSlot: slot === 'snacks' ? 'snack' : slot,
                confirmed: false,
              });
            }
          }
        }
      };

      if (planData.planType === 'multi-daily' && planData.days) {
        for (const dateStr of Object.keys(planData.days)) {
          extractMeals(planData.days[dateStr], dateStr);
        }
      } else if (body.planType === 'daily') {
        const targetDate = planData.targetDate || new Date().toISOString().split('T')[0];
        extractMeals(planData, targetDate);
      } else {
        const weekStart = planData.weekStartDate || new Date().toISOString().split('T')[0];
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        dayNames.forEach((dayName, i) => {
          if (planData[dayName]) {
            extractMeals(planData[dayName], addDaysToDate(weekStart, i));
          }
        });
      }

      if (foodLogRows.length > 0) {
        await storage.bulkCreateFoodLogEntries(foodLogRows);
      }
    } catch (logErr) {
      console.error('Failed to pre-populate food log from saved plan:', logErr);
    }

    res.status(201).json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

router.get("/api/saved-meal-plans", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const plans = await storage.getSavedMealPlans(req.session.userId);
  res.status(200).json(plans);
});

router.patch("/api/saved-meal-plans/:id/name", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const id = parseInt(req.params.id);
  const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);
  const updated = await storage.updateMealPlanName(id, req.session.userId, name);
  if (!updated) return res.status(404).json({ message: "Plan not found" });
  res.status(200).json(updated);
});

router.delete("/api/saved-meal-plans/:id", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const id = parseInt(req.params.id);
  await storage.deleteMealPlan(id, req.session.userId);
  res.status(204).send();
});

router.post("/api/saved-meal-plans/:id/schedule", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  try {
    const planId = parseInt(req.params.id);
    const body = z.object({
      targetDate: z.string().optional(),
      weekStartDate: z.string().optional(),
      force: z.boolean().optional().default(false),
      allowDuplicate: z.boolean().optional().default(false),
    }).parse(req.body);

    const plan = await storage.getSavedMealPlanById(planId, req.session.userId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const planData = plan.planData as any;

    const user = await storage.getUserById(req.session.userId);
    const prefs = (user?.preferences as UserPreferences | null) ?? null;
    const hasCycle = !!(prefs?.cycleTrackingEnabled && prefs?.lastPeriodDate && (user as any)?.gender === 'female');

    if (hasCycle && !body.force) {
      if (plan.planType === 'daily' && body.targetDate) {
        const storedPhase = planData?.cyclePhase || null;
        const targetPhase = computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, body.targetDate);
        if (storedPhase && targetPhase && storedPhase !== targetPhase) {
          return res.status(200).json({ mismatch: true, storedPhase, targetPhase });
        }
      } else if (plan.planType === 'weekly' && body.weekStartDate) {
        const storedPhases = planData?.perDayPhases || planData?.cyclePhaseByDay || {};
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
        let hasMismatch = false;
        let firstStoredPhase: string | null = null;
        let firstTargetPhase: string | null = null;
        dayNames.forEach((dayName, i) => {
          const storedP = storedPhases[dayName] || null;
          const targetP = computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, addDaysToDate(body.weekStartDate!, i));
          if (storedP && targetP && storedP !== targetP) {
            hasMismatch = true;
            if (!firstStoredPhase) { firstStoredPhase = storedP; firstTargetPhase = targetP; }
          }
        });
        if (hasMismatch) {
          return res.status(200).json({ mismatch: true, storedPhase: firstStoredPhase, targetPhase: firstTargetPhase });
        }
      }
    }

    const foodLogRows: Array<{ userId: number; date: string; mealName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot: string; confirmed: boolean }> = [];

    const extractMeals = (dayData: any, dateStr: string) => {
      const slots = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
      for (const slot of slots) {
        const meals = dayData?.[slot];
        if (!Array.isArray(meals)) continue;
        for (const m of meals) {
          if (m?.meal && typeof m.calories === 'number') {
            foodLogRows.push({
              userId: req.session.userId!,
              date: dateStr,
              mealName: m.meal,
              calories: Math.round(m.calories),
              protein: Math.round(m.protein ?? 0),
              carbs: Math.round(m.carbs ?? 0),
              fat: Math.round(m.fat ?? 0),
              mealSlot: slot === 'snacks' ? 'snack' : slot,
              confirmed: false,
            });
          }
        }
      }
    };

    if (plan.planType === 'daily') {
      const targetDate = body.targetDate || new Date().toISOString().split('T')[0];
      extractMeals(planData, targetDate);
    } else {
      const weekStart = body.weekStartDate || new Date().toISOString().split('T')[0];
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      dayNames.forEach((dayName, i) => {
        if (planData[dayName]) {
          extractMeals(planData[dayName], addDaysToDate(weekStart, i));
        }
      });
    }

    if (foodLogRows.length > 0 && !body.allowDuplicate) {
      const datesToCheck = Array.from(new Set(foodLogRows.map(r => r.date)));
      const mealsByDate = new Map<string, Set<string>>();
      for (const row of foodLogRows) {
        if (!mealsByDate.has(row.date)) mealsByDate.set(row.date, new Set());
        mealsByDate.get(row.date)!.add(row.mealName.toLowerCase());
      }
      let duplicateCount = 0;
      for (const dateStr of datesToCheck) {
        const existing = await storage.getFoodLogEntries(req.session.userId, dateStr);
        const plannedNames = mealsByDate.get(dateStr);
        if (!plannedNames) continue;
        for (const entry of existing) {
          if (!entry.confirmed && plannedNames.has(entry.mealName.toLowerCase())) {
            duplicateCount++;
          }
        }
      }
      if (duplicateCount > 0) {
        return res.status(200).json({ duplicate: true, duplicateCount });
      }
    }

    if (foodLogRows.length > 0) {
      await storage.bulkCreateFoodLogEntries(foodLogRows);
    }

    const dateLabel = plan.planType === 'weekly' && body.weekStartDate
      ? `${body.weekStartDate} week`
      : (body.targetDate || 'today');

    res.status(200).json({ scheduled: true, entryCount: foodLogRows.length, dateLabel });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

router.post("/api/saved-meal-plans/:id/generate-optimised", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  try {
    const planId = parseInt(req.params.id);
    const body = z.object({
      targetDate: z.string().optional(),
      weekStartDate: z.string().optional(),
    }).parse(req.body);

    const plan = await storage.getSavedMealPlanById(planId, req.session.userId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const planData = plan.planData as any;

    const user = await storage.getUserById(req.session.userId);
    const prefs = (user?.preferences as UserPreferences | null) ?? null;
    const hasCycle = !!(prefs?.cycleTrackingEnabled && prefs?.lastPeriodDate && (user as any)?.gender === 'female');

    const dailyCal = plan.planType === 'weekly'
      ? Math.round((planData.weekTotalCalories || 2000) / 7)
      : (planData.dayTotalCalories || 2000);
    const dailyProt = plan.planType === 'weekly'
      ? Math.round((planData.weekTotalProtein || 150) / 7)
      : (planData.dayTotalProtein || 150);
    const dailyCarbs = plan.planType === 'weekly'
      ? Math.round((planData.weekTotalCarbs || 250) / 7)
      : (planData.dayTotalCarbs || 250);
    const dailyFat = plan.planType === 'weekly'
      ? Math.round((planData.weekTotalFat || 65) / 7)
      : (planData.dayTotalFat || 65);

    let baseDb: MealDb = plan.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : plan.mealStyle === 'fancy' ? FANCY_MEAL_DATABASE : MEAL_DATABASE;
    baseDb = filterMealDbByPreferences(baseDb, prefs);

    let newPlanData: any;

    if (plan.planType === 'weekly') {
      const ws = body.weekStartDate || new Date().toISOString().split('T')[0];
      let perDayPhases: Record<string, string | null> | undefined = undefined;
      if (hasCycle) {
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
        perDayPhases = {};
        dayNames.forEach((dayName, i) => {
          perDayPhases![dayName] = computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, addDaysToDate(ws, i));
        });
      }
      const fallbackPhase = hasCycle ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28) : null;
      newPlanData = generateMealPlan(dailyCal, dailyProt, dailyCarbs, dailyFat, true, baseDb, prefs, fallbackPhase, perDayPhases);
      newPlanData.weekStartDate = ws;
      if (perDayPhases) newPlanData.perDayPhases = perDayPhases;
    } else {
      const td = body.targetDate || new Date().toISOString().split('T')[0];
      const cyclePhase = hasCycle ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, td) : null;
      const [tdY, tdM, tdD] = td.split("-").map(Number);
      const tdObj = new Date(tdY, tdM - 1, tdD);
      const tdDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const tdDayName = tdDayNames[tdObj.getDay()];
      newPlanData = generateMealPlan(dailyCal, dailyProt, dailyCarbs, dailyFat, false, baseDb, prefs, cyclePhase, undefined, tdDayName);
      newPlanData.targetDate = td;
      if (cyclePhase) newPlanData.cyclePhase = cyclePhase;
    }

    const foodLogRows: Array<{ userId: number; date: string; mealName: string; calories: number; protein: number; carbs: number; fat: number; mealSlot: string; confirmed: boolean }> = [];
    const extractMeals = (dayData: any, dateStr: string) => {
      const slots = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
      for (const slot of slots) {
        const meals = dayData?.[slot];
        if (!Array.isArray(meals)) continue;
        for (const m of meals) {
          if (m?.meal && typeof m.calories === 'number') {
            foodLogRows.push({
              userId: req.session.userId!,
              date: dateStr,
              mealName: m.meal,
              calories: Math.round(m.calories),
              protein: Math.round(m.protein ?? 0),
              carbs: Math.round(m.carbs ?? 0),
              fat: Math.round(m.fat ?? 0),
              mealSlot: slot === 'snacks' ? 'snack' : slot,
              confirmed: false,
            });
          }
        }
      }
    };

    if (plan.planType === 'daily') {
      extractMeals(newPlanData, body.targetDate || new Date().toISOString().split('T')[0]);
    } else {
      const ws = body.weekStartDate || new Date().toISOString().split('T')[0];
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      dayNames.forEach((dayName, i) => {
        if (newPlanData[dayName]) extractMeals(newPlanData[dayName], addDaysToDate(ws, i));
      });
    }

    if (foodLogRows.length > 0) {
      await storage.bulkCreateFoodLogEntries(foodLogRows);
    }

    res.status(200).json({ scheduled: true, entryCount: foodLogRows.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

router.post("/api/saved-meal-plans/:id/email", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const planId = parseInt(req.params.id);
  const plan = await storage.getSavedMealPlanById(planId, req.session.userId);
  if (!plan) return res.status(404).json({ message: "Plan not found" });
  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "User not found" });
  let shoppingList: Record<string, Array<{ item: string; quantity: string }>> | undefined;
  if (req.body?.shoppingList && typeof req.body.shoppingList === 'object') {
    const raw = req.body.shoppingList as Record<string, unknown>;
    const validated: Record<string, Array<{ item: string; quantity: string }>> = {};
    for (const [cat, items] of Object.entries(raw)) {
      if (!Array.isArray(items)) continue;
      validated[String(cat).slice(0, 50)] = items
        .filter((i: any) => i && typeof i.item === 'string' && typeof i.quantity === 'string')
        .map((i: any) => ({ item: String(i.item).slice(0, 200), quantity: String(i.quantity).slice(0, 50) }));
    }
    if (Object.keys(validated).length > 0) shoppingList = validated;
  }
  const emailPrefs = await storage.getEmailPreferences(req.session.userId);
  if (!emailPrefs.mealPlans) {
    return res.status(403).json({ message: "You have opted out of meal plan emails. Update your email preferences in Account Settings to re-enable." });
  }
  const unsubscribeUrl = buildUnsubscribeUrl(req.session.userId);
  const html = buildMealPlanEmailHtml(plan.name, user.name, plan.planData as any, plan.planType, shoppingList, unsubscribeUrl);
  await sendEmail({ to: user.email, subject: `Your FuelU plan: ${plan.name}`, html });
  res.json({ message: "Plan sent to your email." });
});

export default router;
