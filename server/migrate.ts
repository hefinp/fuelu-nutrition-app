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

    console.log(`${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })} [migrate] migrations applied`);
  } finally {
    client.release();
  }
}
