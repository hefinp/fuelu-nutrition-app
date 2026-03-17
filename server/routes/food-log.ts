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

function detectRegionFromAcceptLanguage(acceptLanguage: string | undefined): string | null {
  if (!acceptLanguage) return null;
  const langs = acceptLanguage.toLowerCase().split(",").map(l => l.trim().split(";")[0]);
  for (const lang of langs) {
    if (lang === "en-nz" || lang.endsWith("-nz")) return "nz";
    if (lang === "en-au" || lang.endsWith("-au")) return "au";
  }
  return null;
}

router.get("/api/food-search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) return res.json([]);
  const locale = (req.query.locale as string | undefined) || req.headers["accept-language"]?.split(",")[0]?.split("-")[1]?.toLowerCase() || "";
  const isNzAu = ["nz", "au"].includes(locale);
  try {
    // Detect user's region for boosting local results
    // Priority: 1. User profile country preference, 2. Accept-Language header
    let regionBoost: string | null = null;
    if (req.session.userId) {
      const user = await storage.getUserById(req.session.userId);
      const prefs = (user?.preferences ?? {}) as UserPreferences;
      const country = (prefs.country ?? "").toLowerCase();
      if (country === "nz" || country === "new zealand") regionBoost = "nz";
      else if (country === "au" || country === "australia") regionBoost = "au";
    }
    // Fallback: detect from browser Accept-Language header for unauthenticated/unset users
    if (!regionBoost) {
      regionBoost = detectRegionFromAcceptLanguage(req.headers["accept-language"]);
    }

    // 1. Search canonical foods DB first
    const canonicalHits = await storage.searchCanonicalFoods(q, 10, regionBoost);
    const canonicalResults = canonicalHits.map(c => ({
      id: `canonical-${c.id}`,
      canonicalFoodId: c.id,
      name: c.name,
      calories100g: c.calories100g,
      protein100g: c.protein100g,
      carbs100g: c.carbs100g,
      fat100g: c.fat100g,
      servingSize: `${c.servingGrams}g`,
      servingGrams: c.servingGrams,
      source: c.source,
      region: c.region,
      verified: c.verifiedAt != null,
    }));

    const canonicalNames = new Set(canonicalResults.map(r => r.name.toLowerCase()));

    // 1b. Search custom foods (My Foods) for this user and merge, deduplicating by name
    let customResults: any[] = [];
    if (req.session.userId) {
      const customHits = await storage.searchCustomFoodsByNameForUser(q, req.session.userId);
      customResults = customHits
        .filter(c => !canonicalNames.has(c.name.toLowerCase()))
        .map(c => ({
          id: `custom-${c.id}`,
          name: c.name,
          calories100g: c.calories100g,
          protein100g: parseFloat(c.protein100g),
          carbs100g: parseFloat(c.carbs100g),
          fat100g: parseFloat(c.fat100g),
          servingSize: `${c.servingGrams ?? 100}g`,
          servingGrams: c.servingGrams ?? 100,
          source: "my_foods",
        }));
      for (const r of customResults) {
        canonicalNames.add(r.name.toLowerCase());
      }
    }

    // 1c. For NZ/AU users, query Open Food Facts for locale-specific results (shown first)
    let nzAuOffResults: any[] = [];
    if (isNzAu) {
      try {
        const localeTag = locale === "nz" ? "new-zealand" : "australia";
        const offSearchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&tagtype_0=countries&tag_contains_0=contains&tag_0=${encodeURIComponent(localeTag)}&action=process&json=1&page_size=10&fields=product_name_en,product_name,nutriments,serving_quantity,serving_size,countries_tags`;
        const offRes = await fetch(offSearchUrl, { signal: AbortSignal.timeout(5000) });
        if (offRes.ok) {
          const offData = await offRes.json() as any;
          const products = (offData.products ?? []) as any[];
          nzAuOffResults = products
            .filter((p: any) => {
              const n = p.nutriments || {};
              const kcal = n["energy-kcal_100g"] ?? (n["energy_100g"] ? Math.round(n["energy_100g"] / 4.184) : 0);
              const name = (p.product_name_en || p.product_name || "").trim();
              return kcal > 0 && name && !canonicalNames.has(name.toLowerCase());
            })
            .slice(0, 5)
            .map((p: any) => {
              const n = p.nutriments || {};
              const name = (p.product_name_en || p.product_name || "").trim();
              const kcal = Math.round(n["energy-kcal_100g"] ?? (n["energy_100g"] ? Math.round(n["energy_100g"] / 4.184) : 0));
              const servingGrams = Math.round(parseFloat(p.serving_quantity) || 100);
              return {
                id: `off-search-${name.replace(/\s/g, "-").toLowerCase()}`,
                name: name.charAt(0).toUpperCase() + name.slice(1),
                calories100g: kcal,
                protein100g: Math.round((n.proteins_100g || 0) * 10) / 10,
                carbs100g: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
                fat100g: Math.round((n.fat_100g || 0) * 10) / 10,
                servingSize: p.serving_size || `${servingGrams}g`,
                servingGrams: servingGrams || 100,
                source: "open_food_facts",
                verified: true,
              };
            });
        }
      } catch {}
    }

    // 2. Fire USDA and Open Food Facts searches in parallel
    const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
    const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=25&api_key=${apiKey}`;
    const offUrl = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&json=1&page_size=15`;

    const [usdaSettled, offSettled] = await Promise.allSettled([
      fetch(usdaUrl, { signal: AbortSignal.timeout(8000) }),
      fetch(offUrl, { signal: AbortSignal.timeout(3000) }),
    ]);

    // --- USDA results ---
    let usdaResults: any[] = [];
    if (usdaSettled.status === "fulfilled" && usdaSettled.value.ok) {
      const data = await usdaSettled.value.json() as any;
      const foods = (data.foods ?? []) as any[];
      const getNutrient = (nutrients: any[], id: number) =>
        nutrients.find((n: any) => n.nutrientId === id)?.value ?? 0;
      const getEnergy = (n: any[]) =>
        getNutrient(n, 1008) || getNutrient(n, 2047) || getNutrient(n, 2048);

      const usdaFoods = foods
        .filter((f: any) => f.description && getEnergy(f.foodNutrients ?? []) > 0)
        .slice(0, 10)
        .map((f: any) => {
          const n = f.foodNutrients ?? [];
          const servingGrams = (f.servingSizeUnit === "g" || f.servingSizeUnit === "G")
            ? Math.round(parseFloat(f.servingSize) || 100)
            : 100;
          return {
            fdcId: String(f.fdcId),
            name: f.description.charAt(0).toUpperCase() + f.description.slice(1).toLowerCase(),
            calories100g: Math.round(getEnergy(n)),
            protein100g: Math.round(getNutrient(n, 1003) * 10) / 10,
            carbs100g: Math.round(getNutrient(n, 1005) * 10) / 10,
            fat100g: Math.round(getNutrient(n, 1004) * 10) / 10,
            servingGrams: servingGrams || 100,
          };
        })
        .filter((f: any) => !canonicalNames.has(f.name.toLowerCase()));

      // Cache USDA results into canonical DB asynchronously
      for (const f of usdaFoods) {
        storage.upsertCanonicalFood({
          name: f.name,
          calories100g: f.calories100g,
          protein100g: f.protein100g,
          carbs100g: f.carbs100g,
          fat100g: f.fat100g,
          servingGrams: f.servingGrams,
          fdcId: f.fdcId,
          source: "usda_cached",
        }).catch(() => {});
      }

      usdaResults = usdaFoods.map(f => ({
        id: f.fdcId,
        name: f.name,
        calories100g: f.calories100g,
        protein100g: f.protein100g,
        carbs100g: f.carbs100g,
        fat100g: f.fat100g,
        servingSize: `${f.servingGrams}g`,
        servingGrams: f.servingGrams,
      }));
    }

    // --- Open Food Facts results (global, all users) ---
    let offResults: any[] = [];
    if (offSettled.status === "fulfilled" && offSettled.value.ok) {
      const offData = await offSettled.value.json() as any;
      // search.openfoodfacts.org returns { hits: [...] }
      const products = (offData.hits ?? offData.products ?? []) as any[];

      // Build a set of names already covered by canonical + USDA + NZ/AU locale results
      const seenNames = new Set([
        ...canonicalNames,
        ...usdaResults.map(r => r.name.toLowerCase()),
        ...nzAuOffResults.map((r: any) => r.name.toLowerCase()),
      ]);

      for (const p of products) {
        const rawName = (p.product_name ?? "").trim();
        if (!rawName) continue;

        // brands may be an array or a comma-separated string
        const brandsRaw = p.brands;
        const brand = Array.isArray(brandsRaw)
          ? brandsRaw[0]?.trim() ?? ""
          : (brandsRaw ?? "").split(",")[0].trim();

        const name = brand && !rawName.toLowerCase().includes(brand.toLowerCase())
          ? `${rawName} (${brand})`
          : rawName;
        const normName = name.toLowerCase().replace(/\s+/g, " ").trim();
        if (seenNames.has(normName)) continue;

        const nm = p.nutriments ?? {};
        const cal = Math.round(nm["energy-kcal_100g"] ?? 0);
        const protein = Math.round((nm["proteins_100g"] ?? 0) * 10) / 10;
        const carbs = Math.round((nm["carbohydrates_100g"] ?? 0) * 10) / 10;
        const fat = Math.round((nm["fat_100g"] ?? 0) * 10) / 10;

        if (cal <= 0 || cal > 950) continue;

        seenNames.add(normName);
        const formatted = name.charAt(0).toUpperCase() + name.slice(1);

        // Cache into canonical DB asynchronously
        storage.upsertCanonicalFood({
          name: formatted,
          calories100g: cal,
          protein100g: protein,
          carbs100g: carbs,
          fat100g: fat,
          servingGrams: 100,
          source: "openfoodfacts",
        }).catch(() => {});

        const fiber = Math.round((nm["fiber_100g"] ?? nm["fibers_100g"] ?? 0) * 10) / 10;
        const sodium = Math.round((nm["sodium_100g"] ?? 0) * 1000 * 10) / 10;

        offResults.push({
          id: `off-${encodeURIComponent(formatted)}`,
          name: formatted,
          calories100g: cal,
          protein100g: protein,
          carbs100g: carbs,
          fat100g: fat,
          fiber100g: fiber || undefined,
          sodium100g: sodium || undefined,
          servingSize: "100g",
          servingGrams: 100,
          source: "openfoodfacts",
        });

        if (offResults.length >= 8) break;
      }
    }

    if (isNzAu && nzAuOffResults.length > 0) {
      // NZ/AU users: locale-specific OFF first, then remaining canonical (deduped), then My Foods, USDA, global OFF
      const nzAuNames = new Set(nzAuOffResults.map((r: any) => r.name.toLowerCase()));
      const filteredCanonical = canonicalResults.filter(r => !nzAuNames.has(r.name.toLowerCase()));
      res.json([...nzAuOffResults, ...filteredCanonical, ...customResults, ...usdaResults, ...offResults].slice(0, 20));
    } else {
      // Priority order: verified canonical > unverified canonical > My Foods > USDA > OFF
      const verified = canonicalResults.filter(r => r.verified);
      const unverified = canonicalResults.filter(r => !r.verified);
      res.json([...verified, ...unverified, ...customResults, ...usdaResults, ...offResults].slice(0, 20));
    }
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
  const { imageBase64, barcode: labelBarcode } = req.body as { imageBase64?: string; barcode?: string };
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

    const servingGramsVal = Math.max(1, Number(extracted.servingGrams) || 100);
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
      servingGrams: servingGramsVal,
      servingSize: `${servingGramsVal}g`,
      sourceType: (extracted.sourceType === "label" ? "label" : "estimated") as "label" | "estimated",
      source: "community",
    };

    if (result.calories100g > 0) {
      storage.upsertCanonicalFood({
        name: result.name,
        calories100g: result.calories100g,
        protein100g: result.protein100g,
        carbs100g: result.carbs100g,
        fat100g: result.fat100g,
        fibre100g: result.fibre100g ?? null,
        sodium100g: result.sodium100g ?? null,
        servingGrams: result.servingGrams,
        barcode: labelBarcode ?? null,
        fdcId: null,
        source: "ai_label",
        contributedByUserId: (req.user as any)?.id ?? (req.session as any)?.userId ?? null,
      }).catch(() => {});
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
      storage.upsertCanonicalFood({
        name: result.name,
        calories100g: result.calories100g,
        protein100g: result.protein100g,
        carbs100g: result.carbs100g,
        fat100g: result.fat100g,
        fibre100g: result.fibre100g ?? null,
        sodium100g: result.sodium100g ?? null,
        servingGrams: result.servingGrams,
        source: "ai_recognized",
        contributedByUserId: (req.user as any)?.id ?? (req.session as any)?.userId ?? null,
      }).catch(() => {});
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
  const locale = (req.query.locale as string | undefined) || req.headers["accept-language"]?.split(",")[0]?.split("-")[1]?.toLowerCase() || "";
  const isNzAu = ["nz", "au"].includes(locale);

  const canonical = await storage.getCanonicalFoodByBarcode(barcode);
  if (canonical) {
    return res.json({
      id: `canonical-${canonical.id}`,
      canonicalFoodId: canonical.id,
      name: canonical.name,
      calories100g: canonical.calories100g,
      protein100g: canonical.protein100g,
      carbs100g: canonical.carbs100g,
      fat100g: canonical.fat100g,
      servingSize: `${canonical.servingGrams}g`,
      servingGrams: canonical.servingGrams,
      source: canonical.source ?? "canonical",
      region: canonical.region ?? null,
      verified: canonical.verifiedAt != null,
      contributedByUserId: canonical.contributedByUserId,
    });
  }

  const cacheToDb = (food: {
    name: string; calories100g: number; protein100g: number;
    carbs100g: number; fat100g: number; servingGrams: number;
    fdcId?: string;
    source?: string;
  }) => {
    storage.upsertCanonicalFood({
      name: food.name,
      calories100g: food.calories100g,
      protein100g: food.protein100g,
      carbs100g: food.carbs100g,
      fat100g: food.fat100g,
      servingGrams: food.servingGrams,
      barcode,
      fdcId: food.fdcId ?? null,
      source: food.source ?? "barcode_scan",
    }).catch(() => {});
  };

  const parseOffProduct = (p: any, barcode: string, preferLocale?: string) => {
    const n = p.nutriments || {};
    const kcal100g = n["energy-kcal_100g"] ?? (n["energy_100g"] ? Math.round(n["energy_100g"] / 4.184) : 0);
    const name = (p.product_name_en || p.product_name || "").trim();
    if (kcal100g <= 0 || !name) return null;
    const servingGrams = Math.round(parseFloat(p.serving_quantity) || 100);
    const countriesTags: string[] = p.countries_tags ?? [];
    const isNzAuProduct = countriesTags.some((t: string) => t.includes("new-zealand") || t.includes("australia") || t.includes("en:nz") || t.includes("en:au"));
    return {
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
      isNzAuProduct,
    };
  };

  const lookupOffProduct = async (url: string): Promise<ReturnType<typeof parseOffProduct>> => {
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const d = await r.json() as any;
    if (d.status !== 1 || !d.product) return null;
    return parseOffProduct(d.product, barcode, locale);
  };

  try {
    if (isNzAu) {
      const nzCountry = locale?.toLowerCase().includes("au") ? "australia" : "new-zealand";
      const nzUrl = `https://${nzCountry === "australia" ? "au" : "nz"}.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
      const nzResult = await lookupOffProduct(nzUrl).catch(() => null);
      if (nzResult) {
        const { isNzAuProduct: _, ...cleanResult } = nzResult;
        cacheToDb(cleanResult);
        return res.json({ ...cleanResult, locallyVerified: true });
      }
      const globalUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
      const globalResult = await lookupOffProduct(globalUrl).catch(() => null);
      if (globalResult) {
        const { isNzAuProduct, ...cleanResult } = globalResult;
        cacheToDb(cleanResult);
        return res.json({ ...cleanResult, locallyVerified: isNzAuProduct });
      }
    } else {
      const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
      const result = await lookupOffProduct(offUrl).catch(() => null);
      if (result) {
        const { isNzAuProduct: _, ...cleanResult } = result;
        cacheToDb(cleanResult);
        return res.json(cleanResult);
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
            fdcId: String(match.fdcId),
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
            source: "usda_cached",
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
    if (existing) {
      storage.upsertCanonicalFood({
        name: existing.name,
        calories100g: existing.calories100g,
        protein100g: parseFloat(String(existing.protein100g)) || 0,
        carbs100g: parseFloat(String(existing.carbs100g)) || 0,
        fat100g: parseFloat(String(existing.fat100g)) || 0,
        servingGrams: existing.servingGrams,
        barcode: body.barcode,
        fdcId: null,
        source: "community",
        contributedByUserId: existing.contributedByUserId ?? req.session.userId,
      }).catch(() => {});
      return res.status(200).json(existing);
    }
    const food = await storage.createCustomFood({ ...body, protein100g: String(body.protein100g), carbs100g: String(body.carbs100g), fat100g: String(body.fat100g), contributedByUserId: req.session.userId });
    storage.upsertCanonicalFood({
      name: body.name,
      calories100g: body.calories100g,
      protein100g: body.protein100g,
      carbs100g: body.carbs100g,
      fat100g: body.fat100g,
      servingGrams: body.servingGrams,
      barcode: body.barcode,
      fdcId: null,
      source: "community",
      contributedByUserId: req.session.userId,
    }).catch(() => {});
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

router.patch("/api/food-log/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const body = z.object({
      mealName: z.string().min(1).optional(),
      calories: z.number().int().min(0).optional(),
      protein: z.number().int().min(0).optional(),
      carbs: z.number().int().min(0).optional(),
      fat: z.number().int().min(0).optional(),
      fibre: z.number().int().min(0).nullable().optional(),
      sugar: z.number().int().min(0).nullable().optional(),
      saturatedFat: z.number().int().min(0).nullable().optional(),
      mealSlot: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
    }).parse(req.body);
    const updated = await storage.updateFoodLogEntry(id, req.session.userId, body);
    if (!updated) return res.status(404).json({ message: "Entry not found" });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

router.delete("/api/food-log/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const id = parseInt(req.params.id);
  await storage.deleteFoodLogEntry(id, req.session.userId);
  res.status(204).send();
});

export default router;
