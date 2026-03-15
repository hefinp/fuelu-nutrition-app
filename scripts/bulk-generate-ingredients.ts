/**
 * One-time migration: Bulk-generate ingredients & instructions for community meals,
 * and convert favourites' plain-text ingredients to structured JSON.
 *
 * Idempotent — only processes rows with NULL values.
 * Run: npx tsx scripts/bulk-generate-ingredients.ts
 */
import OpenAI from "openai";
import { db } from "../server/db";
import { communityMeals, favouriteMeals } from "../shared/schema";
import { eq, isNull, isNotNull, and } from "drizzle-orm";
import { parseIngredients } from "../server/lib/ingredient-parser";

const openai = new OpenAI();

async function generateIngredientsForCommunityMeals() {
  const meals = await db.select().from(communityMeals)
    .where(and(eq(communityMeals.active, true), isNull(communityMeals.ingredients)));

  console.log(`Found ${meals.length} community meals missing ingredients`);

  const BATCH_SIZE = 10;
  for (let i = 0; i < meals.length; i += BATCH_SIZE) {
    const batch = meals.slice(i, i + BATCH_SIZE);
    const batchDescriptions = batch.map(m =>
      `ID:${m.id} | "${m.name}" | ${m.slot} | ${m.style} | ${m.caloriesPerServing}kcal P:${m.proteinPerServing}g C:${m.carbsPerServing}g F:${m.fatPerServing}g`
    ).join("\n");

    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(meals.length / BATCH_SIZE)} (${batch.length} meals)...`);

    try {
      const aiRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a recipe creator. For each meal provided, generate realistic ingredients and cooking instructions that match the meal name, style, slot, and approximate macro targets.

Return a JSON object with key "meals" containing an array. Each item must have:
- "id": the meal ID (number)
- "ingredients": array of ingredient strings (e.g. ["2 eggs", "1 tbsp olive oil", "50g spinach"])
- "instructions": cooking steps as a single string with numbered steps separated by newlines

Style guide:
- "simple": everyday home cooking, 4-8 ingredients, straightforward steps
- "gourmet": elevated flavours, 6-12 ingredients, more technique
- "michelin": fine dining, 8-14 ingredients, refined technique and plating

Keep ingredient quantities realistic for 1 serving. Instructions should be 4-8 steps.`,
          },
          { role: "user", content: `Generate ingredients and instructions for these meals:\n\n${batchDescriptions}` },
        ],
      });

      const parsed = JSON.parse(aiRes.choices[0].message.content ?? "{}");
      if (!parsed.meals || !Array.isArray(parsed.meals)) {
        console.error(`  Batch returned invalid format, skipping`);
        continue;
      }

      for (const item of parsed.meals) {
        if (!item.id || !Array.isArray(item.ingredients) || !item.instructions) {
          console.error(`  Skipping invalid item:`, JSON.stringify(item).substring(0, 100));
          continue;
        }
        try {
          await db.update(communityMeals)
            .set({ ingredients: item.ingredients, instructions: item.instructions })
            .where(eq(communityMeals.id, item.id));
          console.log(`  OK ${item.id}: ${batch.find(m => m.id === item.id)?.name} (${item.ingredients.length} ingredients)`);
        } catch (err: any) {
          console.error(`  FAIL ${item.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      console.error(`  Batch error: ${err.message}`);
    }
  }
}

async function convertFavouritesIngredients() {
  const favs = await db.select().from(favouriteMeals)
    .where(and(isNotNull(favouriteMeals.ingredients), isNull(favouriteMeals.ingredientsJson)));

  console.log(`\nFound ${favs.length} favourites needing ingredient conversion`);

  for (const fav of favs) {
    const ingredientText = fav.ingredients ?? "";
    if (!ingredientText.trim()) continue;

    console.log(`Converting favourite ${fav.id}: "${fav.mealName}" ...`);

    try {
      const results = await parseIngredients(ingredientText, fav.userId);

      const json = results.map(r => ({
        key: r.key,
        name: r.name,
        calories100g: r.calories100g,
        protein100g: r.protein100g,
        carbs100g: r.carbs100g,
        fat100g: r.fat100g,
        grams: r.grams,
      }));

      await db.update(favouriteMeals)
        .set({ ingredientsJson: json })
        .where(eq(favouriteMeals.id, fav.id));

      console.log(`  OK: ${json.length} structured ingredients saved`);
    } catch (err: any) {
      console.error(`  FAIL: ${err.message}`);
    }
  }
}

async function verify() {
  const missingCommunity = await db.select().from(communityMeals)
    .where(and(eq(communityMeals.active, true), isNull(communityMeals.ingredients)));
  const missingFavs = await db.select().from(favouriteMeals)
    .where(and(isNotNull(favouriteMeals.ingredients), isNull(favouriteMeals.ingredientsJson)));

  console.log(`\n=== Verification ===`);
  console.log(`Community meals still missing ingredients: ${missingCommunity.length}`);
  console.log(`Favourites still needing conversion: ${missingFavs.length}`);

  if (missingCommunity.length === 0 && missingFavs.length === 0) {
    console.log(`All rows processed successfully.`);
  } else {
    console.log(`WARNING: Some rows remain unprocessed. Re-run the script.`);
  }
}

async function main() {
  console.log("=== Bulk Generate Ingredients & Instructions ===\n");
  await generateIngredientsForCommunityMeals();
  await convertFavouritesIngredients();
  await verify();
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
