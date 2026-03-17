import { pool } from "../db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("[patch] Starting canonical foods data quality fix...");

    // === 1. Correct inaccurate per-100g values (USDA FoodData Central authoritative values) ===

    // id=50 onion: 289→40 kcal
    await client.query(
      `UPDATE canonical_foods
       SET calories_100g = $1, protein_100g = $2, carbs_100g = $3, fat_100g = $4,
           source = $5, verified_at = NOW()
       WHERE id = $6`,
      [40, 1.1, 9.3, 0.1, "usda_verified", 50]
    );
    console.log("[patch] Fixed id=50 (onion)");

    // id=37 avocado: 427→160 kcal
    await client.query(
      `UPDATE canonical_foods
       SET calories_100g = $1, protein_100g = $2, carbs_100g = $3, fat_100g = $4,
           source = $5, verified_at = NOW()
       WHERE id = $6`,
      [160, 2.0, 8.5, 14.7, "usda_verified", 37]
    );
    console.log("[patch] Fixed id=37 (avocado)");

    // id=3 Banana: 312→89 kcal
    await client.query(
      `UPDATE canonical_foods
       SET calories_100g = $1, protein_100g = $2, carbs_100g = $3, fat_100g = $4,
           source = $5, verified_at = NOW()
       WHERE id = $6`,
      [89, 1.1, 23.0, 0.3, "usda_verified", 3]
    );
    console.log("[patch] Fixed id=3 (Banana)");

    // id=38 eggs (ingredient_parsed): 571→155 kcal
    await client.query(
      `UPDATE canonical_foods
       SET calories_100g = $1, protein_100g = $2, carbs_100g = $3, fat_100g = $4,
           source = $5, verified_at = NOW()
       WHERE id = $6`,
      [155, 13.0, 1.1, 11.0, "usda_verified", 38]
    );
    console.log("[patch] Fixed id=38 (eggs / ingredient_parsed)");

    // id=51 garlic: fix protein 0→6.4g (calories 167 within range, leave as-is)
    await client.query(
      `UPDATE canonical_foods
       SET protein_100g = $1, source = $2, verified_at = NOW()
       WHERE id = $3`,
      [6.4, "usda_verified", 51]
    );
    console.log("[patch] Fixed id=51 (garlic) protein");

    // === 2. Remap + delete duplicate/corrupt chicken entries ===

    // id=14 Chicken (corrupt: 556 kcal, 0 protein, 111 carbs) → remap to id=10
    const remap14Mi = await client.query(
      `UPDATE meal_ingredients SET canonical_food_id = $1 WHERE canonical_food_id = $2`,
      [10, 14]
    );
    const remap14Cmi = await client.query(
      `UPDATE community_meal_ingredients SET canonical_food_id = $1 WHERE canonical_food_id = $2`,
      [10, 14]
    );
    console.log(`[patch] Remapped id=14 refs: meal_ingredients=${remap14Mi.rowCount}, community_meal_ingredients=${remap14Cmi.rowCount}`);
    await client.query(`DELETE FROM canonical_foods WHERE id = $1`, [14]);
    console.log("[patch] Deleted id=14 (corrupt chicken)");

    // id=20 Egg (corrupt: 513 kcal, 57.7g carbs) → remap to id=21
    const remap20Mi = await client.query(
      `UPDATE meal_ingredients SET canonical_food_id = $1 WHERE canonical_food_id = $2`,
      [21, 20]
    );
    const remap20Cmi = await client.query(
      `UPDATE community_meal_ingredients SET canonical_food_id = $1 WHERE canonical_food_id = $2`,
      [21, 20]
    );
    console.log(`[patch] Remapped id=20 refs: meal_ingredients=${remap20Mi.rowCount}, community_meal_ingredients=${remap20Cmi.rowCount}`);
    await client.query(`DELETE FROM canonical_foods WHERE id = $1`, [20]);
    console.log("[patch] Deleted id=20 (corrupt Egg)");

    // id=13 Chicken (suspicious carbs) → remap to id=10
    const remap13Mi = await client.query(
      `UPDATE meal_ingredients SET canonical_food_id = $1 WHERE canonical_food_id = $2`,
      [10, 13]
    );
    const remap13Cmi = await client.query(
      `UPDATE community_meal_ingredients SET canonical_food_id = $1 WHERE canonical_food_id = $2`,
      [10, 13]
    );
    console.log(`[patch] Remapped id=13 refs: meal_ingredients=${remap13Mi.rowCount}, community_meal_ingredients=${remap13Cmi.rowCount}`);
    await client.query(`DELETE FROM canonical_foods WHERE id = $1`, [13]);
    console.log("[patch] Deleted id=13 (suspicious chicken)");

    // Mark consolidation targets as usda_verified (they are now the surviving authoritative entries)
    await client.query(
      `UPDATE canonical_foods SET source = $1, verified_at = NOW() WHERE id = ANY($2::int[])`,
      ["usda_verified", [10, 21]]
    );
    console.log("[patch] Marked id=10 (Chicken) and id=21 (Eggs) as usda_verified");

    // === 3. Update stale ingredients_json snapshots on community meals ===
    // For each community meal whose ingredients_json contains an ingredient name matching a
    // corrected canonical food, update the per-100g macro fields in the matching objects.
    // Uses parameterised jsonb updates so only matching elements are changed.

    type Correction = {
      namePattern: string;
      excludePattern?: string;
      calories100g: number;
      protein100g: number;
      carbs100g: number;
      fat100g: number;
    };

    const corrections: Correction[] = [
      { namePattern: "%onion%",   calories100g: 40,  protein100g: 1.1,  carbs100g: 9.3,  fat100g: 0.1  },
      { namePattern: "%avocado%", calories100g: 160, protein100g: 2.0,  carbs100g: 8.5,  fat100g: 14.7 },
      { namePattern: "%banana%",  calories100g: 89,  protein100g: 1.1,  carbs100g: 23.0, fat100g: 0.3  },
      // egg: exclude "eggplant" to avoid false positives
      { namePattern: "%egg%", excludePattern: "%eggplant%", calories100g: 155, protein100g: 13.0, carbs100g: 1.1, fat100g: 11.0 },
    ];

    for (const c of corrections) {
      const hasExclude = !!c.excludePattern;

      // Build the CASE match condition dynamically to handle optional exclusion
      // $1=namePattern, [$2=excludePattern,] $N=calories, $N+1=protein, $N+2=carbs, $N+3=fat
      let params: (string | number)[];
      let caseCondition: string;
      let existsCondition: string;

      if (hasExclude) {
        params = [c.namePattern, c.excludePattern!, c.calories100g, c.protein100g, c.carbs100g, c.fat100g];
        caseCondition = `lower(elem->>'name') LIKE $1 AND lower(elem->>'name') NOT LIKE $2`;
        existsCondition = `lower(e->>'name') LIKE $1 AND lower(e->>'name') NOT LIKE $2`;
      } else {
        params = [c.namePattern, c.calories100g, c.protein100g, c.carbs100g, c.fat100g];
        caseCondition = `lower(elem->>'name') LIKE $1`;
        existsCondition = `lower(e->>'name') LIKE $1`;
      }

      const calIdx  = hasExclude ? 3 : 2;
      const protIdx = calIdx + 1;
      const carbIdx = calIdx + 2;
      const fatIdx  = calIdx + 3;

      const updateResult = await client.query(
        `UPDATE community_meals
         SET ingredients_json = (
           SELECT jsonb_agg(
             CASE
               WHEN ${caseCondition}
               THEN elem
                 || jsonb_build_object('calories100g', $${calIdx}::numeric)
                 || jsonb_build_object('protein100g',  $${protIdx}::numeric)
                 || jsonb_build_object('carbs100g',    $${carbIdx}::numeric)
                 || jsonb_build_object('fat100g',      $${fatIdx}::numeric)
               ELSE elem
             END
           )
           FROM jsonb_array_elements(ingredients_json) elem
         )
         WHERE ingredients_json IS NOT NULL
           AND ingredients_json != 'null'::jsonb
           AND jsonb_typeof(ingredients_json) = 'array'
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(ingredients_json) e
             WHERE ${existsCondition}
           )`,
        params
      );
      console.log(`[patch] Updated ingredients_json for '${c.namePattern}': ${updateResult.rowCount} community meals affected`);
    }

    // === 4. Recompute community meal top-level macros after patching ingredients_json ===
    const recomputeResult = await client.query(`
      UPDATE community_meals cm
      SET
        calories_per_serving = subq.total_calories,
        protein_per_serving  = subq.total_protein,
        carbs_per_serving    = subq.total_carbs,
        fat_per_serving      = subq.total_fat
      FROM (
        SELECT
          id,
          ROUND(SUM((elem->>'grams')::numeric * (elem->>'calories100g')::numeric / 100))::integer AS total_calories,
          ROUND(SUM((elem->>'grams')::numeric * (elem->>'protein100g')::numeric  / 100))::integer AS total_protein,
          ROUND(SUM((elem->>'grams')::numeric * (elem->>'carbs100g')::numeric    / 100))::integer AS total_carbs,
          ROUND(SUM((elem->>'grams')::numeric * (elem->>'fat100g')::numeric      / 100))::integer AS total_fat
        FROM community_meals,
          jsonb_array_elements(ingredients_json) elem
        WHERE ingredients_json IS NOT NULL
          AND ingredients_json != 'null'::jsonb
          AND jsonb_typeof(ingredients_json) = 'array'
          AND (elem->>'grams') IS NOT NULL
          AND (elem->>'calories100g') IS NOT NULL
        GROUP BY id
        HAVING SUM((elem->>'grams')::numeric * (elem->>'calories100g')::numeric / 100) > 0
      ) subq
      WHERE cm.id = subq.id
        AND (
          cm.calories_per_serving != subq.total_calories OR
          cm.protein_per_serving  != subq.total_protein OR
          cm.carbs_per_serving    != subq.total_carbs OR
          cm.fat_per_serving      != subq.total_fat
        )
    `);
    console.log(`[patch] Recomputed top-level macros for ${recomputeResult.rowCount} community meals`);

    await client.query("COMMIT");
    console.log("[patch] All changes committed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[patch] Error — rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
