import { pool } from "./db";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";

const INVITE_CODES = Array.from({ length: 20 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return `BETA${n}${n}`;
});

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        code          TEXT PRIMARY KEY,
        used_at       TIMESTAMP,
        used_by_email TEXT
      )
    `);

    if (INVITE_CODES.length > 0) {
      const placeholders = INVITE_CODES.map((_, i) => `($${i + 1})`).join(", ");
      await client.query(
        `INSERT INTO invite_codes (code) VALUES ${placeholders} ON CONFLICT (code) DO NOTHING`,
        INVITE_CODES,
      );
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS cycle_period_logs (
        id                    SERIAL PRIMARY KEY,
        user_id               INTEGER NOT NULL REFERENCES users(id),
        period_start_date     TEXT NOT NULL,
        period_end_date       TEXT,
        computed_cycle_length INTEGER,
        notes                 TEXT,
        created_at            TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_insights_cache (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id),
        cache_key       TEXT NOT NULL,
        narrative_json  JSONB NOT NULL,
        expires_at      TIMESTAMP NOT NULL,
        created_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, cache_key)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cycle_symptoms (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id),
        date        TEXT NOT NULL,
        energy      TEXT,
        bloating    TEXT,
        cravings    TEXT,
        mood        TEXT,
        appetite    TEXT,
        created_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, date)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS favourite_meals (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        meal_name  TEXT NOT NULL,
        calories   INTEGER NOT NULL,
        protein    INTEGER NOT NULL,
        carbs      INTEGER NOT NULL,
        fat        INTEGER NOT NULL,
        meal_slot  TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_meals (
        id                   SERIAL PRIMARY KEY,
        user_id              INTEGER NOT NULL REFERENCES users(id),
        name                 TEXT NOT NULL,
        source               TEXT NOT NULL DEFAULT 'manual',
        calories_per_serving INTEGER NOT NULL DEFAULT 0,
        protein_per_serving  REAL NOT NULL DEFAULT 0,
        carbs_per_serving    REAL NOT NULL DEFAULT 0,
        fat_per_serving      REAL NOT NULL DEFAULT 0,
        servings             INTEGER NOT NULL DEFAULT 1,
        source_url           TEXT,
        image_url            TEXT,
        meal_slot            TEXT,
        meal_style           TEXT NOT NULL DEFAULT 'simple',
        ingredients          TEXT,
        ingredients_json     JSONB,
        instructions         TEXT,
        created_at           TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS community_meals (
        id                   SERIAL PRIMARY KEY,
        source_recipe_id     INTEGER,
        source_user_id       INTEGER REFERENCES users(id),
        name                 TEXT NOT NULL,
        slot                 TEXT NOT NULL,
        style                TEXT NOT NULL DEFAULT 'simple',
        calories_per_serving INTEGER NOT NULL,
        protein_per_serving  INTEGER NOT NULL,
        carbs_per_serving    INTEGER NOT NULL,
        fat_per_serving      INTEGER NOT NULL,
        micro_score          INTEGER NOT NULL DEFAULT 3,
        favourite_count      INTEGER NOT NULL DEFAULT 0,
        active               BOOLEAN NOT NULL DEFAULT TRUE,
        source               TEXT NOT NULL DEFAULT 'user',
        created_at           TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE food_log_entries
      ADD COLUMN IF NOT EXISTS community_meal_id INTEGER REFERENCES community_meals(id)
    `);

    await client.query(`
      ALTER TABLE food_log_entries
      ADD COLUMN IF NOT EXISTS source TEXT
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meal_templates (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id),
        user_meal_id    INTEGER NOT NULL REFERENCES user_meals(id),
        meal_slot       TEXT NOT NULL,
        days_of_week    TEXT[] NOT NULL,
        active          BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_saved_foods' AND column_name = 'protein_100g' AND data_type = 'numeric'
        ) THEN
          ALTER TABLE user_saved_foods ALTER COLUMN protein_100g TYPE real USING protein_100g::real;
          ALTER TABLE user_saved_foods ALTER COLUMN carbs_100g TYPE real USING carbs_100g::real;
          ALTER TABLE user_saved_foods ALTER COLUMN fat_100g TYPE real USING fat_100g::real;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_meals' AND column_name = 'protein_per_serving' AND data_type = 'integer'
        ) THEN
          ALTER TABLE user_meals ALTER COLUMN protein_per_serving TYPE real USING protein_per_serving::real;
          ALTER TABLE user_meals ALTER COLUMN carbs_per_serving TYPE real USING carbs_per_serving::real;
          ALTER TABLE user_meals ALTER COLUMN fat_per_serving TYPE real USING fat_per_serving::real;
        END IF;
      END $$;
    `);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_user BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_tier TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_tier_locked BOOLEAN NOT NULL DEFAULT FALSE`);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_status TEXT NOT NULL DEFAULT 'none'`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_step_down_seen BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_expired_seen BOOLEAN NOT NULL DEFAULT FALSE`);

    await client.query(`
      UPDATE users SET beta_user = TRUE, tier = 'advanced'
      WHERE email IN (SELECT used_by_email FROM invite_codes WHERE used_by_email IS NOT NULL)
        AND beta_user = FALSE
        AND created_at < '2026-03-17T00:00:00Z'
    `);

    await client.query(`
      UPDATE users SET tier = 'advanced'
      WHERE beta_user = TRUE AND tier = 'free'
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS feature_gates (
        id              SERIAL PRIMARY KEY,
        feature_key     TEXT NOT NULL UNIQUE,
        required_tier   TEXT NOT NULL DEFAULT 'free',
        credit_cost     INTEGER NOT NULL DEFAULT 0,
        description     TEXT,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id),
        amount          INTEGER NOT NULL,
        type            TEXT NOT NULL,
        feature_key     TEXT,
        description     TEXT,
        cost_usd        INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS cost_usd INTEGER NOT NULL DEFAULT 0`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tier_pricing (
        id                     SERIAL PRIMARY KEY,
        tier                   TEXT NOT NULL,
        monthly_price_usd      INTEGER NOT NULL,
        annual_price_usd       INTEGER NOT NULL,
        stripe_price_id_monthly TEXT,
        stripe_price_id_annual  TEXT,
        active                 BOOLEAN NOT NULL DEFAULT TRUE,
        features               JSONB NOT NULL DEFAULT '[]',
        display_order          INTEGER NOT NULL DEFAULT 0,
        created_at             TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS credit_packs (
        id              SERIAL PRIMARY KEY,
        credits         INTEGER NOT NULL,
        price_usd       INTEGER NOT NULL,
        stripe_price_id TEXT,
        active          BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS tier_pricing_tier_idx ON tier_pricing (tier)
    `).catch(() => {});

    await client.query(`
      INSERT INTO tier_pricing (tier, monthly_price_usd, annual_price_usd, active, features, display_order) VALUES
        ('simple', 999, 9590, TRUE, '["AI meal plans (Simple tier)","Barcode scanning","PDF export","Up to 5 saved meal plans","Hydration tracking"]'::jsonb, 1),
        ('advanced', 1999, 19190, TRUE, '["AI meal plans (all tiers)","AI food recognition","AI insights & trends","Cycle-aware nutrition","Unlimited saved plans","Priority support"]'::jsonb, 2)
      ON CONFLICT (tier) DO NOTHING
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vitality_symptoms (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id),
        date            TEXT NOT NULL,
        energy          TEXT,
        motivation      TEXT,
        focus           TEXT,
        stress          TEXT,
        sleep_quality   TEXT,
        libido          TEXT,
        created_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, date)
      )
    `);

    await client.query(`
      INSERT INTO feature_gates (feature_key, required_tier, credit_cost, description) VALUES
        ('ai_insights', 'simple', 5, 'AI-powered nutrition insights'),
        ('ai_meal_plan', 'simple', 10, 'AI meal plan generation'),
        ('ai_photo_scan', 'simple', 3, 'AI nutrition label scanning'),
        ('recipe_library', 'free', 0, 'Access recipe library'),
        ('barcode_scan', 'free', 0, 'Barcode food scanning'),
        ('community_meals', 'free', 0, 'Community meal sharing'),
        ('meal_templates', 'simple', 0, 'Recurring meal templates'),
        ('cycle_tracking', 'simple', 0, 'Cycle-aware nutrition'),
        ('vitality_tracking', 'simple', 0, 'Male vitality tracking'),
        ('advanced_analytics', 'advanced', 0, 'Advanced analytics dashboard'),
        ('export_data', 'advanced', 0, 'Export nutrition data'),
        ('adaptive_tdee', 'advanced', 0, 'Adaptive TDEE metabolic recalibration'),
        ('priority_support', 'advanced', 0, 'Priority support access')
      ON CONFLICT (feature_key) DO NOTHING
    `);

    await client.query(`ALTER TABLE user_meals ADD COLUMN IF NOT EXISTS source_photos TEXT[]`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS canonical_foods (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        calories_100g INTEGER NOT NULL,
        protein_100g REAL NOT NULL,
        carbs_100g REAL NOT NULL,
        fat_100g REAL NOT NULL,
        serving_grams INTEGER NOT NULL DEFAULT 100,
        barcode TEXT,
        fdc_id TEXT,
        source TEXT NOT NULL DEFAULT 'user_manual',
        verified_at TIMESTAMP,
        contributed_by_user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meal_ingredients (
        id SERIAL PRIMARY KEY,
        user_meal_id INTEGER NOT NULL REFERENCES user_meals(id) ON DELETE CASCADE,
        canonical_food_id INTEGER REFERENCES canonical_foods(id),
        name TEXT NOT NULL,
        grams REAL NOT NULL,
        calories_100g REAL NOT NULL,
        protein_100g REAL NOT NULL,
        carbs_100g REAL NOT NULL,
        fat_100g REAL NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS meal_ingredients_user_meal_idx ON meal_ingredients (user_meal_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS meal_ingredients_canonical_food_idx ON meal_ingredients (canonical_food_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS community_meal_ingredients (
        id SERIAL PRIMARY KEY,
        community_meal_id INTEGER NOT NULL REFERENCES community_meals(id) ON DELETE CASCADE,
        canonical_food_id INTEGER REFERENCES canonical_foods(id),
        name TEXT NOT NULL,
        grams REAL NOT NULL,
        calories_100g REAL NOT NULL,
        protein_100g REAL NOT NULL,
        carbs_100g REAL NOT NULL,
        fat_100g REAL NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS community_meal_ingredients_meal_idx ON community_meal_ingredients (community_meal_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS community_meal_ingredients_canonical_food_idx ON community_meal_ingredients (canonical_food_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id SERIAL PRIMARY KEY,
        user_recipe_id INTEGER NOT NULL REFERENCES user_recipes(id) ON DELETE CASCADE,
        canonical_food_id INTEGER REFERENCES canonical_foods(id),
        name TEXT NOT NULL,
        grams REAL NOT NULL,
        calories_100g REAL NOT NULL,
        protein_100g REAL NOT NULL,
        carbs_100g REAL NOT NULL,
        fat_100g REAL NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx ON recipe_ingredients (user_recipe_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS recipe_ingredients_canonical_food_idx ON recipe_ingredients (canonical_food_id)`);

    // Backfill community_meal_ingredients from existing community_meals with ingredientsJson
    const cmRows = await client.query(`SELECT id, ingredients_json FROM community_meals WHERE ingredients_json IS NOT NULL`);
    for (const row of cmRows.rows) {
      const existing = await client.query(`SELECT 1 FROM community_meal_ingredients WHERE community_meal_id = $1 LIMIT 1`, [row.id]);
      if (existing.rowCount && existing.rowCount > 0) continue;
      const ingredients = row.ingredients_json;
      if (!Array.isArray(ingredients)) continue;
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        if (!ing || !ing.name || !ing.calories100g) continue;
        await client.query(
          `INSERT INTO community_meal_ingredients (community_meal_id, name, grams, calories_100g, protein_100g, carbs_100g, fat_100g, order_index) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [row.id, ing.name, ing.grams || 100, ing.calories100g, ing.protein100g || 0, ing.carbs100g || 0, ing.fat100g || 0, i]
        );
      }
    }

    // Backfill recipe_ingredients from existing user_recipes with ingredientsJson
    const recipeRows = await client.query(`SELECT id, ingredients_json FROM user_recipes WHERE ingredients_json IS NOT NULL`);
    for (const row of recipeRows.rows) {
      const existing = await client.query(`SELECT 1 FROM recipe_ingredients WHERE user_recipe_id = $1 LIMIT 1`, [row.id]);
      if (existing.rowCount && existing.rowCount > 0) continue;
      const ingredients = row.ingredients_json;
      if (!Array.isArray(ingredients)) continue;
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        if (!ing || !ing.name || !ing.calories100g) continue;
        await client.query(
          `INSERT INTO recipe_ingredients (user_recipe_id, name, grams, calories_100g, protein_100g, carbs_100g, fat_100g, order_index) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [row.id, ing.name, ing.grams || 100, ing.calories100g, ing.protein100g || 0, ing.carbs100g || 0, ing.fat100g || 0, i]
        );
      }
    }

    const barcodeDups = await client.query(`SELECT barcode, COUNT(*) FROM canonical_foods WHERE barcode IS NOT NULL GROUP BY barcode HAVING COUNT(*) > 1`);
    if (barcodeDups.rowCount === 0) {
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_foods_barcode_uniq ON canonical_foods (barcode) WHERE barcode IS NOT NULL`);
    } else {
      console.warn("[migrate] Skipping barcode unique index — duplicate barcodes found:", barcodeDups.rows);
    }

    const fdcDups = await client.query(`SELECT fdc_id, COUNT(*) FROM canonical_foods WHERE fdc_id IS NOT NULL GROUP BY fdc_id HAVING COUNT(*) > 1`);
    if (fdcDups.rowCount === 0) {
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_foods_fdc_id_uniq ON canonical_foods (fdc_id) WHERE fdc_id IS NOT NULL`);
    } else {
      console.warn("[migrate] Skipping fdc_id unique index — duplicate fdc_ids found:", fdcDups.rows);
    }

    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS region TEXT`);
    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS fibre_100g REAL`);
    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS sodium_100g REAL`);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_canonical_foods_region ON canonical_foods (region) WHERE region IS NOT NULL`);

    // Nutritionist tables
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_managed_client BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_by_nutritionist_id INTEGER`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nutritionist_profiles (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id) UNIQUE,
        tier            TEXT NOT NULL DEFAULT 'starter',
        bio             TEXT,
        credentials     TEXT,
        specializations TEXT[],
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nutritionist_clients (
        id                SERIAL PRIMARY KEY,
        nutritionist_id   INTEGER NOT NULL REFERENCES users(id),
        client_id         INTEGER NOT NULL REFERENCES users(id),
        status            TEXT NOT NULL DEFAULT 'onboarding',
        goal_summary      TEXT,
        health_notes      TEXT,
        last_activity_at  TIMESTAMP DEFAULT NOW(),
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE nutritionist_clients ADD COLUMN IF NOT EXISTS health_notes TEXT`);
    await client.query(`ALTER TABLE nutritionist_clients ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'onboarding'`);
    await client.query(`ALTER TABLE nutritionist_profiles ADD COLUMN IF NOT EXISTS max_clients INTEGER`);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_nutritionist_clients_nutritionist ON nutritionist_clients (nutritionist_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_nutritionist_clients_client_unique ON nutritionist_clients (client_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nutritionist_invitations (
        id                SERIAL PRIMARY KEY,
        nutritionist_id   INTEGER NOT NULL REFERENCES users(id),
        email             TEXT NOT NULL,
        token             TEXT NOT NULL UNIQUE,
        expires_at        TIMESTAMP NOT NULL,
        accepted_at       TIMESTAMP,
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nutritionist_notes (
        id                SERIAL PRIMARY KEY,
        nutritionist_id   INTEGER NOT NULL REFERENCES users(id),
        client_id         INTEGER NOT NULL REFERENCES users(id),
        note              TEXT NOT NULL,
        created_at        TIMESTAMP DEFAULT NOW(),
        updated_at        TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_nutritionist_notes_nutritionist_client ON nutritionist_notes (nutritionist_id, client_id)`);

    // Practice account tables (for practice tier)
    await client.query(`
      CREATE TABLE IF NOT EXISTS practice_accounts (
        id              SERIAL PRIMARY KEY,
        name            TEXT NOT NULL,
        admin_user_id   INTEGER NOT NULL REFERENCES users(id),
        max_seats       INTEGER NOT NULL DEFAULT 5,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS practice_members (
        id                    SERIAL PRIMARY KEY,
        practice_id           INTEGER NOT NULL REFERENCES practice_accounts(id) ON DELETE CASCADE,
        nutritionist_user_id  INTEGER NOT NULL REFERENCES users(id),
        role                  TEXT NOT NULL DEFAULT 'member',
        created_at            TIMESTAMP DEFAULT NOW(),
        UNIQUE(practice_id, nutritionist_user_id)
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_practice_members_practice ON practice_members (practice_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_practice_members_nutritionist ON practice_members (nutritionist_user_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS client_intake_forms (
        id                      SERIAL PRIMARY KEY,
        nutritionist_client_id  INTEGER NOT NULL REFERENCES nutritionist_clients(id) ON DELETE CASCADE,
        nutritionist_id         INTEGER NOT NULL REFERENCES users(id),
        client_id               INTEGER NOT NULL REFERENCES users(id),
        medical_history         TEXT,
        medications             TEXT,
        lifestyle               TEXT,
        dietary_restrictions    TEXT,
        food_preferences        TEXT,
        notes                   TEXT,
        completed_at            TIMESTAMP,
        created_at              TIMESTAMP DEFAULT NOW(),
        updated_at              TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_client_intake_forms_relationship ON client_intake_forms (nutritionist_client_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_client_intake_forms_nutritionist_client ON client_intake_forms (nutritionist_id, client_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS client_goals (
        id                      SERIAL PRIMARY KEY,
        nutritionist_client_id  INTEGER NOT NULL REFERENCES nutritionist_clients(id) ON DELETE CASCADE,
        nutritionist_id         INTEGER NOT NULL REFERENCES users(id),
        client_id               INTEGER NOT NULL REFERENCES users(id),
        goal_type               TEXT NOT NULL DEFAULT 'custom',
        title                   TEXT NOT NULL,
        target_value            TEXT,
        current_value           TEXT,
        unit                    TEXT,
        target_date             TIMESTAMP,
        status                  TEXT NOT NULL DEFAULT 'active',
        created_at              TIMESTAMP DEFAULT NOW(),
        updated_at              TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_client_goals_nutritionist_client ON client_goals (nutritionist_id, client_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS strava_activities (
        id                    SERIAL PRIMARY KEY,
        user_id               INTEGER NOT NULL REFERENCES users(id),
        strava_activity_id    BIGINT NOT NULL,
        name                  TEXT NOT NULL,
        type                  TEXT NOT NULL,
        sport_type            TEXT,
        start_date            TIMESTAMP NOT NULL,
        moving_time           INTEGER NOT NULL,
        distance              REAL NOT NULL DEFAULT 0,
        total_elevation_gain  REAL DEFAULT 0,
        calories              REAL DEFAULT 0,
        average_heartrate     REAL,
        max_heartrate         REAL,
        average_speed         REAL DEFAULT 0,
        created_at            TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_strava_activities_user_strava ON strava_activities (user_id, strava_activity_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_strava_activities_user_date ON strava_activities (user_id, start_date)`);

    console.log(`${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })} [migrate] migrations applied`);

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey);
        const tiersResult = await client.query(`SELECT * FROM tier_pricing WHERE active = TRUE AND (stripe_price_id_monthly IS NULL OR stripe_price_id_annual IS NULL)`);
        for (const row of tiersResult.rows) {
          const tier = row.tier as string;
          const productName = `FuelU ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
          let productId: string | undefined;
          const products = await stripe.products.search({ query: `name:'${productName}'` });
          if (products.data.length > 0) {
            productId = products.data[0].id;
          } else {
            const product = await stripe.products.create({ name: productName });
            productId = product.id;
          }
          let monthlyPriceId = row.stripe_price_id_monthly as string | null;
          let annualPriceId = row.stripe_price_id_annual as string | null;
          if (!monthlyPriceId) {
            const price = await stripe.prices.create({
              product: productId,
              unit_amount: row.monthly_price_usd as number,
              currency: "nzd",
              recurring: { interval: "month" },
            });
            monthlyPriceId = price.id;
          }
          if (!annualPriceId) {
            const price = await stripe.prices.create({
              product: productId,
              unit_amount: row.annual_price_usd as number,
              currency: "nzd",
              recurring: { interval: "year" },
            });
            annualPriceId = price.id;
          }
          await client.query(
            `UPDATE tier_pricing SET stripe_price_id_monthly = $1, stripe_price_id_annual = $2 WHERE id = $3`,
            [monthlyPriceId, annualPriceId, row.id]
          );
          console.log(`[migrate] Stripe prices backfilled for tier: ${tier}`);
        }
      } catch (err: any) {
        console.error("[migrate] Stripe price backfill error:", err.message);
      }
    }
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_managed_client BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // Nutritionist portal tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS nutritionist_clients (
        id                SERIAL PRIMARY KEY,
        nutritionist_id   INTEGER NOT NULL REFERENCES users(id),
        client_id         INTEGER NOT NULL REFERENCES users(id),
        status            TEXT NOT NULL DEFAULT 'onboarding',
        goal_summary      TEXT,
        health_notes      TEXT,
        notes             TEXT,
        last_activity_at  TIMESTAMP DEFAULT NOW(),
        created_at        TIMESTAMP DEFAULT NOW(),
        UNIQUE(nutritionist_id, client_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nutritionist_plans (
        id                    SERIAL PRIMARY KEY,
        nutritionist_id       INTEGER NOT NULL REFERENCES users(id),
        client_id             INTEGER NOT NULL REFERENCES users(id),
        name                  TEXT NOT NULL DEFAULT 'Meal Plan',
        plan_type             TEXT NOT NULL DEFAULT 'weekly',
        plan_data             JSONB NOT NULL,
        status                TEXT NOT NULL DEFAULT 'draft',
        prompt_note           TEXT,
        scheduled_deliver_at  TIMESTAMP,
        delivered_at          TIMESTAMP,
        created_at            TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_annotations (
        id          SERIAL PRIMARY KEY,
        plan_id     INTEGER NOT NULL REFERENCES nutritionist_plans(id) ON DELETE CASCADE,
        day         TEXT NOT NULL,
        slot        TEXT,
        note        TEXT NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_templates (
        id                SERIAL PRIMARY KEY,
        nutritionist_id   INTEGER NOT NULL REFERENCES users(id),
        name              TEXT NOT NULL,
        description       TEXT,
        plan_type         TEXT NOT NULL DEFAULT 'weekly',
        plan_data         JSONB NOT NULL,
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nutritionist_messages (
        id                SERIAL PRIMARY KEY,
        nutritionist_id   INTEGER NOT NULL REFERENCES users(id),
        client_id         INTEGER NOT NULL REFERENCES users(id),
        sender_id         INTEGER NOT NULL REFERENCES users(id),
        body              TEXT NOT NULL,
        is_read           BOOLEAN NOT NULL DEFAULT false,
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nutritionist_messages_thread
        ON nutritionist_messages (nutritionist_id, client_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nutritionist_messages_unread
        ON nutritionist_messages (nutritionist_id, client_id, is_read)
        WHERE is_read = false
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS client_target_overrides (
        id                SERIAL PRIMARY KEY,
        nutritionist_id   INTEGER NOT NULL REFERENCES users(id),
        client_id         INTEGER NOT NULL REFERENCES users(id) UNIQUE,
        daily_calories    INTEGER,
        protein_goal      INTEGER,
        carbs_goal        INTEGER,
        fat_goal          INTEGER,
        fibre_goal        INTEGER,
        rationale         TEXT,
        created_at        TIMESTAMP DEFAULT NOW(),
        updated_at        TIMESTAMP DEFAULT NOW()
      )
    `);

    // Adaptive TDEE suggestions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS adaptive_tdee_suggestions (
        id                  SERIAL PRIMARY KEY,
        user_id             INTEGER NOT NULL REFERENCES users(id),
        suggested_calories  INTEGER NOT NULL,
        current_calories    INTEGER NOT NULL,
        delta               INTEGER NOT NULL,
        explanation         TEXT NOT NULL,
        confidence          TEXT NOT NULL DEFAULT 'medium',
        status              TEXT NOT NULL DEFAULT 'pending',
        created_at          TIMESTAMP DEFAULT NOW(),
        acted_at            TIMESTAMP
      )
    `);
    await client.query(`ALTER TABLE adaptive_tdee_suggestions ADD COLUMN IF NOT EXISTS formula_tdee INTEGER`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_adaptive_tdee_suggestions_user ON adaptive_tdee_suggestions (user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_adaptive_tdee_suggestions_status ON adaptive_tdee_suggestions (user_id, status) WHERE status = 'pending'`);

    // canonical_foods — columns added by Task #261 (restaurant/HelloFresh database)
    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS sugar_100g REAL`);
    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS saturated_fat_100g REAL`);
    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS brand TEXT`);
    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS category TEXT`);
    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS image_url TEXT`);
    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS source_url TEXT`);
    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS cook_time TEXT`);
    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS ingredients_list JSONB`);

    // Seed NZ/AU restaurant foods (153 items) — runs once; skipped if already present
    const restaurantCount = await client.query(`SELECT COUNT(*) FROM canonical_foods WHERE source = 'restaurant_nz'`);
    if (parseInt(restaurantCount.rows[0].count, 10) === 0) {
      const seedPath = join(process.cwd(), "server", "seeds", "restaurant-foods.json");
      const restaurantFoods: Array<Record<string, any>> = JSON.parse(readFileSync(seedPath, "utf8"));
      for (const f of restaurantFoods) {
        await client.query(
          `INSERT INTO canonical_foods
             (name, canonical_name, calories_100g, protein_100g, carbs_100g, fat_100g,
              fibre_100g, sodium_100g, sugar_100g, saturated_fat_100g,
              serving_grams, brand, category, image_url, source_url, cook_time,
              ingredients_list, source, region)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'restaurant_nz','NZ')
           ON CONFLICT DO NOTHING`,
          [
            f.name,
            f.name.toLowerCase().trim(),
            f.calories100g,
            f.protein100g,
            f.carbs100g,
            f.fat100g,
            f.fibre100g ?? null,
            f.sodium100g ?? null,
            f.sugar100g ?? null,
            f.saturatedFat100g ?? null,
            f.servingGrams ?? 100,
            f.brand ?? null,
            f.category ?? null,
            f.imageUrl ?? null,
            f.sourceUrl ?? null,
            f.cookTime ?? null,
            f.ingredientsList ? JSON.stringify(f.ingredientsList) : null,
          ],
        );
      }
      console.log(`[migrate] Seeded ${restaurantFoods.length} restaurant foods`);
    }

    const TEST_EMAIL = "test@fuelr.app";
    const TEST_PASSWORD = "TestPass123!";
    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, [TEST_EMAIL]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(TEST_PASSWORD, 12);
      await client.query(
        `INSERT INTO users (email, name, password_hash, tier, beta_user, trial_status)
         VALUES ($1, $2, $3, 'advanced', true, 'none')
         ON CONFLICT (email) DO NOTHING`,
        [TEST_EMAIL, "Test User", hash],
      );
      console.log("[migrate] Seeded test account: test@fuelr.app");
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS meal_comments (
        id                SERIAL PRIMARY KEY,
        community_meal_id INTEGER NOT NULL REFERENCES community_meals(id),
        user_id           INTEGER NOT NULL REFERENCES users(id),
        text              TEXT NOT NULL,
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_meal_comments_community_meal_id ON meal_comments(community_meal_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_meal_comments_user_id ON meal_comments(user_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS strava_connections (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id) UNIQUE,
        athlete_id      TEXT NOT NULL,
        access_token    TEXT NOT NULL,
        refresh_token   TEXT NOT NULL,
        token_expires_at TIMESTAMP NOT NULL,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
          ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
        END IF;
      END $$
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username))`);

    await client.query(`ALTER TABLE canonical_foods ADD COLUMN IF NOT EXISTS source_quality INTEGER NOT NULL DEFAULT 40`);
    await client.query(`
      UPDATE canonical_foods SET source_quality = CASE
        WHEN source IN ('usda_cached', 'nzfcd', 'ausnut', 'fsanz') THEN 100
        WHEN source IN ('barcode_scan', 'openfoodfacts', 'open_food_facts') THEN 80
        WHEN source IN ('nz_regional', 'au_regional', 'restaurant_nz') THEN 70
        WHEN source = 'user_manual' THEN 60
        WHEN source = 'ingredient_parsed' THEN 40
        WHEN source = 'ai_generated' THEN 20
        ELSE 40
      END
      WHERE source_quality = 40 AND source NOT IN ('ingredient_parsed')
    `);

  } finally {
    client.release();
  }
}
