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
