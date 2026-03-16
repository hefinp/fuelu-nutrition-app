import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { storage } from "../storage";
import { insertUserRecipeSchema } from "@shared/schema";

const router = Router();

const openai = new OpenAI();

function parseNutrientValue(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Math.round(raw);
  const match = String(raw).match(/[\d.]+/);
  return match ? Math.round(parseFloat(match[0])) : null;
}

router.post("/api/recipes/import", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const { url } = z.object({ url: z.string().url() }).parse(req.body);

  let html: string;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const msg = [401, 402, 403].includes(response.status)
        ? "That site blocked the import request. Try BBC Good Food, Serious Eats, Cookie and Kate, or another recipe site."
        : response.status === 404
        ? "That page wasn't found (404). Double-check the URL and try again."
        : `Could not load that page (HTTP ${response.status}). Try a different URL.`;
      return res.status(400).json({ message: msg });
    }
    html = await response.text();
  } catch (e: any) {
    return res.status(400).json({ message: `Could not reach that URL: ${e?.message ?? 'timeout'}` });
  }

  const ldJsonBlocks = Array.from(html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi));
  let recipe: any = null;

  for (const block of ldJsonBlocks) {
    try {
      let parsed = JSON.parse(block[1].trim());
      if (Array.isArray(parsed)) {
        parsed = parsed.find((p: any) => p["@type"] === "Recipe" || (Array.isArray(p["@type"]) && p["@type"].includes("Recipe")));
      } else if (parsed["@graph"]) {
        parsed = parsed["@graph"].find((p: any) => p["@type"] === "Recipe" || (Array.isArray(p["@type"]) && p["@type"].includes("Recipe")));
      }
      if (parsed && (parsed["@type"] === "Recipe" || (Array.isArray(parsed["@type"]) && parsed["@type"].includes("Recipe")))) {
        recipe = parsed;
        break;
      }
    } catch { continue; }
  }

  if (!recipe) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(422).json({ message: "No structured recipe data found on that page. The site may not support recipe imports." });
    }
    try {
      const pageText = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 6000);

      const aiRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a recipe parser. Extract recipe information from webpage text. Return a JSON object with these fields: name (string), ingredients (array of strings), servings (number), calories (number or null), protein (number or null), carbs (number or null), fat (number or null), category (string or null, e.g. 'dinner'). If it's not a recipe page, set name to null.",
          },
          { role: "user", content: `URL: ${url}\n\nPage text:\n${pageText}` },
        ],
      });

      const aiJson = JSON.parse(aiRes.choices[0].message.content ?? "{}");
      if (!aiJson.name) {
        return res.status(422).json({ message: "This doesn't appear to be a recipe page, or the content couldn't be read. Try copying the URL directly from a recipe page." });
      }

      const catLower = (aiJson.category ?? "").toLowerCase();
      const SLOT_MAP_AI: Array<[string[], string]> = [
        [["breakfast", "brunch", "morning"], "breakfast"],
        [["lunch", "midday"], "lunch"],
        [["snack", "appetizer", "starter", "side", "dessert"], "snack"],
        [["dinner", "main", "supper", "entree", "entrée", "evening"], "dinner"],
      ];
      let aiSlot: string | null = null;
      for (const [keywords, slot] of SLOT_MAP_AI) {
        if (keywords.some(k => catLower.includes(k))) { aiSlot = slot; break; }
      }

      return res.json({
        name: aiJson.name,
        imageUrl: null,
        ingredients: Array.isArray(aiJson.ingredients) ? aiJson.ingredients : [],
        servings: typeof aiJson.servings === "number" ? aiJson.servings : 1,
        sourceUrl: url,
        calories: typeof aiJson.calories === "number" ? aiJson.calories : null,
        protein: typeof aiJson.protein === "number" ? aiJson.protein : null,
        carbs: typeof aiJson.carbs === "number" ? aiJson.carbs : null,
        fat: typeof aiJson.fat === "number" ? aiJson.fat : null,
        hasNutrition: typeof aiJson.calories === "number",
        suggestedSlot: aiSlot,
      });
    } catch (e: any) {
      return res.status(422).json({ message: "Could not extract recipe data from that page. Try a different URL or a site like AllRecipes, BBC Good Food, or Serious Eats." });
    }
  }

  const name: string = recipe.name ?? "Untitled Recipe";
  const imageUrl: string | null = Array.isArray(recipe.image)
    ? (typeof recipe.image[0] === 'string' ? recipe.image[0] : recipe.image[0]?.url ?? null)
    : (typeof recipe.image === 'string' ? recipe.image : recipe.image?.url ?? null);

  const ingredients: string[] = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [];
  const servingsRaw = recipe.recipeYield;
  const servings = typeof servingsRaw === 'number' ? servingsRaw
    : typeof servingsRaw === 'string' ? (parseInt(servingsRaw.match(/\d+/)?.[0] ?? '1') || 1)
    : Array.isArray(servingsRaw) ? (parseInt(String(servingsRaw[0]).match(/\d+/)?.[0] ?? '1') || 1)
    : 1;

  const nutrition = recipe.nutrition ?? null;
  const calories = nutrition ? parseNutrientValue(nutrition.calories) : null;
  const protein = nutrition ? parseNutrientValue(nutrition.proteinContent) : null;
  const carbs = nutrition ? parseNutrientValue(nutrition.carbohydrateContent) : null;
  const fat = nutrition ? parseNutrientValue(nutrition.fatContent) : null;

  const categoryRaw = recipe.recipeCategory;
  const categories: string[] = Array.isArray(categoryRaw)
    ? categoryRaw.map((c: any) => String(c).toLowerCase())
    : typeof categoryRaw === 'string' ? [categoryRaw.toLowerCase()] : [];
  const SLOT_MAP: Array<[string[], string]> = [
    [["breakfast", "brunch", "morning"], "breakfast"],
    [["lunch", "midday"], "lunch"],
    [["snack", "appetizer", "starter", "side", "dessert"], "snack"],
    [["dinner", "main", "supper", "entree", "entrée", "evening"], "dinner"],
  ];
  let suggestedSlot: string | null = null;
  outer: for (const cat of categories) {
    for (const [keywords, slot] of SLOT_MAP) {
      if (keywords.some(k => cat.includes(k))) { suggestedSlot = slot; break outer; }
    }
  }

  res.json({
    name,
    imageUrl,
    ingredients,
    servings,
    sourceUrl: url,
    calories,
    protein,
    carbs,
    fat,
    hasNutrition: calories !== null,
    suggestedSlot,
  });
});

router.post("/api/recipes/import-photo", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const bodySchema = z.object({
    images: z.array(z.object({
      base64: z.string().min(1),
      mimeType: z.string().default("image/jpeg"),
    })).min(1).max(2),
  });
  const { images } = bodySchema.parse(req.body);

  const imageContent = images.map(img => ({
    type: "image_url" as const,
    image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "high" as const },
  }));

  const pageWord = images.length > 1 ? "these two pages" : "this page";

  let aiJson: any;
  try {
    const aiRes = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a recipe extraction assistant. The user will send you one or two photos of recipe book pages. Extract all recipe information and return a single JSON object with: name (string), ingredients (array of strings, each item as written), servings (number), calories (number or null — per serving if shown, total divided by servings otherwise), protein (number or null, grams per serving), carbs (number or null, grams per serving), fat (number or null, grams per serving), category (string or null, e.g. 'dinner'). If multiple recipes appear, pick the primary one. If it's not a recipe, set name to null.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Please extract the recipe from ${pageWord}.` },
            ...imageContent,
          ],
        },
      ],
    });

    aiJson = JSON.parse(aiRes.choices[0].message.content ?? "{}");
  } catch (e: any) {
    return res.status(500).json({ message: "Failed to analyse the photo. Please try again." });
  }

  if (!aiJson.name) {
    return res.status(422).json({ message: "No recipe found in that photo. Make sure the recipe text is clearly visible and try again." });
  }

  const catLower = (aiJson.category ?? "").toLowerCase();
  const SLOT_MAP_PHOTO: Array<[string[], string]> = [
    [["breakfast", "brunch", "morning"], "breakfast"],
    [["lunch", "midday"], "lunch"],
    [["snack", "appetizer", "starter", "side", "dessert"], "snack"],
    [["dinner", "main", "supper", "entree", "entrée", "evening"], "dinner"],
  ];
  let photoSlot: string | null = null;
  for (const [keywords, slot] of SLOT_MAP_PHOTO) {
    if (keywords.some(k => catLower.includes(k))) { photoSlot = slot; break; }
  }

  res.json({
    name: String(aiJson.name),
    imageUrl: null,
    ingredients: Array.isArray(aiJson.ingredients) ? aiJson.ingredients.map(String) : [],
    servings: typeof aiJson.servings === "number" && aiJson.servings > 0 ? aiJson.servings : 1,
    sourceUrl: "photo://recipe-book",
    calories: typeof aiJson.calories === "number" ? aiJson.calories : null,
    protein: typeof aiJson.protein === "number" ? aiJson.protein : null,
    carbs: typeof aiJson.carbs === "number" ? aiJson.carbs : null,
    fat: typeof aiJson.fat === "number" ? aiJson.fat : null,
    hasNutrition: typeof aiJson.calories === "number",
    suggestedSlot: photoSlot,
  });
});

router.get("/api/recipes", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === "string" ? Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100) : undefined;
    const paginated = cursor !== undefined || limit !== undefined;
    const result = await storage.getUserRecipes(req.session.userId, paginated ? { cursor, limit: limit ?? 20 } : undefined);
    res.json(paginated ? result : result.items);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch recipes" });
  }
});

router.post("/api/recipes", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const body = insertUserRecipeSchema.parse(req.body);
  const recipe = await storage.createUserRecipe({ ...body, userId: req.session.userId });
  res.status(201).json(recipe);
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

router.patch("/api/recipes/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const body = z.object({
      name: z.string().min(1).optional(),
      caloriesPerServing: z.number().int().min(0).optional(),
      proteinPerServing: z.number().int().min(0).optional(),
      carbsPerServing: z.number().int().min(0).optional(),
      fatPerServing: z.number().int().min(0).optional(),
      mealSlot: z.string().optional(),
      instructions: z.string().nullable().optional(),
      ingredients: z.string().nullable().optional(),
      ingredientsJson: z.array(ingredientItemSchema).nullable().optional(),
    }).parse(req.body);
    const updated = await storage.updateUserRecipe(id, req.session.userId, body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update recipe" });
  }
});

router.delete("/api/recipes/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  await storage.deleteUserRecipe(id, req.session.userId);
  res.json({ message: "Deleted" });
});

export default router;
