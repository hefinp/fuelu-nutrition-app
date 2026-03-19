import { db } from "../server/db";
import { canonicalFoods } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import restaurantData from "../server/seeds/restaurant-foods.json";

interface RestaurantFoodEntry {
  brand: string;
  category: string;
  name: string;
  calories100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
  fibre100g?: number;
  sugar100g?: number;
  saturatedFat100g?: number;
  servingGrams: number;
  sourceUrl?: string;
  imageUrl?: string;
  cookTime?: string;
  ingredientsList?: string[];
}

async function main() {
  const items = restaurantData as RestaurantFoodEntry[];
  console.log(`Seeding ${items.length} restaurant/Hello Fresh food items...`);

  let inserted = 0;
  let skipped = 0;

  for (const item of items) {
    const canonicalName = item.name.toLowerCase().replace(/\s+/g, " ").trim();
    const existing = await db.select({ id: canonicalFoods.id })
      .from(canonicalFoods)
      .where(and(
        eq(canonicalFoods.canonicalName, canonicalName),
        eq(canonicalFoods.brand, item.brand)
      ))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(canonicalFoods).values({
      name: item.name,
      canonicalName,
      calories100g: item.calories100g,
      protein100g: item.protein100g,
      carbs100g: item.carbs100g,
      fat100g: item.fat100g,
      fibre100g: item.fibre100g ?? null,
      sugar100g: item.sugar100g ?? null,
      saturatedFat100g: item.saturatedFat100g ?? null,
      sodium100g: null,
      servingGrams: item.servingGrams,
      source: "restaurant_nz",
      region: "nz",
      brand: item.brand,
      category: item.category,
      imageUrl: item.imageUrl ?? null,
      sourceUrl: item.sourceUrl ?? null,
      cookTime: item.cookTime ?? null,
      ingredientsList: item.ingredientsList ?? null,
      verifiedAt: new Date(),
    });
    inserted++;
  }

  console.log(`Done! Inserted: ${inserted}, Skipped (already exist): ${skipped}`);
  process.exit(0);
}

main().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
