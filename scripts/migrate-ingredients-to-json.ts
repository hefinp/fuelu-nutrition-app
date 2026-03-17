import { pool } from "../server/db";
import { parseIngredients } from "../server/lib/ingredient-parser";

const BATCH_SIZE = 20;
const DELAY_MS = 100;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateTable(tableName: string, ingredientsCol: string, jsonCol: string) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, ${ingredientsCol} FROM ${tableName} WHERE ${jsonCol} IS NULL AND ${ingredientsCol} IS NOT NULL`
    );
    console.log(`[${tableName}] Found ${rows.length} rows to migrate`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        try {
          let ingredientText: string;
          if (Array.isArray(row[ingredientsCol])) {
            ingredientText = row[ingredientsCol].join("\n");
          } else if (typeof row[ingredientsCol] === "string") {
            ingredientText = row[ingredientsCol];
          } else {
            continue;
          }

          if (!ingredientText.trim()) continue;

          const parsed = await parseIngredients(ingredientText);
          await client.query(
            `UPDATE ${tableName} SET ${jsonCol} = $1 WHERE id = $2`,
            [JSON.stringify(parsed.length > 0 ? parsed : []), row.id]
          );
          success++;
        } catch (e: any) {
          console.error(`[${tableName}] Failed row ${row.id}:`, e.message);
          failed++;
        }
      }

      if (i + BATCH_SIZE < rows.length) {
        console.log(`[${tableName}] Processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}...`);
        await sleep(DELAY_MS);
      }
    }

    console.log(`[${tableName}] Done: ${success} migrated, ${failed} failed`);
  } finally {
    client.release();
  }
}

async function main() {
  console.log("Starting ingredients migration...");

  await migrateTable("user_meals", "ingredients", "ingredients_json");
  await migrateTable("user_recipes", "ingredients", "ingredients_json");
  await migrateTable("favourite_meals", "ingredients", "ingredients_json");
  await migrateTable("community_meals", "ingredients", "ingredients_json");

  console.log("Migration complete!");
  process.exit(0);
}

main().catch(e => {
  console.error("Migration failed:", e);
  process.exit(1);
});
