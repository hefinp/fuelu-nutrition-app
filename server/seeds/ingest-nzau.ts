import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { db } from "../db";
import { canonicalFoods } from "../../shared/schema";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CsvRow {
  name: string;
  calories_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fibre_100g: number;
  sodium_100g: number;
  serving_grams: number;
  region: string;
  source: string;
}

function parseCsv(filePath: string): CsvRow[] {
  const content = readFileSync(filePath, "utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: false,
  }) as Record<string, string>[];

  return records
    .filter((row) => row.name && row.name.trim().length > 0)
    .map((row) => ({
      name: row.name.trim(),
      calories_100g: parseFloat(row.calories_100g) || 0,
      protein_100g: parseFloat(row.protein_100g) || 0,
      carbs_100g: parseFloat(row.carbs_100g) || 0,
      fat_100g: parseFloat(row.fat_100g) || 0,
      fibre_100g: parseFloat(row.fibre_100g) || 0,
      sodium_100g: parseFloat(row.sodium_100g) || 0,
      serving_grams: parseInt(row.serving_grams, 10) || 100,
      region: row.region?.trim() ?? "",
      source: row.source?.trim() ?? "",
    }));
}

function toCanonicalName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

async function ingestDataset(
  rows: CsvRow[],
  datasetLabel: string
): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date();

  for (const row of rows) {
    if (!row.name) {
      skipped++;
      continue;
    }

    const canonicalName = toCanonicalName(row.name);

    const existing = await db
      .select()
      .from(canonicalFoods)
      .where(eq(canonicalFoods.canonicalName, canonicalName))
      .limit(1);

    if (existing.length > 0) {
      const record = existing[0];
      const isOwnSource = record.source === "nzfcd" || record.source === "fsanz";

      if (!isOwnSource) {
        skipped++;
        continue;
      }

      const needsUpdate =
        record.calories100g !== row.calories_100g ||
        record.protein100g !== row.protein_100g ||
        record.carbs100g !== row.carbs_100g ||
        record.fat100g !== row.fat_100g ||
        record.region !== row.region ||
        record.source !== row.source ||
        record.verifiedAt == null;

      if (needsUpdate) {
        await db
          .update(canonicalFoods)
          .set({
            calories100g: row.calories_100g,
            protein100g: row.protein_100g,
            carbs100g: row.carbs_100g,
            fat100g: row.fat_100g,
            fibre100g: row.fibre_100g,
            sodium100g: row.sodium_100g > 0 ? row.sodium_100g : null,
            servingGrams: row.serving_grams,
            region: row.region,
            source: row.source,
            verifiedAt: now,
          })
          .where(eq(canonicalFoods.canonicalName, canonicalName));
        updated++;
      } else {
        skipped++;
      }
    } else {
      await db.insert(canonicalFoods).values({
        name: row.name,
        canonicalName,
        calories100g: row.calories_100g,
        protein100g: row.protein_100g,
        carbs100g: row.carbs_100g,
        fat100g: row.fat_100g,
        fibre100g: row.fibre_100g,
        sodium100g: row.sodium_100g > 0 ? row.sodium_100g : null,
        servingGrams: row.serving_grams,
        region: row.region,
        source: row.source,
        verifiedAt: now,
      });
      inserted++;
    }
  }

  return { inserted, updated, skipped };
}

async function main() {
  console.log("Starting NZ/AU food database ingestion...\n");

  const seedsDir = join(__dirname);

  console.log("Processing NZFCD dataset (New Zealand Food Composition Database)...");
  const nzfcdRows = parseCsv(join(seedsDir, "nzfcd.csv"));
  console.log(`  Parsed ${nzfcdRows.length} records from nzfcd.csv`);
  const nzfcdResult = await ingestDataset(nzfcdRows, "NZFCD");
  console.log(
    `  NZFCD: ${nzfcdResult.inserted} inserted, ${nzfcdResult.updated} updated, ${nzfcdResult.skipped} skipped`
  );

  console.log("\nProcessing FSANZ AUSNUT dataset (Food Standards Australia New Zealand)...");
  const ausnutRows = parseCsv(join(seedsDir, "ausnut.csv"));
  console.log(`  Parsed ${ausnutRows.length} records from ausnut.csv`);
  const ausnutResult = await ingestDataset(ausnutRows, "AUSNUT");
  console.log(
    `  AUSNUT: ${ausnutResult.inserted} inserted, ${ausnutResult.updated} updated, ${ausnutResult.skipped} skipped`
  );

  const totalInserted = nzfcdResult.inserted + ausnutResult.inserted;
  const totalUpdated = nzfcdResult.updated + ausnutResult.updated;
  const totalSkipped = nzfcdResult.skipped + ausnutResult.skipped;

  console.log("\n=== Ingestion Summary ===");
  console.log(`Total: ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped`);
  console.log(`Grand total processed: ${totalInserted + totalUpdated + totalSkipped} records`);
  console.log("\nIngestion complete.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
