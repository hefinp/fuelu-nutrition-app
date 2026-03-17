import { Router } from "express";
import { z } from "zod";
import { parseIngredients } from "../lib/ingredient-parser";
import { storage } from "../storage";

const router = Router();

router.post("/api/meals/parse-ingredients", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const { ingredients } = z.object({ ingredients: z.string().min(1) }).parse(req.body);

  const results = await parseIngredients(ingredients, req.session.userId);

  res.json(results);
});

router.post("/api/canonical-foods/check-names", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const { names } = z.object({ names: z.array(z.string()).max(50) }).parse(req.body);
    const matched = await storage.checkCanonicalFoodNames(names);
    res.json({ matched: Array.from(matched) });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to check canonical names" });
  }
});

export default router;
