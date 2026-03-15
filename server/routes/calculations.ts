import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { userPreferencesSchema, type UserPreferences } from "@shared/schema";
import { calculateMacros } from "../meal-data";

const router = Router();

const previewSchema = z.object({
  weight: z.coerce.number().min(30).max(300),
  height: z.coerce.number().min(100).max(250),
  age: z.coerce.number().int().min(13).max(99),
  gender: z.enum(["male", "female"]).default("male"),
  goal: z.enum(["lose", "maintain", "muscle"]).default("maintain"),
});

router.post("/api/calculations/preview", async (req, res) => {
  try {
    const { weight, height, age, gender, goal } = previewSchema.parse(req.body);
    const macros = calculateMacros(weight, height, age, gender, "moderate", goal);
    res.json(macros);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    res.status(400).json({ message: "Invalid input" });
  }
});

router.post(api.calculations.create.path, async (req, res) => {
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
      goal: input.goal || 'maintain',
      targetType: input.targetType,
      targetAmount: input.targetAmount && input.targetAmount !== '' ? input.targetAmount : null,
      userId: req.session.userId,
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

router.get(api.calculations.list.path, async (req, res) => {
  const calcs = await storage.getCalculations(req.session.userId);
  res.status(200).json(calcs);
});

router.get("/api/user/preferences", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const user = await storage.getUserById(req.session.userId);
  const defaults: UserPreferences = { diet: null, allergies: [], excludedFoods: [], preferredFoods: [], micronutrientOptimize: false };
  const prefs = (user?.preferences as UserPreferences | null) ?? defaults;
  if (prefs.onboardingComplete === undefined) {
    prefs.onboardingComplete = true;
    await storage.updateUserPreferences(req.session.userId, prefs);
  }
  res.json(prefs);
});

router.put("/api/user/preferences", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const prefs = userPreferencesSchema.parse(req.body);
  await storage.updateUserPreferences(req.session.userId, prefs);
  res.json(prefs);
});

export default router;
