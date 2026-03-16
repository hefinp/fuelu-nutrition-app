import OpenAI from "openai";
import { z } from "zod";
import { storage } from "../storage";

const openai = new OpenAI();

export interface IngredientResult {
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

const NON_GRAM_UNIT_PATTERN = /^(\d+(?:[./]\d+)?(?:\s*-\s*\d+(?:[./]\d+)?)?)\s*(tbsp|tablespoons?|tsp|teaspoons?|cups?|oz|ounces?|ml|milliliters?|l|liters?|litres?|lbs?|pounds?|kg|kilograms?|pieces?|pcs?|slices?|cloves?|stalks?|sticks?|heads?|bunche?s?|cans?|bottles?|pinche?s?|dashe?s?|handfuls?|sprigs?)\s+(?:of\s+)?(.+)$/i;

const BARE_COUNT_PATTERN = /^(\d+(?:[./]\d+)?)\s+(.+)$/i;

export interface ParsedLine {
  name: string;
  grams: number;
  needsAiConversion: boolean;
  originalLine: string;
}

export function parseIngredientLine(line: string): ParsedLine {
  const trimmed = line.trim();

  const gramsMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*g(?:rams?)?\s+(.+)$/i);
  if (gramsMatch) {
    return { grams: parseFloat(gramsMatch[1]), name: gramsMatch[2].trim(), needsAiConversion: false, originalLine: trimmed };
  }
  const revMatch = trimmed.match(/^(.+?)[,\s]+(\d+(?:\.\d+)?)\s*g(?:rams?)?$/i);
  if (revMatch) {
    return { grams: parseFloat(revMatch[2]), name: revMatch[1].trim(), needsAiConversion: false, originalLine: trimmed };
  }

  if (NON_GRAM_UNIT_PATTERN.test(trimmed)) {
    return { name: trimmed, grams: 100, needsAiConversion: true, originalLine: trimmed };
  }

  if (BARE_COUNT_PATTERN.test(trimmed)) {
    return { name: trimmed, grams: 100, needsAiConversion: true, originalLine: trimmed };
  }

  if (!/\d/.test(trimmed)) {
    return { name: trimmed, grams: 100, needsAiConversion: true, originalLine: trimmed };
  }

  return { name: trimmed, grams: 100, needsAiConversion: false, originalLine: trimmed };
}

const aiGramsSchema = z.object({
  name: z.string(),
  grams: z.number().min(0),
});

export async function aiConvertToGrams(description: string): Promise<{ name: string; grams: number } | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a culinary measurement expert. Convert the given ingredient description into grams. Return JSON with:
- name (string): the cleaned ingredient name without quantities or units
- grams (number): the total weight in grams

Examples:
- "2 tbsp olive oil" → {"name": "olive oil", "grams": 27}
- "1 cup flour" → {"name": "flour", "grams": 125}
- "3 eggs" → {"name": "eggs", "grams": 150}
- "1 oz butter" → {"name": "butter", "grams": 28}
- "chicken" (no quantity) → {"name": "chicken", "grams": 150} (single serving estimate)
- "salt" (no quantity) → {"name": "salt", "grams": 2} (typical recipe amount)

For items with no quantity, estimate a reasonable single-serving or typical recipe amount.
Respond ONLY with JSON.`,
        },
        { role: "user", content: description },
      ],
      max_tokens: 150,
    });
    const text = response.choices[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    const validated = aiGramsSchema.parse(parsed);
    return {
      name: validated.name,
      grams: Math.max(1, Math.round(validated.grams)),
    };
  } catch {
    return null;
  }
}

export async function searchFoodDb(name: string): Promise<{ calories100g: number; protein100g: number; carbs100g: number; fat100g: number } | null> {
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

export async function aiEstimateIngredient(description: string): Promise<AiEstimate | null> {
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

export async function parseIngredients(ingredientText: string, userId?: number): Promise<IngredientResult[]> {
  const lines = ingredientText.split("\n").map(l => l.trim()).filter(Boolean);
  const results: IngredientResult[] = [];
  const gramsCache = new Map<string, { name: string; grams: number } | null>();

  for (const line of lines) {
    const parsed = parseIngredientLine(line);
    let { name, grams } = parsed;

    if (parsed.needsAiConversion && process.env.OPENAI_API_KEY) {
      const cacheKey = parsed.originalLine.toLowerCase();
      let converted: { name: string; grams: number } | null | undefined = gramsCache.get(cacheKey);
      if (converted === undefined) {
        converted = await aiConvertToGrams(parsed.originalLine);
        gramsCache.set(cacheKey, converted);
      }
      if (converted) {
        name = converted.name;
        grams = converted.grams;
      }
    }

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
      if (userId) {
        try {
          await storage.addUserSavedFood({
            userId,
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

  return results;
}
