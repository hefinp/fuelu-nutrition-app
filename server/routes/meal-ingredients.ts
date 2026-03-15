import { Router } from "express";
import { z } from "zod";
import { parseIngredients } from "../lib/ingredient-parser";

const router = Router();

router.post("/api/meals/parse-ingredients", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const { ingredients } = z.object({ ingredients: z.string().min(1) }).parse(req.body);

  const results = await parseIngredients(ingredients, req.session.userId);

  res.json(results);
});

export default router;
