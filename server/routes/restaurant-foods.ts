import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

const searchParamsSchema = z.object({
  q: z.string().trim().optional().default(""),
  brand: z.string().trim().optional(),
});

router.get("/api/restaurant-foods/search", async (req, res) => {
  try {
    const params = searchParamsSchema.parse(req.query);
    const q = params.q;
    const brand = params.brand || null;
    if (!q && !brand) return res.json([]);
    const hits = await storage.searchRestaurantFoods(q, brand, 30);
    const results = hits.map(c => ({
      id: `canonical-${c.id}`,
      canonicalFoodId: c.id,
      name: c.name,
      calories100g: c.calories100g,
      protein100g: c.protein100g,
      carbs100g: c.carbs100g,
      fat100g: c.fat100g,
      fibre100g: c.fibre100g ?? null,
      sugar100g: c.sugar100g ?? null,
      saturatedFat100g: c.saturatedFat100g ?? null,
      servingSize: `${c.servingGrams}g`,
      servingGrams: c.servingGrams,
      brand: c.brand,
      category: c.category,
      imageUrl: c.imageUrl ?? null,
      sourceUrl: c.sourceUrl ?? null,
      cookTime: c.cookTime ?? null,
      ingredientsList: Array.isArray(c.ingredientsList) ? c.ingredientsList : null,
      source: c.source,
      verified: !!c.verifiedAt,
    }));
    res.json(results);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    console.error("[restaurant-foods/search] Error:", err);
    res.status(500).json({ message: "Search failed" });
  }
});

router.get("/api/restaurant-foods/brands", async (_req, res) => {
  try {
    const brands = await storage.getRestaurantBrands();
    res.json(brands);
  } catch (err) {
    console.error("[restaurant-foods/brands] Error:", err);
    res.status(500).json({ message: "Failed to load brands" });
  }
});

export default router;
