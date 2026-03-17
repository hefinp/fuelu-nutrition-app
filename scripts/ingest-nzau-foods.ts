/**
 * NZ/AU Food Database Ingestion Script
 *
 * Ingests nutritional data from:
 *   - New Zealand Food Composition Database (NZFCD) by Plant & Food Research
 *   - Food Standards Australia New Zealand (FSANZ)
 *
 * Usage:
 *   npx tsx scripts/ingest-nzau-foods.ts [--dry-run] [--source nzfcd|fsanz|both]
 *
 * The script reads CSV files placed in scripts/data/:
 *   - scripts/data/nzfcd.csv    (NZFCD export)
 *   - scripts/data/fsanz.csv    (FSANZ export)
 *
 * If no CSV files are present, it falls back to a curated built-in dataset of
 * well-known NZ and AU products so the feature works immediately out-of-the-box.
 *
 * CSV column expectations (NZFCD):
 *   Name, Energy (kJ), Protein (g), Fat (g), Carbohydrate (g), Dietary Fibre (g), Sodium (mg)
 *
 * CSV column expectations (FSANZ / AUSNUT 2011-13):
 *   Food Name, Energy, Protein, Total Fat, Total Carbs, Dietary Fibre, Sodium
 *
 * Run with --dry-run to preview changes without writing to the database.
 */

import { pool } from "../server/db";
import type { PoolClient } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FoodRecord {
  name: string;
  calories100g: number;
  protein100g: number;
  fat100g: number;
  carbs100g: number;
  fibre100g: number | null;
  sodium100g: number | null;
  source: "nzfcd" | "fsanz" | "nz_regional" | "au_regional";
  region: "nz" | "au";
}

/**
 * Built-in curated datasets are used when government CSV files are not present.
 * These entries use source="nz_regional"/"au_regional" to indicate they are
 * regionally-scoped curated data — NOT official government-verified data.
 * Official "NZ Verified" / "AU Verified" badges are only shown for rows with
 * source="nzfcd" or source="fsanz" (populated from actual government CSV exports).
 */
const BUILT_IN_NZFCD: FoodRecord[] = [
  { name: "Weet-Bix", calories100g: 349, protein100g: 11.3, fat100g: 1.5, carbs100g: 68.0, fibre100g: 10.4, sodium100g: 270, source: "nz_regional", region: "nz" },
  { name: "Weet-Bix Lite", calories100g: 342, protein100g: 11.4, fat100g: 0.8, carbs100g: 68.5, fibre100g: 10.4, sodium100g: 200, source: "nz_regional", region: "nz" },
  { name: "Vogel's Original Mixed Grain Bread", calories100g: 240, protein100g: 9.5, fat100g: 3.7, carbs100g: 39.2, fibre100g: 6.1, sodium100g: 390, source: "nz_regional", region: "nz" },
  { name: "Vogel's Soy & Linseed Bread", calories100g: 243, protein100g: 9.8, fat100g: 4.2, carbs100g: 38.5, fibre100g: 6.8, sodium100g: 370, source: "nz_regional", region: "nz" },
  { name: "Marmite (NZ)", calories100g: 270, protein100g: 37.0, fat100g: 0.5, carbs100g: 21.0, fibre100g: 4.7, sodium100g: 3400, source: "nz_regional", region: "nz" },
  { name: "Sanitarium Peanut Butter (no added salt)", calories100g: 608, protein100g: 25.3, fat100g: 51.8, carbs100g: 12.0, fibre100g: 7.0, sodium100g: 8, source: "nz_regional", region: "nz" },
  { name: "Anchor Full Fat Milk", calories100g: 63, protein100g: 3.3, fat100g: 3.5, carbs100g: 4.7, fibre100g: 0, sodium100g: 44, source: "nz_regional", region: "nz" },
  { name: "Anchor Trim Milk", calories100g: 39, protein100g: 3.7, fat100g: 0.2, carbs100g: 4.8, fibre100g: 0, sodium100g: 46, source: "nz_regional", region: "nz" },
  { name: "Mainland Tasty Cheese", calories100g: 406, protein100g: 24.5, fat100g: 33.0, carbs100g: 0.5, fibre100g: 0, sodium100g: 620, source: "nz_regional", region: "nz" },
  { name: "Countdown White Rice (cooked)", calories100g: 130, protein100g: 2.7, fat100g: 0.3, carbs100g: 28.2, fibre100g: 0.4, sodium100g: 1, source: "nz_regional", region: "nz" },
  { name: "Kumara (gold, baked)", calories100g: 105, protein100g: 1.8, fat100g: 0.1, carbs100g: 24.5, fibre100g: 3.0, sodium100g: 21, source: "nz_regional", region: "nz" },
  { name: "Kumara (orange, raw)", calories100g: 78, protein100g: 1.6, fat100g: 0.1, carbs100g: 18.0, fibre100g: 2.5, sodium100g: 18, source: "nz_regional", region: "nz" },
  { name: "Tarakihi (grilled)", calories100g: 120, protein100g: 24.5, fat100g: 2.0, carbs100g: 0, fibre100g: 0, sodium100g: 85, source: "nz_regional", region: "nz" },
  { name: "Hoki (baked)", calories100g: 105, protein100g: 22.5, fat100g: 1.5, carbs100g: 0, fibre100g: 0, sodium100g: 78, source: "nz_regional", region: "nz" },
  { name: "Green-lipped Mussels (steamed)", calories100g: 92, protein100g: 14.0, fat100g: 2.5, carbs100g: 3.5, fibre100g: 0, sodium100g: 290, source: "nz_regional", region: "nz" },
  { name: "Sanitarium Up&Go Liquid Breakfast Original", calories100g: 76, protein100g: 4.1, fat100g: 1.3, carbs100g: 11.5, fibre100g: 1.5, sodium100g: 105, source: "nz_regional", region: "nz" },
  { name: "ETA Original Chips", calories100g: 536, protein100g: 6.8, fat100g: 33.0, carbs100g: 53.0, fibre100g: 3.0, sodium100g: 500, source: "nz_regional", region: "nz" },
  { name: "Griffin's Malt Biscuits", calories100g: 432, protein100g: 7.2, fat100g: 14.8, carbs100g: 66.5, fibre100g: 2.5, sodium100g: 380, source: "nz_regional", region: "nz" },
  { name: "Tip Top Sandwich White Bread", calories100g: 257, protein100g: 8.2, fat100g: 2.8, carbs100g: 49.5, fibre100g: 2.1, sodium100g: 430, source: "nz_regional", region: "nz" },
  { name: "Lewis Road Creamery Full Cream Milk", calories100g: 65, protein100g: 3.5, fat100g: 3.8, carbs100g: 4.6, fibre100g: 0, sodium100g: 43, source: "nz_regional", region: "nz" },
];

const BUILT_IN_FSANZ: FoodRecord[] = [
  { name: "Weet-Bix (AU)", calories100g: 349, protein100g: 11.3, fat100g: 1.5, carbs100g: 68.0, fibre100g: 10.4, sodium100g: 270, source: "au_regional", region: "au" },
  { name: "Vita Brits", calories100g: 352, protein100g: 11.0, fat100g: 1.8, carbs100g: 68.5, fibre100g: 9.5, sodium100g: 230, source: "au_regional", region: "au" },
  { name: "Vegemite", calories100g: 291, protein100g: 25.2, fat100g: 0.4, carbs100g: 26.4, fibre100g: 2.5, sodium100g: 3550, source: "au_regional", region: "au" },
  { name: "Tim Tams Original", calories100g: 497, protein100g: 5.6, fat100g: 24.8, carbs100g: 63.0, fibre100g: 1.5, sodium100g: 170, source: "au_regional", region: "au" },
  { name: "Arnott's Shapes BBQ", calories100g: 490, protein100g: 7.5, fat100g: 22.0, carbs100g: 64.0, fibre100g: 2.5, sodium100g: 720, source: "au_regional", region: "au" },
  { name: "Weetabix (AU brand)", calories100g: 345, protein100g: 11.1, fat100g: 1.6, carbs100g: 67.2, fibre100g: 10.0, sodium100g: 260, source: "au_regional", region: "au" },
  { name: "Freedom Foods Rice Flakes", calories100g: 383, protein100g: 7.6, fat100g: 1.6, carbs100g: 83.4, fibre100g: 1.6, sodium100g: 20, source: "au_regional", region: "au" },
  { name: "Pauls Full Cream Milk", calories100g: 64, protein100g: 3.3, fat100g: 3.7, carbs100g: 4.7, fibre100g: 0, sodium100g: 44, source: "au_regional", region: "au" },
  { name: "Devondale Tasty Cheese Slices", calories100g: 382, protein100g: 22.6, fat100g: 31.0, carbs100g: 1.0, fibre100g: 0, sodium100g: 790, source: "au_regional", region: "au" },
  { name: "Sanitarium Peanut Butter Smooth (AU)", calories100g: 612, protein100g: 25.0, fat100g: 52.2, carbs100g: 12.5, fibre100g: 6.5, sodium100g: 290, source: "au_regional", region: "au" },
  { name: "Bundaberg Sugar Raw", calories100g: 400, protein100g: 0, fat100g: 0, carbs100g: 99.9, fibre100g: 0, sodium100g: 0, source: "au_regional", region: "au" },
  { name: "Golden Circle Pineapple Pieces in juice", calories100g: 54, protein100g: 0.5, fat100g: 0.1, carbs100g: 12.5, fibre100g: 0.8, sodium100g: 3, source: "au_regional", region: "au" },
  { name: "Byron Bay Cookie Company Macadamia & White Choc", calories100g: 485, protein100g: 5.8, fat100g: 24.0, carbs100g: 62.5, fibre100g: 1.8, sodium100g: 220, source: "au_regional", region: "au" },
  { name: "Coon Tasty Cheese", calories100g: 404, protein100g: 24.8, fat100g: 33.5, carbs100g: 0.4, fibre100g: 0, sodium100g: 600, source: "au_regional", region: "au" },
  { name: "Peters Original Vanilla Ice Cream", calories100g: 200, protein100g: 3.2, fat100g: 10.5, carbs100g: 24.5, fibre100g: 0, sodium100g: 80, source: "au_regional", region: "au" },
];

function kJToKcal(kj: number): number {
  return Math.round(kj / 4.184);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function readCsv(filePath: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const lines: string[][] = [];
    const rl = readline.createInterface({ input: fs.createReadStream(filePath) });
    rl.on("line", line => { if (line.trim()) lines.push(parseCsvLine(line)); });
    rl.on("close", () => resolve(lines));
    rl.on("error", reject);
  });
}

function parseNzfcdCsv(rows: string[][]): FoodRecord[] {
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.toLowerCase());
  const nameIdx = header.findIndex(h => h.includes("name") || h.includes("food"));
  const energyIdx = header.findIndex(h => h.includes("energy") || h.includes("kj") || h.includes("kcal"));
  const proteinIdx = header.findIndex(h => h.includes("protein"));
  const fatIdx = header.findIndex(h => h.includes("fat") && !h.includes("saturated") && !h.includes("trans"));
  const carbsIdx = header.findIndex(h => h.includes("carbohydrate") || h.includes("carbs"));
  const fibreIdx = header.findIndex(h => h.includes("fibre") || h.includes("fiber"));
  const sodiumIdx = header.findIndex(h => h.includes("sodium") || h.includes("na "));

  if (nameIdx === -1 || energyIdx === -1) {
    console.warn("NZFCD CSV: could not find required columns (Name, Energy)");
    return [];
  }

  const records: FoodRecord[] = [];
  const isKj = header[energyIdx].includes("kj");

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[nameIdx]?.trim();
    if (!name) continue;
    const rawEnergy = parseFloat(row[energyIdx] ?? "0") || 0;
    const calories100g = isKj ? kJToKcal(rawEnergy) : Math.round(rawEnergy);
    if (calories100g <= 0) continue;

    records.push({
      name,
      calories100g,
      protein100g: parseFloat(row[proteinIdx] ?? "0") || 0,
      fat100g: parseFloat(row[fatIdx] ?? "0") || 0,
      carbs100g: parseFloat(row[carbsIdx] ?? "0") || 0,
      fibre100g: fibreIdx >= 0 ? (parseFloat(row[fibreIdx] ?? "") || null) : null,
      sodium100g: sodiumIdx >= 0 ? (parseFloat(row[sodiumIdx] ?? "") || null) : null,
      source: "nzfcd",
      region: "nz",
    });
  }
  return records;
}

function parseFsanzCsv(rows: string[][]): FoodRecord[] {
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.toLowerCase());
  const nameIdx = header.findIndex(h => h.includes("name") || h.includes("food"));
  const energyIdx = header.findIndex(h => h.includes("energy") || h.includes("kj") || h.includes("kcal"));
  const proteinIdx = header.findIndex(h => h.includes("protein"));
  const fatIdx = header.findIndex(h => (h.includes("fat") || h.includes("total fat")) && !h.includes("saturated") && !h.includes("trans"));
  const carbsIdx = header.findIndex(h => h.includes("carb") || h.includes("carbohydrate"));
  const fibreIdx = header.findIndex(h => h.includes("fibre") || h.includes("fiber") || h.includes("dietary"));
  const sodiumIdx = header.findIndex(h => h.includes("sodium") || h.includes("na "));

  if (nameIdx === -1 || energyIdx === -1) {
    console.warn("FSANZ CSV: could not find required columns (Name, Energy)");
    return [];
  }

  const records: FoodRecord[] = [];
  const isKj = header[energyIdx].includes("kj");

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[nameIdx]?.trim();
    if (!name) continue;
    const rawEnergy = parseFloat(row[energyIdx] ?? "0") || 0;
    const calories100g = isKj ? kJToKcal(rawEnergy) : Math.round(rawEnergy);
    if (calories100g <= 0) continue;

    records.push({
      name,
      calories100g,
      protein100g: parseFloat(row[proteinIdx] ?? "0") || 0,
      fat100g: parseFloat(row[fatIdx] ?? "0") || 0,
      carbs100g: parseFloat(row[carbsIdx] ?? "0") || 0,
      fibre100g: fibreIdx >= 0 ? (parseFloat(row[fibreIdx] ?? "") || null) : null,
      sodium100g: sodiumIdx >= 0 ? (parseFloat(row[sodiumIdx] ?? "") || null) : null,
      source: "fsanz",
      region: "au",
    });
  }
  return records;
}

async function upsertFood(client: PoolClient, food: FoodRecord, dryRun: boolean): Promise<"inserted" | "updated" | "skipped"> {
  const canonicalName = food.name.toLowerCase().replace(/\s+/g, " ").trim();

  // Look for an existing row with the same source+region (the authoritative gov key)
  const exactMatch = await client.query(
    `SELECT id FROM canonical_foods WHERE canonical_name = $1 AND source = $2 AND region = $3 LIMIT 1`,
    [canonicalName, food.source, food.region],
  );

  if (exactMatch.rowCount && exactMatch.rowCount > 0) {
    // Row from the same government source already exists — update nutritional values
    if (!dryRun) {
      await client.query(
        `UPDATE canonical_foods SET
          name = $1, calories_100g = $2, protein_100g = $3, carbs_100g = $4, fat_100g = $5,
          fibre_100g = $6, sodium_100g = $7, verified_at = NOW()
        WHERE id = $8`,
        [food.name, food.calories100g, food.protein100g, food.carbs100g, food.fat100g,
         food.fibre100g, food.sodium100g, exactMatch.rows[0].id],
      );
    }
    return "updated";
  }

  // No matching gov-source row exists — insert a new one.
  // Government data is always inserted regardless of any existing non-gov rows,
  // so NZ/AU foods are always present alongside global equivalents.
  if (!dryRun) {
    await client.query(
      `INSERT INTO canonical_foods
        (name, canonical_name, calories_100g, protein_100g, carbs_100g, fat_100g,
         fibre_100g, sodium_100g, serving_grams, source, region, verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,100,$9,$10,NOW())`,
      [
        food.name, canonicalName, food.calories100g, food.protein100g, food.carbs100g,
        food.fat100g, food.fibre100g, food.sodium100g, food.source, food.region,
      ],
    );
  }
  return "inserted";
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const sourceArg = args.find(a => a.startsWith("--source="))?.split("=")[1]
    ?? (args.includes("--source") ? args[args.indexOf("--source") + 1] : "both");

  console.log(`\n=== NZ/AU Food Database Ingestion ===`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes written)" : "LIVE"}`);
  console.log(`Source: ${sourceArg}\n`);

  const dataDir = path.join(__dirname, "data");
  const nzfcdPath = path.join(dataDir, "nzfcd.csv");
  const fsanzPath = path.join(dataDir, "fsanz.csv");

  let nzfcdRecords: FoodRecord[] = [];
  let fsanzRecords: FoodRecord[] = [];

  if (sourceArg === "nzfcd" || sourceArg === "both") {
    if (fs.existsSync(nzfcdPath)) {
      console.log(`Reading NZFCD from: ${nzfcdPath}`);
      const rows = await readCsv(nzfcdPath);
      nzfcdRecords = parseNzfcdCsv(rows);
      console.log(`  Parsed ${nzfcdRecords.length} NZFCD records from CSV`);
    } else {
      console.log(`No nzfcd.csv found at ${nzfcdPath} — using built-in dataset (${BUILT_IN_NZFCD.length} records)`);
      nzfcdRecords = BUILT_IN_NZFCD;
    }
  }

  if (sourceArg === "fsanz" || sourceArg === "both") {
    if (fs.existsSync(fsanzPath)) {
      console.log(`Reading FSANZ from: ${fsanzPath}`);
      const rows = await readCsv(fsanzPath);
      fsanzRecords = parseFsanzCsv(rows);
      console.log(`  Parsed ${fsanzRecords.length} FSANZ records from CSV`);
    } else {
      console.log(`No fsanz.csv found at ${fsanzPath} — using built-in dataset (${BUILT_IN_FSANZ.length} records)`);
      fsanzRecords = BUILT_IN_FSANZ;
    }
  }

  const allRecords = [...nzfcdRecords, ...fsanzRecords];
  console.log(`\nTotal records to process: ${allRecords.length}`);

  if (allRecords.length === 0) {
    console.log("Nothing to ingest.");
    process.exit(0);
  }

  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  try {
    for (const record of allRecords) {
      try {
        const outcome = await upsertFood(client, record, dryRun);
        if (outcome === "inserted") inserted++;
        else if (outcome === "updated") updated++;
        else skipped++;
      } catch (err) {
        errors++;
        console.error(`  ERROR processing "${record.name}": ${err instanceof Error ? err.message : err}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  if (dryRun) console.log(`\n[DRY RUN] No changes were written to the database.`);
  else console.log(`\nDone.`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
