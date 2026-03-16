import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

router.get("/api/favourites", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit) : NaN;
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 100);
    const result = await storage.getFavouriteMeals(req.session.userId, { cursor, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch favourites" });
  }
});

router.post("/api/favourites", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const { mealName, calories, protein, carbs, fat, mealSlot, communityMealId, ingredients, instructions } = req.body;
    if (!mealName || calories == null || protein == null || carbs == null || fat == null) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    let finalIngredients: string | null = typeof ingredients === "string" ? ingredients : null;
    let finalInstructions: string | null = typeof instructions === "string" ? instructions : null;
    if (communityMealId && (!finalIngredients || !finalInstructions)) {
      const cm = await storage.getCommunityMealById(Number(communityMealId)).catch(() => undefined);
      if (cm) {
        if (!finalIngredients && cm.ingredients && cm.ingredients.length > 0) {
          finalIngredients = cm.ingredients.join("\n");
        }
        if (!finalInstructions && cm.instructions) {
          finalInstructions = cm.instructions;
        }
      }
    }
    const created = await storage.addFavouriteMeal({
      userId: req.session.userId,
      mealName,
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      mealSlot: mealSlot ?? null,
      ingredients: finalIngredients,
      instructions: finalInstructions,
    });
    if (communityMealId) {
      await storage.incrementCommunityMealFavourite(Number(communityMealId)).catch(() => {});
    }
    res.json(created);
  } catch (err) {
    res.status(500).json({ message: "Failed to save favourite" });
  }
});

router.patch("/api/favourites/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const ingredientItemSchema = z.object({
      key: z.string(),
      name: z.string(),
      calories100g: z.number(),
      protein100g: z.number(),
      carbs100g: z.number(),
      fat100g: z.number(),
      grams: z.number(),
    });
    const body = z.object({
      mealName: z.string().min(1).optional(),
      calories: z.number().int().min(0).optional(),
      protein: z.number().int().min(0).optional(),
      carbs: z.number().int().min(0).optional(),
      fat: z.number().int().min(0).optional(),
      mealSlot: z.string().nullable().optional(),
      ingredients: z.string().nullable().optional(),
      ingredientsJson: z.array(ingredientItemSchema).nullable().optional(),
      instructions: z.string().nullable().optional(),
    }).parse(req.body);
    const updated = await storage.updateFavouriteMeal(Number(req.params.id), req.session.userId, body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update favourite" });
  }
});

router.delete("/api/favourites/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    await storage.removeFavouriteMeal(Number(req.params.id), req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove favourite" });
  }
});

export default router;
