import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { storage } from "../storage";
import type { UserPreferences } from "@shared/schema";

const router = Router();

router.post("/api/preferences/disliked-meals", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const { mealName } = z.object({ mealName: z.string().min(1) }).parse(req.body);
  const user = await storage.getUserById(req.session.userId);
  const prefs = (user?.preferences as UserPreferences | null) ?? {};
  const existing = prefs.dislikedMeals ?? [];
  if (!existing.map(m => m.toLowerCase()).includes(mealName.toLowerCase())) {
    const updated: UserPreferences = { ...prefs, dislikedMeals: [...existing, mealName] };
    await storage.updateUserPreferences(req.session.userId, updated);
  }
  res.json({ message: "Meal disliked." });
});

router.delete("/api/preferences/disliked-meals/:mealName", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const mealName = decodeURIComponent(req.params.mealName);
  const user = await storage.getUserById(req.session.userId);
  const prefs = (user?.preferences as UserPreferences | null) ?? {};
  const updated: UserPreferences = {
    ...prefs,
    dislikedMeals: (prefs.dislikedMeals ?? []).filter(m => m.toLowerCase() !== mealName.toLowerCase()),
  };
  await storage.updateUserPreferences(req.session.userId, updated);
  res.json({ message: "Dislike removed." });
});

router.get("/api/food-search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) return res.json([]);
  try {
    const communityHits = await storage.searchCustomFoodsByName(q);
    const communityResults = communityHits.map(c => ({
      id: `community-${c.id}`,
      name: c.name,
      calories100g: c.calories100g,
      protein100g: parseFloat(String(c.protein100g)),
      carbs100g: parseFloat(String(c.carbs100g)),
      fat100g: parseFloat(String(c.fat100g)),
      servingSize: `${c.servingGrams}g`,
      servingGrams: c.servingGrams,
      source: "community",
    }));

    const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=25&api_key=${apiKey}`;
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
    let usdaResults: any[] = [];
    if (upstream.ok) {
      const data = await upstream.json() as any;
      const foods = (data.foods ?? []) as any[];
      const getNutrient = (nutrients: any[], id: number) =>
        nutrients.find((n: any) => n.nutrientId === id)?.value ?? 0;
      const getEnergy = (n: any[]) =>
        getNutrient(n, 1008) || getNutrient(n, 2047) || getNutrient(n, 2048);
      const communityNames = new Set(communityResults.map(r => r.name.toLowerCase()));
      usdaResults = foods
        .filter((f: any) => f.description && getEnergy(f.foodNutrients ?? []) > 0)
        .slice(0, 10)
        .map((f: any) => {
          const n = f.foodNutrients ?? [];
          const servingGrams = (f.servingSizeUnit === "g" || f.servingSizeUnit === "G")
            ? Math.round(parseFloat(f.servingSize) || 100)
            : 100;
          return {
            id: String(f.fdcId),
            name: f.description.charAt(0).toUpperCase() + f.description.slice(1).toLowerCase(),
            calories100g: Math.round(getEnergy(n)),
            protein100g: Math.round(getNutrient(n, 1003) * 10) / 10,
            carbs100g: Math.round(getNutrient(n, 1005) * 10) / 10,
            fat100g: Math.round(getNutrient(n, 1004) * 10) / 10,
            servingSize: servingGrams > 0 ? `${servingGrams}g` : "100g",
            servingGrams: servingGrams || 100,
          };
        })
        .filter((f: any) => !communityNames.has(f.name.toLowerCase()));
    }

    res.json([...communityResults, ...usdaResults].slice(0, 15));
  } catch {
    res.json([]);
  }
});

router.get("/api/food-log/label-scan-available", (req, res) => {
  const available = !!process.env.OPENAI_API_KEY;
  res.json({ available });
});

router.post("/api/food-log/extract-label", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Vision service unavailable" });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const systemPrompt = `You are a nutrition label reader. Extract nutritional data from the provided food label image.
Return ONLY a JSON object with these exact fields (per 100g):
{
  "name": "<product name>",
  "calories100g": <number>,
  "protein100g": <number>,
  "carbs100g": <number>,
  "fat100g": <number>,
  "fibre100g": <number or null>,
  "sugar100g": <number or null>,
  "sodium100g": <number or null>,
  "saturatedFat100g": <number or null>,
  "servingGrams": <typical serving size in grams, default 100>,
  "sourceType": "label"
}
If you cannot confidently read the values from the label, estimate them based on food type and return sourceType "estimated".
Respond ONLY with the JSON — no markdown, no explanation.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } },
          ],
        },
      ],
      max_tokens: 512,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    let extracted: any;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      extracted = JSON.parse(match ? match[0] : text);
    } catch {
      return res.status(422).json({ error: "Could not parse nutrition data from image" });
    }

    const result = {
      id: `label-${Date.now()}`,
      name: String(extracted.name ?? "Scanned Food"),
      calories100g: Number(extracted.calories100g) || 0,
      protein100g: Number(extracted.protein100g) || 0,
      carbs100g: Number(extracted.carbs100g) || 0,
      fat100g: Number(extracted.fat100g) || 0,
      fibre100g: extracted.fibre100g != null ? Number(extracted.fibre100g) : undefined,
      sugar100g: extracted.sugar100g != null ? Number(extracted.sugar100g) : undefined,
      sodium100g: extracted.sodium100g != null ? Number(extracted.sodium100g) : undefined,
      saturatedFat100g: extracted.saturatedFat100g != null ? Number(extracted.saturatedFat100g) : undefined,
      servingGrams: Math.max(1, Number(extracted.servingGrams) || 100),
      servingSize: `${Math.max(1, Number(extracted.servingGrams) || 100)}g`,
      sourceType: (extracted.sourceType === "label" ? "label" : "estimated") as "label" | "estimated",
    };

    if (result.calories100g > 0) {
      const exists = await storage.customFoodExistsByName(result.name);
      if (!exists) {
        storage.createCustomFood({
          barcode: null,
          name: result.name,
          calories100g: result.calories100g,
          protein100g: String(result.protein100g),
          carbs100g: String(result.carbs100g),
          fat100g: String(result.fat100g),
          servingGrams: result.servingGrams,
          contributedByUserId: (req.user as any)?.id ?? null,
        }).catch(() => {});
      }
    }

    res.json(result);
  } catch (err) {
    console.error("Label scan error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Label scan failed" });
  }
});

router.post("/api/food-log/recognize-food", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  const { imageBase64, description } = req.body as { imageBase64?: string; description?: string };
  if (!imageBase64 && !description) return res.status(400).json({ error: "imageBase64 or description required" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI service unavailable" });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const systemPrompt = `You are a food identification and nutrition estimation expert.
${imageBase64 ? "Identify the food shown in the image." : `Identify the food described as: "${description}".`}
Return ONLY a JSON object with these exact fields (values per 100g):
{
  "name": "<concise food name>",
  "calories100g": <number>,
  "protein100g": <number>,
  "carbs100g": <number>,
  "fat100g": <number>,
  "fibre100g": <number or null>,
  "sugar100g": <number or null>,
  "sodium100g": <number or null>,
  "saturatedFat100g": <number or null>,
  "servingGrams": <estimated typical serving size in grams>,
  "sourceType": "estimated"
}
Be as accurate as possible. Use standard USDA-style nutritional values.
Respond ONLY with the JSON — no markdown, no explanation.`;

    const content: any[] = [{ type: "text", text: systemPrompt }];
    if (imageBase64) {
      content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      max_tokens: 512,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    let extracted: any;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      extracted = JSON.parse(match ? match[0] : text);
    } catch {
      return res.status(422).json({ error: "Could not identify food" });
    }

    const result = {
      id: `ai-${Date.now()}`,
      name: String(extracted.name ?? "Identified Food"),
      calories100g: Number(extracted.calories100g) || 0,
      protein100g: Number(extracted.protein100g) || 0,
      carbs100g: Number(extracted.carbs100g) || 0,
      fat100g: Number(extracted.fat100g) || 0,
      fibre100g: extracted.fibre100g != null ? Number(extracted.fibre100g) : undefined,
      sugar100g: extracted.sugar100g != null ? Number(extracted.sugar100g) : undefined,
      sodium100g: extracted.sodium100g != null ? Number(extracted.sodium100g) : undefined,
      saturatedFat100g: extracted.saturatedFat100g != null ? Number(extracted.saturatedFat100g) : undefined,
      servingGrams: Math.max(1, Number(extracted.servingGrams) || 100),
      servingSize: `${Math.max(1, Number(extracted.servingGrams) || 100)}g`,
      sourceType: "estimated" as const,
      source: "ai",
    };

    if (result.calories100g > 0) {
      const exists = await storage.customFoodExistsByName(result.name);
      if (!exists) {
        storage.createCustomFood({
          barcode: null,
          name: result.name,
          calories100g: result.calories100g,
          protein100g: String(result.protein100g),
          carbs100g: String(result.carbs100g),
          fat100g: String(result.fat100g),
          servingGrams: result.servingGrams,
          contributedByUserId: (req.user as any)?.id ?? null,
        }).catch(() => {});
      }
    }

    res.json(result);
  } catch (err) {
    console.error("Food recognition error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Food recognition failed" });
  }
});


router.post("/api/food-log/daily-nudge", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "AI unavailable" });

  const { logged, targets } = req.body as {
    logged: { calories: number; protein: number; carbs: number; fat: number };
    targets: { calories: number; protein: number; carbs: number; fat: number };
  };
  if (!logged || !targets) return res.status(400).json({ error: "logged and targets required" });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const remaining = {
      calories: targets.calories - logged.calories,
      protein: targets.protein - logged.protein,
      carbs: targets.carbs - logged.carbs,
      fat: targets.fat - logged.fat,
    };
    const prompt = `A user has logged ${logged.calories}kcal, ${logged.protein}g protein, ${logged.carbs}g carbs, ${logged.fat}g fat today. Their targets are ${targets.calories}kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat. Remaining: ${remaining.calories}kcal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat. Write exactly one friendly sentence suggesting a specific food or meal that would help them balance the rest of their day. Be concrete (mention a real food). Plain text, no markdown.`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 80,
      temperature: 0.8,
    });
    const suggestion = resp.choices[0]?.message?.content?.trim() ?? "";
    res.json({ suggestion });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate nudge" });
  }
});

router.get("/api/barcode/:barcode", async (req, res) => {
  const barcode = req.params.barcode;

  const custom = await storage.getCustomFoodByBarcode(barcode);
  if (custom) {
    return res.json({
      id: `custom-${custom.id}`,
      name: custom.name,
      calories100g: custom.calories100g,
      protein100g: parseFloat(String(custom.protein100g)),
      carbs100g: parseFloat(String(custom.carbs100g)),
      fat100g: parseFloat(String(custom.fat100g)),
      servingSize: `${custom.servingGrams}g`,
      servingGrams: custom.servingGrams,
      source: "community",
    });
  }

  const cacheToDb = (food: {
    name: string; calories100g: number; protein100g: number;
    carbs100g: number; fat100g: number; servingGrams: number;
  }) => {
    storage.customFoodExistsByName(food.name).then(exists => {
      if (!exists) {
        return storage.createCustomFood({
          barcode,
          name: food.name,
          calories100g: food.calories100g,
          protein100g: String(food.protein100g),
          carbs100g: String(food.carbs100g),
          fat100g: String(food.fat100g),
          servingGrams: food.servingGrams,
          contributedByUserId: null,
        });
      }
    }).catch(() => {});
  };

  try {
    const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
    const offRes = await fetch(offUrl, { signal: AbortSignal.timeout(7000) });
    if (offRes.ok) {
      const offData = await offRes.json() as any;
      if (offData.status === 1 && offData.product) {
        const p = offData.product;
        const n = p.nutriments || {};
        const kcal100g = n["energy-kcal_100g"] ?? (n["energy_100g"] ? Math.round(n["energy_100g"] / 4.184) : 0);
        const name = (p.product_name_en || p.product_name || "").trim();
        if (kcal100g > 0 && name) {
          const servingGrams = Math.round(parseFloat(p.serving_quantity) || 100);
          const result = {
            id: `off-${barcode}`,
            name: name.charAt(0).toUpperCase() + name.slice(1),
            calories100g: Math.round(kcal100g),
            protein100g: Math.round((n.proteins_100g || 0) * 10) / 10,
            carbs100g: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
            fat100g: Math.round((n.fat_100g || 0) * 10) / 10,
            fibre100g: Math.round((n["fiber_100g"] ?? n["fibre_100g"] ?? 0) * 10) / 10,
            sodium100g: Math.round((n["sodium_100g"] || 0) * 1000) / 10,
            sugar100g: Math.round((n["sugars_100g"] ?? n["carbohydrates-sugars_100g"] ?? 0) * 10) / 10,
            saturatedFat100g: Math.round((n["saturated-fat_100g"] || 0) * 10) / 10,
            servingSize: p.serving_size || `${servingGrams}g`,
            servingGrams: servingGrams || 100,
            source: "open_food_facts",
          };
          cacheToDb(result);
          return res.json(result);
        }
      }
    }
  } catch {}

  try {
    const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&pageSize=10&dataType=Branded&api_key=${apiKey}`;
    const upstream = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (upstream.ok) {
      const data = await upstream.json() as any;
      const foods = (data.foods ?? []) as any[];
      const match = foods.find((f: any) => f.gtinUpc === barcode);
      if (match) {
        const n = match.foodNutrients ?? [];
        const getNutrient = (id: number) => n.find((x: any) => x.nutrientId === id)?.value ?? 0;
        const getEnergy = () => getNutrient(1008) || getNutrient(2047) || getNutrient(2048);
        const calories100g = Math.round(getEnergy());
        if (calories100g > 0) {
          const servingGrams = (match.servingSizeUnit === "g" || match.servingSizeUnit === "G")
            ? Math.round(parseFloat(match.servingSize) || 100) : 100;
          const result = {
            id: String(match.fdcId),
            name: match.description.charAt(0).toUpperCase() + match.description.slice(1).toLowerCase(),
            calories100g,
            protein100g: Math.round(getNutrient(1003) * 10) / 10,
            carbs100g: Math.round(getNutrient(1005) * 10) / 10,
            fat100g: Math.round(getNutrient(1004) * 10) / 10,
            fibre100g: Math.round(getNutrient(1079) * 10) / 10,
            sodium100g: Math.round(getNutrient(1093) / 10) / 10,
            sugar100g: Math.round(getNutrient(2000) * 10) / 10,
            saturatedFat100g: Math.round(getNutrient(1258) * 10) / 10,
            servingSize: servingGrams > 0 ? `${servingGrams}g` : "100g",
            servingGrams: servingGrams || 100,
            source: "usda",
          };
          cacheToDb(result);
          return res.json(result);
        }
      }
    }
  } catch {}

  return res.status(404).json({ message: "Product not found" });
});

router.get("/api/custom-foods", async (req, res) => {
  const foods = await storage.getCustomFoods();
  res.json(foods);
});

router.post("/api/custom-foods", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      barcode: z.string().min(1),
      name: z.string().min(1),
      calories100g: z.number().int().min(0),
      protein100g: z.number().min(0),
      carbs100g: z.number().min(0),
      fat100g: z.number().min(0),
      servingGrams: z.number().int().min(1).default(100),
    }).parse(req.body);
    const existing = await storage.getCustomFoodByBarcode(body.barcode);
    if (existing) return res.status(200).json(existing);
    const food = await storage.createCustomFood({ ...body, protein100g: String(body.protein100g), carbs100g: String(body.carbs100g), fat100g: String(body.fat100g), contributedByUserId: req.session.userId });
    res.status(201).json(food);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.delete("/api/custom-foods/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  await storage.deleteCustomFood(id, req.session.userId);
  res.json({ message: "Deleted" });
});

router.get("/api/food-log/recent", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const entries = await storage.getRecentFoodEntries(req.session.userId, 5);
  res.json(entries);
});

router.get("/api/food-log", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const { date, from, to } = req.query as { date?: string; from?: string; to?: string };
  if (from && to) {
    const entries = await storage.getFoodLogEntriesRange(req.session.userId, from, to);
    return res.json(entries);
  }
  const singleDate = date || new Date().toISOString().slice(0, 10);
  const entries = await storage.getFoodLogEntries(req.session.userId, singleDate);
  res.json(entries);
});

router.post("/api/food-log", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      date: z.string(),
      mealName: z.string().min(1),
      calories: z.number().int().min(0),
      protein: z.number().int().min(0),
      carbs: z.number().int().min(0),
      fat: z.number().int().min(0),
      fibre: z.number().int().min(0).nullable().optional(),
      sugar: z.number().int().min(0).nullable().optional(),
      saturatedFat: z.number().int().min(0).nullable().optional(),
      mealSlot: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
    }).parse(req.body);
    const entry = await storage.createFoodLogEntry({ ...body, userId: req.session.userId });
    res.status(201).json(entry);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.patch("/api/food-log/:id/confirm", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  const updated = await storage.confirmFoodLogEntry(id, req.session.userId);
  if (!updated) return res.status(404).json({ message: "Entry not found" });
  res.json(updated);
});

router.delete("/api/food-log/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  await storage.deleteFoodLogEntry(id, req.session.userId);
  res.status(204).send();
});

export default router;
