import { Router } from "express";
import type { Request, Response } from "express";
import OpenAI from "openai";
import { storage } from "../storage";

const router = Router();

router.get("/api/community-meals", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const slot = req.query.slot as string | undefined;
    const style = req.query.style as string | undefined;
    const meals = await storage.getCommunityMeals({ slot, style });
    res.json(meals);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch community meals" });
  }
});

router.post("/api/community-meals", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const { recipeId, name, slot, style, caloriesPerServing, proteinPerServing, carbsPerServing, fatPerServing, microScore } = req.body;
    if (!name || !slot || !style || caloriesPerServing == null || proteinPerServing == null || carbsPerServing == null || fatPerServing == null) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (recipeId) {
      const existing = await storage.getCommunityMealByRecipeId(Number(recipeId));
      if (existing) return res.status(409).json({ message: "Already shared", communityMeal: existing });
    }
    const meal = await storage.createCommunityMeal({
      sourceRecipeId: recipeId ? Number(recipeId) : null,
      sourceUserId: req.session.userId,
      name,
      slot,
      style,
      caloriesPerServing: Number(caloriesPerServing),
      proteinPerServing: Number(proteinPerServing),
      carbsPerServing: Number(carbsPerServing),
      fatPerServing: Number(fatPerServing),
      microScore: microScore ? Number(microScore) : 3,
      source: "user",
    });
    res.status(201).json(meal);
  } catch (err) {
    res.status(500).json({ message: "Failed to share meal" });
  }
});

router.delete("/api/community-meals/:id/unshare", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    await storage.deactivateCommunityMeal(Number(req.params.id), req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to unshare meal" });
  }
});

router.get("/api/community-meals/my", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const meals = await storage.getCommunityMealsByUser(req.session.userId);
    res.json(meals);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch shared meals" });
  }
});

router.get("/api/community-meals/:id/details", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    let meal = await storage.getCommunityMealById(Number(req.params.id));
    if (!meal) return res.status(404).json({ message: "Meal not found" });

    if (!meal.ingredients || meal.ingredients.length === 0) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a nutritionist generating recipe details. Return a JSON object with exactly two keys:
- "ingredients": array of ingredient strings (each item like "200g chicken breast" or "1 tbsp olive oil"), 6-12 items
- "instructions": a concise step-by-step cooking method as a single string with numbered steps separated by newlines

Tailor complexity to the meal style: simple = minimal steps, gourmet = refined technique, michelin = professional detail.
Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `Meal: "${meal.name}"
Style: ${meal.style}
Slot: ${meal.slot}
Macros: ${meal.caloriesPerServing} kcal, ${meal.proteinPerServing}g protein, ${meal.carbsPerServing}g carbs, ${meal.fatPerServing}g fat`,
          },
        ],
        max_tokens: 600,
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      let parsed: { ingredients?: string[]; instructions?: string } = {};
      try {
        parsed = JSON.parse(completion.choices[0].message.content || "{}");
      } catch {}

      const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
      const instructions = typeof parsed.instructions === "string" ? parsed.instructions : "";

      if (ingredients.length > 0) {
        meal = await storage.updateCommunityMealIngredients(meal.id, ingredients, instructions);
      }
    }

    res.json(meal);
  } catch (err) {
    console.error("[community-meals] details error:", err);
    res.status(500).json({ message: "Failed to fetch meal details" });
  }
});

const BUCKET_FLOOR = 8;

async function checkAndRefillCommunityMealBalance(autoFill = true): Promise<{ buckets: any[]; gapsFound: number; mealsGenerated: number }> {
  const balance = await storage.getCommunityMealBalance();
  const gaps = balance.filter(b => b.total < BUCKET_FLOOR);
  let mealsGenerated = 0;

  if (autoFill && gaps.length > 0) {
    const toGenerate = gaps.slice(0, Math.ceil(20 / Math.max(gaps.length, 1)));
    for (const gap of toGenerate) {
      const needed = BUCKET_FLOOR - gap.total;
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const resp = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a nutrition expert. Generate meal ideas as a JSON array. Each object must have: name (string), calories (number 200-900), protein (number >0), carbs (number >0), fat (number >0), microScore (integer 1-5). Return ONLY a valid JSON array, no markdown.",
            },
            {
              role: "user",
              content: `Generate ${needed} ${gap.style} ${gap.slot} meal ideas. Macros should be realistic and appropriate for a ${gap.slot}. Return a JSON array of ${needed} objects.`,
            },
          ],
          temperature: 0.9,
        });
        const raw = resp.choices[0]?.message?.content?.trim() ?? "[]";
        const cleaned = raw.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "");
        const generated: any[] = JSON.parse(cleaned);
        for (const m of generated) {
          if (!m.name || !m.calories || !m.protein || m.calories < 100 || m.calories > 1200) continue;
          await storage.createCommunityMeal({
            sourceRecipeId: null,
            sourceUserId: null,
            name: m.name,
            slot: gap.slot,
            style: gap.style,
            caloriesPerServing: Math.round(m.calories),
            proteinPerServing: Math.round(m.protein),
            carbsPerServing: Math.round(m.carbs ?? 0),
            fatPerServing: Math.round(m.fat ?? 0),
            microScore: Math.min(5, Math.max(1, Math.round(m.microScore ?? 3))),
            source: "ai_generated",
          });
          mealsGenerated++;
        }
      } catch (e) {
        console.error(`[community-meals] AI gap-fill failed for ${gap.style}/${gap.slot}:`, e);
      }
    }
  }

  const updatedBalance = await storage.getCommunityMealBalance();
  return { buckets: updatedBalance, gapsFound: gaps.length, mealsGenerated };
}

export { checkAndRefillCommunityMealBalance, BUCKET_FLOOR };

export default router;
