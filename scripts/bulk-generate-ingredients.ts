/**
 * One-time migration script: Bulk-generate ingredients & instructions
 * 
 * Run: npx tsx scripts/bulk-generate-ingredients.ts
 * 
 * Executed on 2026-03-15 for Task #112.
 * - Generated ingredients/instructions for 90 community meals (96 total, 6 already had data)
 * - Converted 2 favourite meals' plain-text ingredients to structured ingredientsJson
 * 
 * This script is idempotent — it only processes rows with NULL values.
 */
import OpenAI from "openai";
import { db } from "../server/db";
import { communityMeals, favouriteMeals } from "../shared/schema";
import { eq, isNull, isNotNull, and } from "drizzle-orm";

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
- "instructions": cooking steps as a single string with numbered steps separated by newlines (e.g. "1. Preheat oven to 180°C.\n2. Mix ingredients...")

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
            .set({
              ingredients: item.ingredients,
              instructions: item.instructions,
            })
            .where(eq(communityMeals.id, item.id));
          console.log(`  ✓ ${item.id}: ${batch.find(m => m.id === item.id)?.name} (${item.ingredients.length} ingredients)`);
        } catch (err: any) {
          console.error(`  ✗ ${item.id}: DB error: ${err.message}`);
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
    const lines = (fav.ingredients ?? "").split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    console.log(`Converting favourite ${fav.id}: "${fav.mealName}" (${lines.length} lines)...`);

    try {
      const aiRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a nutrition data assistant. For each ingredient line, estimate the nutritional values per 100g and the likely serving weight in grams.

Return a JSON object with key "ingredients" containing an array. Each item must have:
- "key": a unique string like "parsed-0", "parsed-1", etc.
- "name": the ingredient name (cleaned up, e.g. "chia seeds" not "3 tbsp chia seeds")
- "calories100g": calories per 100g (number)
- "protein100g": protein per 100g in grams (number)
- "carbs100g": carbs per 100g in grams (number)
- "fat100g": fat per 100g in grams (number)
- "grams": the estimated weight of the specified quantity in grams (number)

Be accurate with nutritional data. Use standard USDA-style values.`,
          },
          { role: "user", content: `Parse these ingredients:\n${lines.join("\n")}` },
        ],
      });

      const parsed = JSON.parse(aiRes.choices[0].message.content ?? "{}");
      if (!parsed.ingredients || !Array.isArray(parsed.ingredients)) {
        console.error(`  Invalid AI response, skipping`);
        continue;
      }

      await db.update(favouriteMeals)
        .set({ ingredientsJson: parsed.ingredients })
        .where(eq(favouriteMeals.id, fav.id));

      console.log(`  ✓ Converted ${parsed.ingredients.length} ingredients`);
    } catch (err: any) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }
}

async function main() {
  console.log("=== Bulk Generate Ingredients & Instructions ===\n");

  await generateIngredientsForCommunityMeals();
  await convertFavouritesIngredients();

  const communityCheck = await db.select().from(communityMeals)
    .where(and(eq(communityMeals.active, true), isNull(communityMeals.ingredients)));
  const favCheck = await db.select().from(favouriteMeals)
    .where(and(isNotNull(favouriteMeals.ingredients), isNull(favouriteMeals.ingredientsJson)));

  console.log(`\n=== Verification ===`);
  console.log(`Community meals still missing ingredients: ${communityCheck.length}`);
  console.log(`Favourites still needing conversion: ${favCheck.length}`);
  console.log(`=== Done ===`);
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
