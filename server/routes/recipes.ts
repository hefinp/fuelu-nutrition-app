import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { storage } from "../storage";

const router = Router();

const openai = new OpenAI();

function parseNutrientValue(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Math.round(raw);
  const match = String(raw).match(/[\d.]+/);
  return match ? Math.round(parseFloat(match[0])) : null;
}

function isRecipeType(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  const t = obj["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
}

function findRecipeInObject(obj: any, depth = 0): any {
  if (!obj || typeof obj !== "object" || depth > 5) return null;
  if (isRecipeType(obj)) return obj;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findRecipeInObject(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (obj["@graph"]) {
    const found = findRecipeInObject(obj["@graph"], depth + 1);
    if (found) return found;
  }
  for (const key of ["mainEntity", "mainEntityOfPage"]) {
    if (obj[key]) {
      const found = findRecipeInObject(obj[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function extractMicrodataRecipe(html: string): any | null {
  const recipeMatch = html.match(/<[^>]+itemtype=["']https?:\/\/schema\.org\/Recipe["'][^>]*>([\s\S]*?)(?=<[^>]+itemtype=["']https?:\/\/schema\.org\/|$)/i);
  if (!recipeMatch) return null;
  const block = recipeMatch[0];

  function extractProp(propName: string): string | null {
    const patterns = [
      new RegExp(`itemprop=["']${propName}["'][^>]*content=["']([^"']+)["']`, "i"),
      new RegExp(`itemprop=["']${propName}["'][^>]*>([^<]+)<`, "i"),
    ];
    for (const p of patterns) {
      const m = block.match(p);
      if (m) return m[1].trim();
    }
    return null;
  }

  function extractAllProps(propName: string): string[] {
    const results: string[] = [];
    const regex = new RegExp(`itemprop=["']${propName}["'][^>]*>([\\s\\S]*?)(?:<\\/[^>]+>)`, "gi");
    let m;
    while ((m = regex.exec(block)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, "").trim();
      if (text) results.push(text);
    }
    if (results.length === 0) {
      const altRegex = new RegExp(`itemprop=["']${propName}["'][^>]*content=["']([^"']+)["']`, "gi");
      while ((m = altRegex.exec(block)) !== null) {
        if (m[1].trim()) results.push(m[1].trim());
      }
    }
    return results;
  }

  const name = extractProp("name");
  if (!name) return null;

  return {
    name,
    image: extractProp("image"),
    recipeIngredient: extractAllProps("recipeIngredient").length > 0
      ? extractAllProps("recipeIngredient")
      : extractAllProps("ingredients"),
    recipeInstructions: extractAllProps("recipeInstructions").length > 0
      ? extractAllProps("recipeInstructions")
      : extractAllProps("step"),
    recipeYield: extractProp("recipeYield"),
    nutrition: {
      calories: extractProp("calories"),
      proteinContent: extractProp("proteinContent"),
      carbohydrateContent: extractProp("carbohydrateContent"),
      fatContent: extractProp("fatContent"),
    },
    recipeCategory: extractProp("recipeCategory"),
  };
}

function extractNextDataRecipe(html: string): any | null {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!nextDataMatch) return null;
  try {
    const nd = JSON.parse(nextDataMatch[1]);
    const str = JSON.stringify(nd);
    if (!str.includes("recipeIngredient") && !str.includes("recipeInstructions")) return null;
    const deepFind = (obj: any, depth: number): any => {
      if (!obj || typeof obj !== "object" || depth > 15) return null;
      if (isRecipeType(obj)) return obj;
      if (Array.isArray(obj)) {
        for (const item of obj) { const f = deepFind(item, depth + 1); if (f) return f; }
        return null;
      }
      for (const key of Object.keys(obj)) {
        const f = deepFind(obj[key], depth + 1);
        if (f) return f;
      }
      return null;
    };
    return deepFind(nd, 0);
  } catch { return null; }
}

function extractInlineScriptRecipe(html: string): any | null {
  const scripts = Array.from(html.matchAll(/<script(?![^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi));
  for (const s of scripts) {
    const content = s[1];
    if (!content.includes('"Recipe"') || !content.includes("recipeInstructions")) continue;
    const jsonMatches = Array.from(content.matchAll(/\{[^{}]*"@type"\s*:\s*"Recipe"[\s\S]*?\}/g));
    for (const m of jsonMatches) {
      let depth = 0, end = m.index!;
      for (let i = m.index!; i < content.length; i++) {
        if (content[i] === "{") depth++;
        else if (content[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
      }
      try {
        const obj = JSON.parse(content.slice(m.index!, end));
        if (isRecipeType(obj) && (obj.recipeInstructions || obj.recipeIngredient)) return obj;
      } catch { continue; }
    }
  }
  return null;
}

function extractSmartPageText(html: string, maxLen = 12000): string {
  const cleaned = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");

  const recipeArea = cleaned.match(/<(?:div|article|section|main)[^>]*class="[^"]*(?:recipe|wprm|tasty)[^"]*"[^>]*>[\s\S]*$/i);
  const textSource = recipeArea ? recipeArea[0] : cleaned;

  const text = textSource
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (text.length <= maxLen) return text;

  const head = text.slice(0, Math.floor(maxLen * 0.6));
  const tail = text.slice(-Math.floor(maxLen * 0.4));
  return head + "\n...\n" + tail;
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
      const parsed = JSON.parse(block[1].trim());
      recipe = findRecipeInObject(parsed);
      if (recipe) break;
    } catch { continue; }
  }

  if (!recipe) {
    recipe = extractNextDataRecipe(html);
  }

  if (!recipe) {
    recipe = extractInlineScriptRecipe(html);
  }

  if (!recipe) {
    recipe = extractMicrodataRecipe(html);
  }

  if (!recipe) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(422).json({ message: "No structured recipe data found on that page. The site may not support recipe imports." });
    }
    try {
      const pageText = extractSmartPageText(html);

      const aiRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a recipe parser. Extract recipe information from webpage text. Return a JSON object with these fields: name (string), ingredients (array of strings), instructions (array of strings, each cooking step in order), servings (number), calories (number or null), protein (number or null), carbs (number or null), fat (number or null), category (string or null, e.g. 'dinner'). If it's not a recipe page, set name to null.",
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
        instructions: Array.isArray(aiJson.instructions) ? aiJson.instructions.map(String) : [],
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

  const rawInstructions = recipe.recipeInstructions;
  let instructions: string[] = [];
  if (Array.isArray(rawInstructions)) {
    for (const step of rawInstructions) {
      if (typeof step === "string") {
        const trimmed = step.trim();
        if (trimmed) instructions.push(trimmed);
      } else if (step && typeof step === "object") {
        if (step["@type"] === "HowToSection" && Array.isArray(step.itemListElement)) {
          for (const sub of step.itemListElement) {
            const text = typeof sub === "string" ? sub : sub?.text ?? sub?.name ?? "";
            const trimmed = String(text).trim();
            if (trimmed) instructions.push(trimmed);
          }
        } else if (step.text) {
          instructions.push(String(step.text).trim());
        } else if (step.name) {
          instructions.push(String(step.name).trim());
        }
      }
    }
  } else if (typeof rawInstructions === "string") {
    instructions = rawInstructions.split(/\n+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
  }

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
    instructions,
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
            "You are a recipe extraction assistant. The user will send you one or two photos of recipe book pages. Extract all recipe information and return a single JSON object with: name (string), ingredients (array of strings, each item as written), instructions (array of strings, each cooking step in order), servings (number), calories (number or null — per serving if shown, total divided by servings otherwise), protein (number or null, grams per serving), carbs (number or null, grams per serving), fat (number or null, grams per serving), category (string or null, e.g. 'dinner'). If multiple recipes appear, pick the primary one. If it's not a recipe, set name to null.",
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
    instructions: Array.isArray(aiJson.instructions) ? aiJson.instructions.map(String) : [],
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

export default router;
