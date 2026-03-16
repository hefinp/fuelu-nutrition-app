import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Starting migration: favourite_meals + user_recipes → user_meals");

  const existingCount = await db.execute(sql`SELECT count(*) as cnt FROM user_meals`);
  const existing = Number((existingCount.rows[0] as any).cnt);
  if (existing > 0) {
    console.log(`user_meals already has ${existing} rows — skipping migration to avoid duplicates.`);
    return;
  }

  const favResult = await db.execute(sql`
    INSERT INTO user_meals (user_id, name, source, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, servings, meal_slot, meal_style, ingredients, ingredients_json, instructions, created_at)
    SELECT
      user_id,
      meal_name,
      'logged',
      calories,
      protein,
      carbs,
      fat,
      1,
      meal_slot,
      NULL,
      ingredients,
      ingredients_json,
      instructions,
      created_at
    FROM favourite_meals
    ON CONFLICT DO NOTHING
  `);
  console.log(`Migrated favourite_meals rows`);

  const recResult = await db.execute(sql`
    INSERT INTO user_meals (user_id, name, source, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, servings, source_url, image_url, meal_slot, meal_style, ingredients, ingredients_json, instructions, created_at)
    SELECT
      user_id,
      name,
      'imported',
      calories_per_serving,
      protein_per_serving,
      carbs_per_serving,
      fat_per_serving,
      servings,
      source_url,
      image_url,
      meal_slot,
      meal_style,
      ingredients,
      ingredients_json,
      instructions,
      created_at
    FROM user_recipes
    ON CONFLICT DO NOTHING
  `);
  console.log(`Migrated user_recipes rows`);

  const finalCount = await db.execute(sql`SELECT count(*) as cnt FROM user_meals`);
  console.log(`Migration complete. Total user_meals rows: ${(finalCount.rows[0] as any).cnt}`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
