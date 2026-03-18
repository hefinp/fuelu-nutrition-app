import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { parseIngredients, type IngredientResult } from "../lib/ingredient-parser";

const router = Router();

const paginationSchema = z.object({
  cursor: z.string().regex(/^\d{4}-.*\|\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  slot: z.string().max(20).optional(),
});

const ingredientItemSchema = z.object({
  key: z.string(),
  name: z.string(),
  calories100g: z.number(),
  protein100g: z.number(),
  carbs100g: z.number(),
  fat100g: z.number(),
  grams: z.number(),
});

router.get("/api/user-meals", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const params = paginationSchema.parse(req.query);
    const result = await storage.getUserMeals(req.session.userId, { cursor: params.cursor, limit: params.limit, search: params.search, slot: params.slot });
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to fetch meals" });
  }
});

router.get("/api/user-meals/:id/ingredients", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const rows = await storage.getMealIngredients(id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch meal ingredients" });
  }
});

router.post("/api/user-meals/:id/recompute-macros", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.recomputeMealMacros(id, req.session.userId);
    if (!updated) return res.status(404).json({ message: "Meal not found or no ingredients" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to recompute macros" });
  }
});

router.post("/api/user-meals", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      name: z.string().min(1),
      source: z.enum(["logged", "imported", "community", "manual"]).default("manual"),
      caloriesPerServing: z.number().int().min(0),
      proteinPerServing: z.number().min(0),
      carbsPerServing: z.number().min(0),
      fatPerServing: z.number().min(0),
      servings: z.number().int().min(1).default(1),
      sourceUrl: z.string().nullable().optional(),
      imageUrl: z.string().nullable().optional(),
      mealSlot: z.string().nullable().optional(),
      mealStyle: z.string().default("simple"),
      ingredients: z.string().nullable().optional(),
      ingredientsJson: z.array(ingredientItemSchema).nullable().optional(),
      instructions: z.string().nullable().optional(),
      sourcePhotos: z.array(z.string()).nullable().optional(),
      communityMealId: z.number().int().optional(),
      confirmDuplicate: z.boolean().optional(),
    }).parse(req.body);

    const { communityMealId, confirmDuplicate, ...mealData } = body;

    if (!confirmDuplicate) {
      const duplicates = await storage.findDuplicateUserMeals(req.session.userId, mealData.name);
      if (duplicates.length > 0) {
        const exactMatch = duplicates.some(d =>
          d.caloriesPerServing === mealData.caloriesPerServing &&
          d.proteinPerServing === mealData.proteinPerServing &&
          d.carbsPerServing === mealData.carbsPerServing &&
          d.fatPerServing === mealData.fatPerServing
        );
        return res.status(409).json({
          duplicateWarning: true,
          exactMatch,
          existingCount: duplicates.length,
          message: exactMatch
            ? `You already have "${duplicates[0].name}" with identical macros.`
            : `You already have ${duplicates.length} meal${duplicates.length > 1 ? "s" : ""} named "${duplicates[0].name}".`,
        });
      }
    }

    if (communityMealId && (!mealData.ingredients || !mealData.instructions)) {
      const cm = await storage.getCommunityMealById(communityMealId).catch(() => undefined);
      if (cm) {
        if (!mealData.ingredients && cm.ingredients && cm.ingredients.length > 0) {
          mealData.ingredients = cm.ingredients.join("\n");
        }
        if (!mealData.instructions && cm.instructions) {
          mealData.instructions = cm.instructions;
        }
        if (!mealData.ingredientsJson && cm.ingredientsJson) {
          mealData.ingredientsJson = cm.ingredientsJson as IngredientResult[];
        }
      }
    }

    if (!mealData.ingredientsJson && mealData.ingredients) {
      try {
        const parsed = await parseIngredients(mealData.ingredients, req.session.userId);
        mealData.ingredientsJson = parsed.length > 0 ? parsed : [];
      } catch (e) {
        console.error("[user-meals] Failed to auto-parse ingredients:", e);
        mealData.ingredientsJson = [];
      }
    }

    const created = await storage.createUserMeal({ ...mealData, userId: req.session.userId });

    if (communityMealId) {
      await storage.incrementCommunityMealFavourite(communityMealId).catch(() => {});
    }

    if (created.ingredientsJson && Array.isArray(created.ingredientsJson) && (created.ingredientsJson as any[]).length > 0) {
      if (mealData.source === "community" || communityMealId) {
        storage.syncMealIngredientsFromJson(created.id, created.ingredientsJson as any[])
          .catch(err => console.error("[user-meals] Failed to sync junction on community create:", err));
      } else {
        storage.syncMealIngredientsFromJson(created.id, created.ingredientsJson as any[])
          .then(() => storage.recomputeMealMacros(created.id, req.session.userId!))
          .catch(err => console.error("[user-meals] Failed to sync/recompute on create:", err));
      }
    }

    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to create meal" });
  }
});

router.patch("/api/user-meals/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const body = z.object({
      name: z.string().min(1).optional(),
      caloriesPerServing: z.number().int().min(0).optional(),
      proteinPerServing: z.number().min(0).optional(),
      carbsPerServing: z.number().min(0).optional(),
      fatPerServing: z.number().min(0).optional(),
      servings: z.number().int().min(1).optional(),
      mealSlot: z.string().nullable().optional(),
      mealStyle: z.string().optional(),
      instructions: z.string().nullable().optional(),
      ingredients: z.string().nullable().optional(),
      ingredientsJson: z.array(ingredientItemSchema).nullable().optional(),
    }).parse(req.body);

    if (body.ingredients && !body.ingredientsJson) {
      try {
        const parsed = await parseIngredients(body.ingredients, req.session.userId);
        body.ingredientsJson = parsed.length > 0 ? parsed : [];
      } catch (e) {
        console.error("[user-meals] Failed to auto-parse ingredients on update:", e);
        body.ingredientsJson = [];
      }
    }

    const updated = await storage.updateUserMeal(id, req.session.userId, body);
    if (!updated) return res.status(404).json({ message: "Not found" });

    // Sync junction rows then recompute macros from canonical DB
    if (body.ingredientsJson !== undefined) {
      const ingJson = body.ingredientsJson;
      if (ingJson && ingJson.length > 0) {
        storage.syncMealIngredientsFromJson(id, ingJson)
          .then(() => storage.recomputeMealMacros(id, req.session.userId!))
          .catch(err => console.error("[user-meals] Failed to sync/recompute on update:", err));
      } else {
        storage.deleteMealIngredients(id).catch(() => {});
      }
    }

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update meal" });
  }
});

router.delete("/api/user-meals/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    await storage.deleteUserMeal(parseInt(req.params.id), req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete meal" });
  }
});

export default router;
