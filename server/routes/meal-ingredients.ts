import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { storage } from "../storage";

const router = Router();
const openai = new OpenAI();

interface IngredientResult {
  key: string;
  name: string;
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  grams: number;
  source: "db" | "ai";
}

interface UsdaNutrient {
  nutrientId: number;
  value: number;
}

interface UsdaFood {
  fdcId: number;
  description: string;
  foodNutrients?: UsdaNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
}

interface UsdaSearchResponse {
  foods?: UsdaFood[];
}

function getNutrient(nutrients: UsdaNutrient[], id: number): number {
  return nutrients.find(n => n.nutrientId === id)?.value ?? 0;
}

function parseIngredientLine(line: string): { name: string; grams: number } {
  const trimmed = line.trim();
  const gramsMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*g(?:rams?)?\s+(.+)$/i);
  if (gramsMatch) {
    return { grams: parseFloat(gramsMatch[1]), name: gramsMatch[2].trim() };
  }
  const revMatch = trimmed.match(/^(.+?)[,\s]+(\d+(?:\.\d+)?)\s*g(?:rams?)?$/i);
  if (revMatch) {
    return { grams: parseFloat(revMatch[2]), name: revMatch[1].trim() };
  }
  return { name: trimmed, grams: 100 };
}

async function searchFoodDb(name: string): Promise<{ calories100g: number; protein100g: number; carbs100g: number; fat100g: number } | null> {
  try {
    const communityHits = await storage.searchCustomFoodsByName(name);
    if (communityHits.length > 0) {
      const hit = communityHits[0];
      return {
        calories100g: hit.calories100g,
        protein100g: parseFloat(String(hit.protein100g)),
        carbs100g: parseFloat(String(hit.carbs100g)),
        fat100g: parseFloat(String(hit.fat100g)),
      };
    }

    const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(name)}&pageSize=3&api_key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as UsdaSearchResponse;
    const foods = data.foods ?? [];
    if (foods.length === 0) return null;
    const food = foods[0];
    const nutrients = food.foodNutrients ?? [];
    const calories = getNutrient(nutrients, 1008) || getNutrient(nutrients, 2047) || getNutrient(nutrients, 2048);
    if (!calories) return null;
    return {
      calories100g: Math.round(calories),
      protein100g: Math.round(getNutrient(nutrients, 1003) * 10) / 10,
      carbs100g: Math.round(getNutrient(nutrients, 1005) * 10) / 10,
      fat100g: Math.round(getNutrient(nutrients, 1004) * 10) / 10,
    };
  } catch {
    return null;
  }
}

interface AiEstimate {
  name: string;
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
}

const aiEstimateSchema = z.object({
  name: z.string(),
  calories100g: z.number(),
  protein100g: z.number(),
  carbs100g: z.number(),
  fat100g: z.number(),
});

async function aiEstimateIngredient(description: string): Promise<AiEstimate | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a nutrition expert. Estimate nutritional values per 100g for the given food item. Return JSON with: name (string, cleaned food name), calories100g (number), protein100g (number), carbs100g (number), fat100g (number). Respond ONLY with JSON.`,
        },
        { role: "user", content: `Food: ${description}` },
      ],
      max_tokens: 200,
    });
    const text = response.choices[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    const validated = aiEstimateSchema.parse(parsed);
    return {
      name: validated.name,
      calories100g: Math.round(validated.calories100g),
      protein100g: Math.round(validated.protein100g * 10) / 10,
      carbs100g: Math.round(validated.carbs100g * 10) / 10,
      fat100g: Math.round(validated.fat100g * 10) / 10,
    };
  } catch {
    return null;
  }
}

router.post("/api/meals/parse-ingredients", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const { ingredients } = z.object({ ingredients: z.string().min(1) }).parse(req.body);

  const lines = ingredients.split("\n").map(l => l.trim()).filter(Boolean);
  const results: IngredientResult[] = [];

  for (const line of lines) {
    const { name, grams } = parseIngredientLine(line);

    const dbResult = await searchFoodDb(name);
    if (dbResult) {
      results.push({
        key: `parsed-db-${Date.now()}-${Math.random()}`,
        name,
        grams,
        source: "db",
        ...dbResult,
      });
      continue;
    }

    if (!process.env.OPENAI_API_KEY) {
      results.push({
        key: `parsed-unknown-${Date.now()}-${Math.random()}`,
        name,
        grams,
        source: "ai",
        calories100g: 0,
        protein100g: 0,
        carbs100g: 0,
        fat100g: 0,
      });
      continue;
    }

    const aiResult = await aiEstimateIngredient(name);
    if (aiResult) {
      try {
        await storage.addUserSavedFood({
          userId: req.session.userId,
          name: aiResult.name,
          calories100g: aiResult.calories100g,
          protein100g: aiResult.protein100g,
          carbs100g: aiResult.carbs100g,
          fat100g: aiResult.fat100g,
          servingGrams: Math.round(grams) || 100,
          source: "ai-estimated",
        });
      } catch {
      }
      results.push({
        key: `parsed-ai-${Date.now()}-${Math.random()}`,
        name: aiResult.name,
        grams,
        source: "ai",
        calories100g: aiResult.calories100g,
        protein100g: aiResult.protein100g,
        carbs100g: aiResult.carbs100g,
        fat100g: aiResult.fat100g,
      });
    } else {
      results.push({
        key: `parsed-fallback-${Date.now()}-${Math.random()}`,
        name,
        grams,
        source: "ai",
        calories100g: 0,
        protein100g: 0,
        carbs100g: 0,
        fat100g: 0,
      });
    }
  }

  res.json(results);
});

export default router;
