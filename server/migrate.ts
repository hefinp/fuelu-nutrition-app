import { pool } from "./db";

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
        ('priority_support', 'advanced', 0, 'Priority support access')
      ON CONFLICT (feature_key) DO NOTHING
    `);

    console.log(`${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })} [migrate] migrations applied`);
  } finally {
    client.release();
  }
}
