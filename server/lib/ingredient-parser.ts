import OpenAI from "openai";
import { z } from "zod";
import { storage } from "../storage";

const openai = new OpenAI();

export const SOURCE_QUALITY_MAP: Record<string, number> = {
  usda_cached: 100,
  nzfcd: 100,
  ausnut: 100,
  fsanz: 100,
  barcode_scan: 80,
  openfoodfacts: 80,
  open_food_facts: 80,
  nz_regional: 70,
  au_regional: 70,
  restaurant_nz: 70,
  user_manual: 60,
  ingredient_parsed: 40,
  ai_generated: 20,
};

export function getSourceQuality(source: string): number {
  return SOURCE_QUALITY_MAP[source] ?? 40;
}

export interface DivergenceWarning {
  calculatedCalories: number;
  statedCalories: number;
  ratio: number;
  message: string;
  isExtreme: boolean;
}

export interface IngredientResult {
  key: string;
  name: string;
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  grams: number;
  source: "db" | "ai";
  sourceDetail?: string;
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
  cleanedName: string;
  quantity: number;
  unit: string;
  grams: number;
  needsAiConversion: boolean;
  originalLine: string;
}

const UNIT_TO_GRAMS: Record<string, number> = {
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  cup: 240,
  cups: 240,
  oz: 28,
  ounce: 28,
  ounces: 28,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  lb: 454,
  lbs: 454,
  pound: 454,
  pounds: 454,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  pinch: 1,
  pinches: 1,
  dash: 1,
  dashes: 1,
  handful: 30,
  handfuls: 30,
  sprig: 2,
  sprigs: 2,
};

const COUNT_ITEM_GRAMS: Record<string, number> = {
  piece: 100,
  pieces: 100,
  pc: 100,
  pcs: 100,
  slice: 30,
  slices: 30,
  clove: 5,
  cloves: 5,
  stalk: 60,
  stalks: 60,
  stick: 10,
  sticks: 10,
  head: 500,
  heads: 500,
  bunch: 150,
  bunches: 150,
  can: 400,
  cans: 400,
  bottle: 500,
  bottles: 500,
};

function parseSingleQuantity(q: string): number {
  if (q.includes("/")) {
    const parts = q.split("/");
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  return parseFloat(q);
}

function parseQuantity(q: string): number {
  if (q.includes("-")) {
    const parts = q.split("-").map(p => parseSingleQuantity(p.trim()));
    return (parts[0] + parts[1]) / 2;
  }
  return parseSingleQuantity(q);
}

function fallbackConvertToGrams(quantity: number, unit: string): number | null {
  const lower = unit.toLowerCase().replace(/s$/, "");
  const gramsPerUnit = UNIT_TO_GRAMS[lower] ?? UNIT_TO_GRAMS[unit.toLowerCase()];
  if (gramsPerUnit != null) return Math.round(quantity * gramsPerUnit);
  const countGrams = COUNT_ITEM_GRAMS[lower] ?? COUNT_ITEM_GRAMS[unit.toLowerCase()];
  if (countGrams != null) return Math.round(quantity * countGrams);
  return null;
}

export function parseIngredientLine(line: string): ParsedLine {
  const trimmed = line.trim();

  const gramsMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*g(?:rams?)?\s+(.+)$/i);
  if (gramsMatch) {
    const cleanedName = gramsMatch[2].trim();
    return { grams: parseFloat(gramsMatch[1]), name: cleanedName, cleanedName, quantity: parseFloat(gramsMatch[1]), unit: "g", needsAiConversion: false, originalLine: trimmed };
  }
  const revMatch = trimmed.match(/^(.+?)[,\s]+(\d+(?:\.\d+)?)\s*g(?:rams?)?$/i);
  if (revMatch) {
    const cleanedName = revMatch[1].trim();
    return { grams: parseFloat(revMatch[2]), name: cleanedName, cleanedName, quantity: parseFloat(revMatch[2]), unit: "g", needsAiConversion: false, originalLine: trimmed };
  }

  const unitMatch = trimmed.match(NON_GRAM_UNIT_PATTERN);
  if (unitMatch) {
    const quantity = parseQuantity(unitMatch[1]);
    const unit = unitMatch[2];
    const cleanedName = unitMatch[3].trim();
    return { name: trimmed, cleanedName, quantity, unit, grams: 100, needsAiConversion: true, originalLine: trimmed };
  }

  const bareMatch = trimmed.match(BARE_COUNT_PATTERN);
  if (bareMatch) {
    const quantity = parseQuantity(bareMatch[1]);
    const cleanedName = bareMatch[2].trim();
    return { name: trimmed, cleanedName, quantity, unit: "", grams: 100, needsAiConversion: true, originalLine: trimmed };
  }

  if (!/\d/.test(trimmed)) {
    return { name: trimmed, cleanedName: trimmed, quantity: 1, unit: "", grams: 100, needsAiConversion: true, originalLine: trimmed };
  }

  return { name: trimmed, cleanedName: trimmed, quantity: 0, unit: "", grams: 100, needsAiConversion: false, originalLine: trimmed };
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
  } catch (err) {
    console.error("[aiConvertToGrams] Failed to convert:", description, err);
    return null;
  }
}

export async function searchFoodDb(name: string): Promise<{ calories100g: number; protein100g: number; carbs100g: number; fat100g: number; sourceDetail?: string } | null> {
  try {
    const canonicalHits = await storage.searchCanonicalFoods(name, 3);
    if (canonicalHits.length > 0) {
      const hit = canonicalHits[0];
      const clamped = clampNutritionToCeiling({
        name: hit.name,
        calories100g: hit.calories100g,
        protein100g: hit.protein100g,
        carbs100g: hit.carbs100g,
        fat100g: hit.fat100g,
      });
      return {
        calories100g: clamped.calories100g,
        protein100g: clamped.protein100g,
        carbs100g: clamped.carbs100g,
        fat100g: clamped.fat100g,
        sourceDetail: hit.source ?? "db",
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
    const foodName = food.description ? food.description.charAt(0).toUpperCase() + food.description.slice(1).toLowerCase() : name;
    const rawResult = {
      name: foodName,
      calories100g: Math.round(calories),
      protein100g: Math.round(getNutrient(nutrients, 1003) * 10) / 10,
      carbs100g: Math.round(getNutrient(nutrients, 1005) * 10) / 10,
      fat100g: Math.round(getNutrient(nutrients, 1004) * 10) / 10,
    };
    const sanitized = clampNutritionToCeiling(rawResult);
    const result = {
      calories100g: sanitized.calories100g,
      protein100g: sanitized.protein100g,
      carbs100g: sanitized.carbs100g,
      fat100g: sanitized.fat100g,
      sourceDetail: "usda_cached",
    };
    storage.upsertCanonicalFood({
      name: foodName,
      calories100g: result.calories100g,
      protein100g: result.protein100g,
      carbs100g: result.carbs100g,
      fat100g: result.fat100g,
      fdcId: food.fdcId ? String(food.fdcId) : null,
      source: "usda_cached",
    }).catch(() => {});
    return result;
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
          content: `You are a nutrition expert. Estimate nutritional values per 100g for the given food item. Return JSON with: name (string, cleaned food name), calories100g (number), protein100g (number), carbs100g (number), fat100g (number). Important: water, plain tea, black coffee, herbal tea, sparkling water, diet/zero-calorie drinks, salt, and vinegar have 0 calories and 0g of all macros per 100g. Calories must be consistent with macros: calories ≈ protein×4 + carbs×4 + fat×9. Respond ONLY with JSON.`,
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

const KNOWN_ZERO_CALORIE_PATTERNS = [
  /^water$/i, /^tap water$/i, /^ice$/i, /^ice water$/i,
  /^black coffee$/i, /^coffee$/i, /^espresso$/i,
  /^tea$/i, /^green tea$/i, /^black tea$/i, /^herbal tea$/i,
  /^diet\s/i, /^sugar.free\s/i, /^zero.calorie\s/i,
  /^sparkling water$/i, /^soda water$/i, /^mineral water$/i,
  /^club soda$/i,
  /^salt$/i, /^table salt$/i, /^sea salt$/i,
];

export function isKnownZeroCalorieFood(name: string): boolean {
  const cleaned = name.toLowerCase().trim();
  return KNOWN_ZERO_CALORIE_PATTERNS.some(p => p.test(cleaned));
}

const FRESH_PRODUCE_PATTERNS = [
  /\b(lettuce|spinach|kale|arugula|chard|cabbage|broccoli|cauliflower|celery|cucumber|zucchini|squash|eggplant|bell pepper|capsicum|tomato|cherry tomato|radish|turnip|beet|carrot|onion|leek|shallot|garlic|ginger|mushroom|asparagus|green bean|snap pea|snow pea|pea|corn|artichoke|fennel)\b/i,
  /\b(apple|banana|orange|lemon|lime|grapefruit|strawberr|blueberr|raspberr|blackberr|cranberr|grape|melon|watermelon|cantaloupe|honeydew|peach|nectarine|plum|pear|cherry|cherries|mango|papaya|pineapple|kiwi|pomegranate|fig|apricot|passion\s?fruit|dragon\s?fruit|lychee|guava)\b/i,
  /\b(mint|basil|cilantro|parsley|dill|chive|oregano|thyme|rosemary|sage|tarragon|coriander)\b/i,
];

const LIQUID_PATTERNS = [
  /\b(milk|juice|broth|stock|cream|yogurt|yoghurt|kefir|buttermilk|soy\s?milk|almond\s?milk|oat\s?milk|coconut\s?milk|rice\s?milk)\b/i,
  /\b(sauce|vinegar|wine|beer|soda|lemonade|smoothie|shake|soup)\b/i,
];

function getCategoryCalorieCap(name: string): number {
  const lower = name.toLowerCase();
  if (FRESH_PRODUCE_PATTERNS.some(p => p.test(lower))) return 100;
  if (LIQUID_PATTERNS.some(p => p.test(lower))) return 400;
  return 900;
}

function clampNutritionToCeiling(est: { name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number }): { name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number } {
  const cap = getCategoryCalorieCap(est.name);
  if (est.calories100g <= cap) return est;

  const scale = cap / est.calories100g;
  console.warn(`[sanitizeNutrition] "${est.name}" calories100g (${est.calories100g}) exceeds cap (${cap}) — clamping and scaling macros by ${scale.toFixed(2)}`);
  return {
    name: est.name,
    calories100g: Math.round(cap),
    protein100g: Math.round(est.protein100g * scale * 10) / 10,
    carbs100g: Math.round(est.carbs100g * scale * 10) / 10,
    fat100g: Math.round(est.fat100g * scale * 10) / 10,
  };
}

function sanitizeAiNutrition(est: { name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number }): { name: string; calories100g: number; protein100g: number; carbs100g: number; fat100g: number } {
  const { name, calories100g, protein100g, carbs100g, fat100g } = est;
  const macroCalories = protein100g * 4 + carbs100g * 4 + fat100g * 9;
  const macroSum = protein100g + carbs100g + fat100g;

  if (isKnownZeroCalorieFood(name)) {
    if (calories100g > 5 || macroSum > 1) {
      console.warn(`[sanitizeAiNutrition] Forcing zero values for known zero-calorie food "${name}" (AI said ${calories100g} kcal)`);
      return { name, calories100g: 0, protein100g: 0, carbs100g: 0, fat100g: 0 };
    }
    return est;
  }

  if (macroSum < 0.5 && calories100g > 5) {
    console.warn(`[sanitizeAiNutrition] "${name}" has zero macros but ${calories100g} cal — forcing to 0`);
    return { name, calories100g: 0, protein100g: 0, carbs100g: 0, fat100g: 0 };
  }

  if (macroCalories > 0 && calories100g > 0) {
    const ratio = calories100g / macroCalories;
    if (ratio < 0.7 || ratio > 1.5) {
      const corrected = Math.round(macroCalories);
      console.warn(`[sanitizeAiNutrition] "${name}" AI calories (${calories100g}) inconsistent with macros (expected ~${corrected}) — using macro-derived value`);
      return clampNutritionToCeiling({ name, calories100g: corrected, protein100g, carbs100g, fat100g });
    }
  }

  return clampNutritionToCeiling(est);
}

export interface CrossValidationResult {
  ingredients: IngredientResult[];
  divergenceWarning: DivergenceWarning | null;
}

export function crossValidateIngredients(
  ingredients: IngredientResult[],
  statedCaloriesPerServing: number | null,
  servings: number,
): CrossValidationResult {
  if (statedCaloriesPerServing == null || statedCaloriesPerServing <= 0 || servings <= 0) {
    return { ingredients, divergenceWarning: null };
  }

  const totalIngredientCalories = ingredients.reduce((sum, ing) => {
    return sum + (ing.calories100g * ing.grams / 100);
  }, 0);
  const ingredientCaloriesPerServing = totalIngredientCalories / servings;
  const statedTotal = statedCaloriesPerServing;

  if (statedTotal <= 0) return { ingredients, divergenceWarning: null };

  if (ingredientCaloriesPerServing <= 0) {
    console.warn(
      `[crossValidateIngredients] Ingredient-computed calories are zero/negative — skipping cross-validation`
    );
    return { ingredients, divergenceWarning: null };
  }

  const divergenceRatio = ingredientCaloriesPerServing / statedTotal;
  const calculatedCalories = Math.round(ingredientCaloriesPerServing);

  if (divergenceRatio > 1.3 || divergenceRatio < 0.7) {
    const isExtreme = divergenceRatio > 2 || divergenceRatio < 0.5;
    const message = isExtreme
      ? `Large discrepancy: ingredients add up to ${calculatedCalories} kcal — website states ${Math.round(statedTotal)} kcal. Gram amounts may be incorrect. Using ingredient-calculated value.`
      : `Ingredients add up to ${calculatedCalories} kcal — website states ${Math.round(statedTotal)} kcal. Using ingredient-calculated value.`;
    console.warn(
      `[crossValidateIngredients] Calorie divergence detected (${isExtreme ? 'extreme' : 'moderate'}): ` +
      `ingredient-computed ${calculatedCalories} kcal/serving vs stated ${Math.round(statedTotal)} kcal/serving ` +
      `(ratio: ${divergenceRatio.toFixed(2)}, servings: ${servings}). ` +
      `Keeping ingredient-calculated values (per-100g values are immutable).`
    );

    return {
      ingredients,
      divergenceWarning: {
        calculatedCalories,
        statedCalories: Math.round(statedTotal),
        ratio: Math.round(divergenceRatio * 100) / 100,
        message,
        isExtreme,
      },
    };
  }

  return { ingredients, divergenceWarning: null };
}

export async function parseIngredientsFromArray(ingredientLines: string[], userId?: number): Promise<IngredientResult[]> {
  return parseIngredients(ingredientLines.join("\n"), userId);
}

export async function parseIngredients(ingredientText: string, userId?: number): Promise<IngredientResult[]> {
  const lines = ingredientText.split("\n").map(l => l.trim()).filter(Boolean);
  const results: IngredientResult[] = [];
  const gramsCache = new Map<string, { name: string; grams: number } | null>();

  for (const line of lines) {
    const parsed = parseIngredientLine(line);
    let { grams } = parsed;
    let name = parsed.cleanedName;

    if (parsed.needsAiConversion) {
      let aiSucceeded = false;
      if (process.env.OPENAI_API_KEY) {
        const cacheKey = parsed.originalLine.toLowerCase();
        let converted: { name: string; grams: number } | null | undefined = gramsCache.get(cacheKey);
        if (converted === undefined) {
          converted = await aiConvertToGrams(parsed.originalLine);
          gramsCache.set(cacheKey, converted);
        }
        if (converted) {
          name = converted.name;
          grams = converted.grams;
          aiSucceeded = true;
        }
      }

      if (!aiSucceeded && parsed.unit) {
        const fallbackGrams = fallbackConvertToGrams(parsed.quantity, parsed.unit);
        if (fallbackGrams != null) {
          grams = fallbackGrams;
          console.log(`[ingredient-parser] Fallback conversion: ${parsed.originalLine} → ${grams}g of "${name}"`);
        } else {
          console.warn(`[ingredient-parser] No conversion available for unit "${parsed.unit}" in: ${parsed.originalLine}`);
        }
      } else if (!aiSucceeded && !parsed.unit && parsed.quantity > 0) {
        grams = Math.round(parsed.quantity * 100);
        console.log(`[ingredient-parser] Bare count fallback: ${parsed.originalLine} → ${grams}g of "${name}"`);
      }
    }

    const dbResult = await searchFoodDb(name);
    if (dbResult) {
      const { sourceDetail, ...nutrition } = dbResult;
      results.push({
        key: `parsed-db-${Date.now()}-${Math.random()}`,
        name,
        grams,
        source: "db",
        sourceDetail: sourceDetail ?? "db",
        ...nutrition,
      });
      continue;
    }

    if (!process.env.OPENAI_API_KEY) {
      results.push({
        key: `parsed-unknown-${Date.now()}-${Math.random()}`,
        name,
        grams,
        source: "ai",
        sourceDetail: "ai_generated",
        calories100g: 0,
        protein100g: 0,
        carbs100g: 0,
        fat100g: 0,
      });
      continue;
    }

    const aiResult = await aiEstimateIngredient(name);
    if (aiResult) {
      const sanitized = sanitizeAiNutrition(aiResult);
      storage.upsertCanonicalFood({
        name: sanitized.name,
        calories100g: sanitized.calories100g,
        protein100g: sanitized.protein100g,
        carbs100g: sanitized.carbs100g,
        fat100g: sanitized.fat100g,
        servingGrams: Math.round(grams) || 100,
        source: "ai_generated",
        contributedByUserId: userId ?? null,
      }).catch(() => {});
      results.push({
        key: `parsed-ai-${Date.now()}-${Math.random()}`,
        name: sanitized.name,
        grams,
        source: "ai",
        sourceDetail: "ai_generated",
        calories100g: sanitized.calories100g,
        protein100g: sanitized.protein100g,
        carbs100g: sanitized.carbs100g,
        fat100g: sanitized.fat100g,
      });
    } else {
      results.push({
        key: `parsed-fallback-${Date.now()}-${Math.random()}`,
        name,
        grams,
        source: "ai",
        sourceDetail: "ai_generated",
        calories100g: 0,
        protein100g: 0,
        carbs100g: 0,
        fat100g: 0,
      });
    }
  }

  return results;
}
