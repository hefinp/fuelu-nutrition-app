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

    console.log(`${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })} [migrate] migrations applied`);
  } finally {
    client.release();
  }
}
