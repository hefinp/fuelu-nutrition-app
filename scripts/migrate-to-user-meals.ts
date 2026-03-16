import { db } from "../server/db";
import { sql } from "drizzle-orm";

interface CountRow {
  cnt: string;
}

async function migrate() {
  console.log("Starting migration: favourite_meals + user_recipes → user_meals");

  const favResult = await db.execute(sql`
    INSERT INTO user_meals (user_id, name, source, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, servings, meal_slot, meal_style, ingredients, ingredients_json, instructions, created_at)
    SELECT
      f.user_id,
      f.meal_name,
      'logged',
      f.calories,
      f.protein,
      f.carbs,
      f.fat,
      1,
      f.meal_slot,
      'simple',
      f.ingredients,
      f.ingredients_json,
      f.instructions,
      f.created_at
    FROM favourite_meals f
    LEFT JOIN user_meals um
      ON um.user_id = f.user_id
      AND um.name = f.meal_name
      AND um.source = 'logged'
      AND um.calories_per_serving = f.calories
      AND um.created_at = f.created_at
    WHERE um.id IS NULL
  `);
  console.log("Migrated favourite_meals rows");

  const recResult = await db.execute(sql`
    INSERT INTO user_meals (user_id, name, source, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, servings, source_url, image_url, meal_slot, meal_style, ingredients, ingredients_json, instructions, created_at)
    SELECT
      r.user_id,
      r.name,
      'imported',
      r.calories_per_serving,
      r.protein_per_serving,
      r.carbs_per_serving,
      r.fat_per_serving,
      r.servings,
      r.source_url,
      r.image_url,
      r.meal_slot,
      COALESCE(r.meal_style, 'simple'),
      r.ingredients,
      r.ingredients_json,
      r.instructions,
      r.created_at
    FROM user_recipes r
    LEFT JOIN user_meals um
      ON um.user_id = r.user_id
      AND um.name = r.name
      AND um.source = 'imported'
      AND um.calories_per_serving = r.calories_per_serving
      AND um.created_at = r.created_at
    WHERE um.id IS NULL
  `);
  console.log("Migrated user_recipes rows");

  const finalCount = await db.execute(sql`SELECT count(*)::text as cnt FROM user_meals`);
  const row = finalCount.rows[0] as CountRow;
  console.log(`Migration complete. Total user_meals rows: ${row.cnt}`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
