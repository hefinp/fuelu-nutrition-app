import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/api/favourites", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const favourites = await storage.getFavouriteMeals(req.session.userId);
    res.json(favourites);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch favourites" });
  }
});

router.post("/api/favourites", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const { mealName, calories, protein, carbs, fat, mealSlot, communityMealId } = req.body;
    if (!mealName || calories == null || protein == null || carbs == null || fat == null) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const created = await storage.addFavouriteMeal({
      userId: req.session.userId,
      mealName,
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      mealSlot: mealSlot ?? null,
    });
    if (communityMealId) {
      await storage.incrementCommunityMealFavourite(Number(communityMealId)).catch(() => {});
    }
    res.json(created);
  } catch (err) {
    res.status(500).json({ message: "Failed to save favourite" });
  }
});

router.patch("/api/favourites/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    const { mealName, calories, protein, carbs, fat, mealSlot } = req.body;
    const updates: Record<string, unknown> = {};
    if (mealName !== undefined) updates.mealName = mealName;
    if (calories !== undefined) updates.calories = Number(calories);
    if (protein !== undefined) updates.protein = Number(protein);
    if (carbs !== undefined) updates.carbs = Number(carbs);
    if (fat !== undefined) updates.fat = Number(fat);
    if (mealSlot !== undefined) updates.mealSlot = mealSlot;
    const updated = await storage.updateFavouriteMeal(Number(req.params.id), req.session.userId, updates as any);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update favourite" });
  }
});

router.delete("/api/favourites/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  try {
    await storage.removeFavouriteMeal(Number(req.params.id), req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove favourite" });
  }
});

export default router;
