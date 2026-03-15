import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { api, mealPlanSchema } from "@shared/routes";
import type { UserPreferences } from "@shared/schema";
import { sendEmail, buildMealPlanEmailHtml } from "../email";
import {
  type MealEntry, type MealDb,
  MEAL_DATABASE, GOURMET_MEAL_DATABASE, MICHELIN_MEAL_DATABASE,
  filterMealDbByPreferences, filterMealDbByRecentLog,
  scaleMeal, pickBestMeal, buildDayPlan, generateDayPlan, generateMealPlan,
  computeCyclePhase, addDaysToDate,
  buildExcludeKeywords, containsExcludedKeyword,
} from "../meal-data";

const router = Router();

router.post(api.mealPlans.generate.path, async (req, res) => {
  try {
    const input = mealPlanSchema.parse(req.body);
    let baseDb: MealDb = input.mealStyle === 'michelin' ? MICHELIN_MEAL_DATABASE : input.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : MEAL_DATABASE;

    let prefs: UserPreferences | null = null;
    if (req.session.userId) {
      const user = await storage.getUserById(req.session.userId);
      prefs = (user?.preferences as UserPreferences | null) ?? null;
      baseDb = filterMealDbByPreferences(baseDb, prefs);
      const excludeKws = buildExcludeKeywords(prefs);

      if (prefs?.recipeWebsitesEnabled) {
        const userRecipesList = await storage.getUserRecipes(req.session.userId);
        const style = input.mealStyle ?? 'simple';
        const limit = (prefs as any).recipeWeeklyLimit ?? 5;
        const enabledSlots: string[] = (prefs as any).recipeEnabledSlots ?? ["breakfast", "lunch", "dinner", "snack"];
        const eligible = userRecipesList.filter(r =>
          r.caloriesPerServing > 0 && r.proteinPerServing > 0 && r.carbsPerServing > 0 && r.fatPerServing > 0 &&
          r.mealStyle === style &&
          enabledSlots.includes(r.mealSlot) &&
          !containsExcludedKeyword(r.name, excludeKws)
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
          if (baseDb[slot] && !containsExcludedKeyword(cm.name, excludeKws)) {
            baseDb[slot].push({ meal: cm.name, calories: cm.caloriesPerServing, protein: cm.proteinPerServing, carbs: cm.carbsPerServing, fat: cm.fatPerServing, microScore: cm.microScore });
          }
        }
      }

      const now = new Date();
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
      let perDayPhases: Record<string, string | null> | undefined = undefined;
      if (hasCycle && input.weekStartDate) {
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
        perDayPhases = {};
        dayNames.forEach((dayName, i) => {
          const dateStr = addDaysToDate(input.weekStartDate!, i);
          perDayPhases![dayName] = computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, dateStr);
        });
      }
      const fallbackPhase = hasCycle ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28) : null;
      const mealPlan = generateMealPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, true, baseDb, prefs, fallbackPhase, perDayPhases);
      if (input.weekStartDate) (mealPlan as any).weekStartDate = input.weekStartDate;
      res.status(201).json(mealPlan);
    } else if (input.targetDates && input.targetDates.length > 1) {
      const plans: Record<string, any> = {};
      const cyclePhaseByDate: Record<string, string | null> = {};
      for (const dateStr of input.targetDates) {
        const phase = hasCycle ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, dateStr) : null;
        cyclePhaseByDate[dateStr] = phase;
        const dayPlan = generateDayPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, baseDb, prefs, phase);
        plans[dateStr] = { ...dayPlan, cyclePhase: phase };
      }
      res.status(201).json({ planType: 'multi-daily', days: plans, targetDates: input.targetDates, cyclePhaseByDate });
    } else {
      const targetDate = input.targetDates?.[0];
      const cyclePhase = hasCycle
        ? computeCyclePhase(prefs!.lastPeriodDate!, prefs!.cycleLength ?? 28, targetDate)
        : null;
      const mealPlan = generateMealPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, false, baseDb, prefs, cyclePhase);
      if (targetDate) (mealPlan as any).targetDate = targetDate;
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

const replaceMealSchema = z.object({
  slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  mealStyle: z.enum(['simple', 'gourmet', 'michelin']).optional().default('simple'),
  dailyCalories: z.number(),
  proteinGoal: z.number(),
  carbsGoal: z.number(),
  fatGoal: z.number(),
  currentMealName: z.string().optional(),
});

router.post("/api/meal-plans/replace-meal", async (req, res) => {
  try {
    const input = replaceMealSchema.parse(req.body);
    let baseDb: MealDb = input.mealStyle === 'michelin' ? MICHELIN_MEAL_DATABASE : input.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : MEAL_DATABASE;

    let prefs: UserPreferences | null = null;
    if (req.session.userId) {
      const user = await storage.getUserById(req.session.userId);
      prefs = (user?.preferences as UserPreferences | null) ?? null;
      baseDb = filterMealDbByPreferences(baseDb, prefs);
      const excludeKws = buildExcludeKeywords(prefs);

      if (prefs?.recipeWebsitesEnabled) {
        const userRecipesList = await storage.getUserRecipes(req.session.userId);
        const style = input.mealStyle ?? 'simple';
        const limit = (prefs as any).recipeWeeklyLimit ?? 5;
        const enabledSlots: string[] = (prefs as any).recipeEnabledSlots ?? ["breakfast", "lunch", "dinner", "snack"];
        const eligible = userRecipesList.filter(r =>
          r.caloriesPerServing > 0 && r.proteinPerServing > 0 && r.carbsPerServing > 0 && r.fatPerServing > 0 &&
          r.mealStyle === style &&
          enabledSlots.includes(r.mealSlot) &&
          !containsExcludedKeyword(r.name, excludeKws)
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
          if (baseDb[slot] && !containsExcludedKeyword(cm.name, excludeKws)) {
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
      ? computeCyclePhase(prefs.lastPeriodDate, prefs.cycleLength ?? 28)
      : null;
    const picked = pickBestMeal(candidates, tProtein, tCarbs, tFat, prefs, replCyclePhase);

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
      mealStyle: z.enum(['simple', 'gourmet', 'michelin']).optional().default('simple'),
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

    let baseDb: MealDb = plan.mealStyle === 'michelin' ? MICHELIN_MEAL_DATABASE : plan.mealStyle === 'gourmet' ? GOURMET_MEAL_DATABASE : MEAL_DATABASE;
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
      newPlanData = generateMealPlan(dailyCal, dailyProt, dailyCarbs, dailyFat, false, baseDb, prefs, cyclePhase);
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
  const html = buildMealPlanEmailHtml(plan.name, user.name, plan.planData as any, plan.planType, shoppingList);
  await sendEmail({ to: user.email, subject: `Your Fuelr plan: ${plan.name}`, html });
  res.json({ message: "Plan sent to your email." });
});

export default router;
