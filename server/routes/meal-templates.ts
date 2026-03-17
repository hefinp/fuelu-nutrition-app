import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;

const dayMap: Record<number, string> = {
  0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
  4: "thursday", 5: "friday", 6: "saturday",
};

router.get("/api/meal-templates", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const templates = await storage.getMealTemplates(req.session.userId);
  const mealsResult = await storage.getUserMeals(req.session.userId, { limit: 10000 });
  const mealsMap = new Map(mealsResult.items.map(m => [m.id, m.name]));
  const enriched = templates.map(t => ({
    ...t,
    mealName: mealsMap.get(t.userMealId) ?? null,
  }));
  res.json(enriched);
});

router.post("/api/meal-templates", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      userMealId: z.number().int().positive(),
      mealSlot: z.enum(SLOTS),
      daysOfWeek: z.array(z.enum(DAYS)).min(1),
    }).parse(req.body);

    const mealsResult = await storage.getUserMeals(req.session.userId, { limit: 10000 });
    const ownsMeal = mealsResult.items.some(m => m.id === body.userMealId);
    if (!ownsMeal) return res.status(404).json({ message: "Meal not found" });

    const template = await storage.createMealTemplate({
      userId: req.session.userId,
      ...body,
    });
    res.status(201).json(template);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.patch("/api/meal-templates/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  try {
    const body = z.object({
      mealSlot: z.enum(SLOTS).optional(),
      daysOfWeek: z.array(z.enum(DAYS)).min(1).optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const updated = await storage.updateMealTemplate(id, req.session.userId, body);
    if (!updated) return res.status(404).json({ message: "Template not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.delete("/api/meal-templates/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
  await storage.deleteMealTemplate(id, req.session.userId);
  res.json({ message: "Deleted" });
});

router.get("/api/meal-templates/suggestions", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const jsDay = new Date(date + "T12:00:00").getDay();
  const dayName = dayMap[jsDay];

  const templates = await storage.getMealTemplates(req.session.userId);
  const active = templates.filter(t => t.active && t.daysOfWeek.includes(dayName));

  if (active.length === 0) return res.json([]);

  const existingEntries = await storage.getFoodLogEntries(req.session.userId, date);

  const mealsResult = await storage.getUserMeals(req.session.userId, { limit: 10000 });
  const mealsMap = new Map(mealsResult.items.map(m => [m.id, m]));

  const suggestions = active
    .map(t => {
      const meal = mealsMap.get(t.userMealId);
      if (!meal) return null;

      const alreadyLogged = existingEntries.some(
        e => e.mealSlot === t.mealSlot
      );
      if (alreadyLogged) return null;

      return {
        templateId: t.id,
        mealSlot: t.mealSlot,
        meal: {
          id: meal.id,
          name: meal.name,
          caloriesPerServing: meal.caloriesPerServing,
          proteinPerServing: meal.proteinPerServing,
          carbsPerServing: meal.carbsPerServing,
          fatPerServing: meal.fatPerServing,
          mealSlot: meal.mealSlot,
        },
      };
    })
    .filter(Boolean);

  res.json(suggestions);
});

export default router;
