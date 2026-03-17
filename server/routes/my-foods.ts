import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function formatBookmark(bm: Awaited<ReturnType<typeof storage.addUserFoodBookmark>>) {
  return {
    id: bm.id,
    userId: bm.userId,
    canonicalFoodId: bm.canonicalFoodId,
    name: bm.nickname ?? bm.food.name,
    calories100g: bm.food.calories100g,
    protein100g: bm.food.protein100g,
    carbs100g: bm.food.carbs100g,
    fat100g: bm.food.fat100g,
    servingGrams: bm.servingGrams ?? bm.food.servingGrams,
    source: bm.food.source,
    createdAt: bm.createdAt,
  };
}

router.get("/api/my-foods", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const params = paginationSchema.parse(req.query);
    const result = await storage.getUserFoodBookmarks(req.session.userId, { cursor: params.cursor, limit: params.limit });
    res.json({
      items: result.items.map(formatBookmark),
      nextCursor: result.nextCursor,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to fetch saved foods" });
  }
});

router.post("/api/my-foods", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      name: z.string().min(1),
      calories100g: z.number().int().min(0),
      protein100g: z.number().min(0),
      carbs100g: z.number().min(0),
      fat100g: z.number().min(0),
      servingGrams: z.number().int().min(1).optional(),
      source: z.string().optional(),
      confirmDuplicate: z.boolean().optional(),
      canonicalFoodId: z.number().int().optional(),
    }).parse(req.body);
    const { confirmDuplicate, canonicalFoodId: providedCanonicalId, servingGrams, source, ...foodData } = body;

    let canonicalFoodId = providedCanonicalId;

    if (!canonicalFoodId) {
      if (!confirmDuplicate) {
        const dupes = await storage.searchCanonicalFoods(foodData.name, 5);
        const exactDupes = dupes.filter(d =>
          d.canonicalName === foodData.name.toLowerCase().replace(/\s+/g, " ").trim()
        );
        if (exactDupes.length > 0) {
          const exactMacroMatch = exactDupes.some(d =>
            d.calories100g === foodData.calories100g &&
            Math.abs(d.protein100g - foodData.protein100g) < 0.5 &&
            Math.abs(d.carbs100g - foodData.carbs100g) < 0.5 &&
            Math.abs(d.fat100g - foodData.fat100g) < 0.5
          );
          const existingUserBms = await storage.findDuplicateUserFoodBookmarks(req.session.userId, exactDupes[0].id);
          if (existingUserBms.length > 0) {
            return res.status(409).json({
              duplicateWarning: true,
              exactMatch: exactMacroMatch,
              existingCount: existingUserBms.length,
              message: exactMacroMatch
                ? `You already have "${exactDupes[0].name}" with identical macros.`
                : `You already have ${existingUserBms.length} food${existingUserBms.length > 1 ? "s" : ""} named "${exactDupes[0].name}".`,
            });
          }
          canonicalFoodId = exactDupes[0].id;
        }
      }
    }

    if (!canonicalFoodId) {
      const canonical = await storage.upsertCanonicalFood({
        name: foodData.name,
        calories100g: foodData.calories100g,
        protein100g: foodData.protein100g,
        carbs100g: foodData.carbs100g,
        fat100g: foodData.fat100g,
        servingGrams: servingGrams ?? 100,
        source: source ?? "user_manual",
        contributedByUserId: req.session.userId,
      });
      canonicalFoodId = canonical.id;
    }

    const created = await storage.addUserFoodBookmark({
      userId: req.session.userId,
      canonicalFoodId,
      servingGrams: servingGrams ?? undefined,
    });
    res.status(201).json(formatBookmark(created));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to save food" });
  }
});

router.patch("/api/my-foods/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const body = z.object({
      servingGrams: z.number().int().min(1).optional(),
      nickname: z.string().optional(),
    }).parse(req.body);
    const updated = await storage.updateUserFoodBookmark(Number(req.params.id), req.session.userId, body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(formatBookmark(updated));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update food" });
  }
});

router.delete("/api/my-foods/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    await storage.removeUserFoodBookmark(Number(req.params.id), req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove food" });
  }
});

export default router;
