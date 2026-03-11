import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, mealPlanSchema } from "@shared/routes";
import { z } from "zod";

const MEAL_DATABASE = {
  breakfast: [
    { meal: "Scrambled eggs (3) with whole grain toast", calories: 380, protein: 20, carbs: 32, fat: 12 },
    { meal: "Oatmeal with berries and almonds", calories: 340, protein: 12, carbs: 48, fat: 8 },
    { meal: "Greek yogurt with granola and honey", calories: 380, protein: 18, carbs: 52, fat: 8 },
    { meal: "Pancakes (2) with maple syrup and bacon", calories: 450, protein: 15, carbs: 60, fat: 14 },
    { meal: "Smoothie bowl with fruit and nuts", calories: 420, protein: 15, carbs: 58, fat: 10 },
    { meal: "Chia seed pudding with coconut milk", calories: 320, protein: 10, carbs: 38, fat: 14 },
  ],
  lunch: [
    { meal: "Grilled chicken breast with brown rice and broccoli", calories: 520, protein: 45, carbs: 52, fat: 8 },
    { meal: "Turkey sandwich with avocado and vegetables", calories: 480, protein: 28, carbs: 48, fat: 16 },
    { meal: "Tuna salad with olive oil dressing", calories: 420, protein: 35, carbs: 28, fat: 14 },
    { meal: "Quinoa bowl with chickpeas and vegetables", calories: 450, protein: 16, carbs: 58, fat: 12 },
    { meal: "Salmon with sweet potato and asparagus", calories: 540, protein: 40, carbs: 48, fat: 16 },
    { meal: "Beef stir-fry with brown rice and mixed vegetables", calories: 580, protein: 38, carbs: 62, fat: 12 },
  ],
  dinner: [
    { meal: "Baked chicken with roasted vegetables and pasta", calories: 620, protein: 40, carbs: 70, fat: 12 },
    { meal: "Lean beef with mashed potatoes and green beans", calories: 680, protein: 45, carbs: 68, fat: 14 },
    { meal: "Grilled fish with wild rice and vegetables", calories: 580, protein: 42, carbs: 58, fat: 12 },
    { meal: "Pork tenderloin with sweet potato and spinach", calories: 620, protein: 42, carbs: 62, fat: 14 },
    { meal: "Turkey meatballs with spaghetti and marinara", calories: 560, protein: 38, carbs: 68, fat: 10 },
    { meal: "Chicken fajitas with brown rice and beans", calories: 640, protein: 38, carbs: 78, fat: 12 },
  ],
  snack: [
    { meal: "Protein bar and apple", calories: 280, protein: 20, carbs: 32, fat: 8 },
    { meal: "Greek yogurt with granola", calories: 200, protein: 15, carbs: 24, fat: 4 },
    { meal: "Trail mix and banana", calories: 320, protein: 10, carbs: 42, fat: 12 },
    { meal: "Cottage cheese with berries", calories: 220, protein: 18, carbs: 20, fat: 6 },
    { meal: "Peanut butter and whole grain crackers", calories: 280, protein: 12, carbs: 28, fat: 14 },
    { meal: "Hard-boiled eggs and almonds", calories: 240, protein: 16, carbs: 12, fat: 14 },
  ],
};

type MealEntry = { meal: string; calories: number; protein: number; carbs: number; fat: number };

function buildDayPlan(dailyCalories: number, lunchOverride?: MealEntry) {
  const breakfast = MEAL_DATABASE.breakfast[Math.floor(Math.random() * MEAL_DATABASE.breakfast.length)];
  const lunch = lunchOverride ?? MEAL_DATABASE.lunch[Math.floor(Math.random() * MEAL_DATABASE.lunch.length)];
  const dinner = MEAL_DATABASE.dinner[Math.floor(Math.random() * MEAL_DATABASE.dinner.length)];

  let dayTotalCalories = breakfast.calories + lunch.calories + dinner.calories;
  let dayTotalProtein = breakfast.protein + lunch.protein + dinner.protein;
  let dayTotalCarbs = breakfast.carbs + lunch.carbs + dinner.carbs;
  let dayTotalFat = breakfast.fat + lunch.fat + dinner.fat;

  const snacksList: MealEntry[] = [];
  let remaining = dailyCalories - dayTotalCalories;

  while (remaining > 150 && snacksList.length < 2) {
    const snack = MEAL_DATABASE.snack[Math.floor(Math.random() * MEAL_DATABASE.snack.length)];
    if (snack.calories <= remaining) {
      snacksList.push(snack);
      remaining -= snack.calories;
      dayTotalCalories += snack.calories;
      dayTotalProtein += snack.protein;
      dayTotalCarbs += snack.carbs;
      dayTotalFat += snack.fat;
    } else {
      break;
    }
  }

  return {
    breakfast: [breakfast],
    lunch: [lunch],
    dinner: [dinner],
    snacks: snacksList,
    dayTotalCalories,
    dayTotalProtein,
    dayTotalCarbs,
    dayTotalFat,
  };
}

function generateDayPlan(dailyCalories: number) {
  return buildDayPlan(dailyCalories);
}

function generateMealPlan(dailyCalories: number, proteinGoal: number, carbsGoal: number, fatGoal: number, isWeekly: boolean) {
  if (isWeekly) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    const weekPlan: any = {};
    let weekTotalCalories = 0;
    let weekTotalProtein = 0;
    let weekTotalCarbs = 0;
    let weekTotalFat = 0;

    let previousDinner: MealEntry | undefined = undefined;

    days.forEach((day, index) => {
      // Monday (index 0): lunch = Monday's own dinner, so we build without override first,
      // then re-use that dinner as its own lunch.
      // All other days: lunch = previous day's dinner.
      let dayPlan: ReturnType<typeof buildDayPlan>;

      if (index === 0) {
        // Build Monday fully random, then set lunch = its own dinner
        const mondayBase = buildDayPlan(dailyCalories);
        const mondayDinner = mondayBase.dinner[0];
        // Recalculate totals replacing the random lunch with the dinner
        const lunchDiff = {
          calories: mondayDinner.calories - mondayBase.lunch[0].calories,
          protein: mondayDinner.protein - mondayBase.lunch[0].protein,
          carbs: mondayDinner.carbs - mondayBase.lunch[0].carbs,
          fat: mondayDinner.fat - mondayBase.lunch[0].fat,
        };
        dayPlan = {
          ...mondayBase,
          lunch: [mondayDinner],
          dayTotalCalories: mondayBase.dayTotalCalories + lunchDiff.calories,
          dayTotalProtein: mondayBase.dayTotalProtein + lunchDiff.protein,
          dayTotalCarbs: mondayBase.dayTotalCarbs + lunchDiff.carbs,
          dayTotalFat: mondayBase.dayTotalFat + lunchDiff.fat,
        };
        previousDinner = mondayBase.dinner[0];
      } else {
        // Use previous day's dinner as today's lunch
        dayPlan = buildDayPlan(dailyCalories, previousDinner);
        previousDinner = dayPlan.dinner[0];
      }

      weekPlan[day] = dayPlan;
      weekTotalCalories += dayPlan.dayTotalCalories;
      weekTotalProtein += dayPlan.dayTotalProtein;
      weekTotalCarbs += dayPlan.dayTotalCarbs;
      weekTotalFat += dayPlan.dayTotalFat;
    });

    return {
      planType: 'weekly' as const,
      ...weekPlan,
      weekTotalCalories,
      weekTotalProtein,
      weekTotalCarbs,
      weekTotalFat,
    };
  } else {
    const dayPlan = generateDayPlan(dailyCalories);
    return {
      planType: 'daily' as const,
      ...dayPlan,
    };
  }
}

function calculateMacros(weight: number, height: number, age: number, gender: string, activityLevel: string, goal: string = 'maintain') {
  // Mifflin-St Jeor Equation
  // Men: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5
  // Women: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161
  
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  if (gender === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }

  let activityMultiplier = 1.2;
  switch (activityLevel) {
    case 'sedentary': activityMultiplier = 1.2; break;
    case 'light': activityMultiplier = 1.375; break;
    case 'moderate': activityMultiplier = 1.55; break;
    case 'active': activityMultiplier = 1.725; break;
    case 'very_active': activityMultiplier = 1.9; break;
  }

  let dailyCalories = Math.round(bmr * activityMultiplier);

  // Adjust based on body goal
  switch (goal) {
    case 'fat_loss':
      dailyCalories = Math.round(dailyCalories - 500); // aggressive deficit for fat loss
      break;
    case 'tone':
      dailyCalories = Math.round(dailyCalories - 250); // mild deficit to lean out while preserving muscle
      break;
    case 'maintain':
      break; // no adjustment
    case 'muscle':
      dailyCalories = Math.round(dailyCalories + 300); // lean surplus to build muscle with minimal fat
      break;
    case 'bulk':
      dailyCalories = Math.round(dailyCalories + 600); // larger surplus for maximum muscle growth
      break;
    // legacy support
    case 'lose':
      dailyCalories = Math.round(dailyCalories - 500);
      break;
    case 'gain':
      dailyCalories = Math.round(dailyCalories + 500);
      break;
    default:
      break;
  }

  const weeklyCalories = dailyCalories * 7;

  // Macros: 30% protein, 40% carbs, 30% fat
  // Protein: 4 cals/g
  // Carbs: 4 cals/g
  // Fat: 9 cals/g
  const proteinGoal = Math.round((dailyCalories * 0.3) / 4);
  const carbsGoal = Math.round((dailyCalories * 0.4) / 4);
  const fatGoal = Math.round((dailyCalories * 0.3) / 9);

  return { dailyCalories, weeklyCalories, proteinGoal, carbsGoal, fatGoal };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post(api.calculations.create.path, async (req, res) => {
    try {
      const bodySchema = api.calculations.create.input.extend({
        weight: z.coerce.string(),
        height: z.coerce.string(),
        age: z.coerce.number().optional().default(30),
      });
      const input = bodySchema.parse(req.body);
      
      const weightNum = parseFloat(input.weight);
      const heightNum = parseFloat(input.height);
      const ageNum = input.age || 30;
      
      const macros = calculateMacros(weightNum, heightNum, ageNum, input.gender || 'male', input.activityLevel || 'moderate', input.goal || 'maintain');
      
      const calcData = {
        weight: input.weight,
        height: input.height,
        age: ageNum,
        gender: input.gender || 'male',
        activityLevel: input.activityLevel || 'moderate',
        ...macros
      };

      const calculation = await storage.createCalculation(calcData);
      res.status(201).json(calculation);
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

  app.get(api.calculations.list.path, async (req, res) => {
    const calcs = await storage.getCalculations();
    res.status(200).json(calcs);
  });

  app.post(api.mealPlans.generate.path, async (req, res) => {
    try {
      const input = mealPlanSchema.parse(req.body);
      const mealPlan = generateMealPlan(input.dailyCalories, input.proteinGoal, input.carbsGoal, input.fatGoal, input.planType === 'weekly');
      res.status(201).json(mealPlan);
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

  return httpServer;
}
