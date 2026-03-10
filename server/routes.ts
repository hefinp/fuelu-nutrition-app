import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

function calculateMacros(weight: number, height: number, age: number, gender: string, activityLevel: string) {
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

  const dailyCalories = Math.round(bmr * activityMultiplier);
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
      
      const macros = calculateMacros(weightNum, heightNum, ageNum, input.gender || 'male', input.activityLevel || 'moderate');
      
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

  return httpServer;
}
