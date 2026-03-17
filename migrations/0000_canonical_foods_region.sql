-- Add region column to canonical_foods to support NZ/AU ingestion script
ALTER TABLE "canonical_foods" ADD COLUMN IF NOT EXISTS "region" text;
CREATE INDEX IF NOT EXISTS "idx_canonical_foods_region" ON "canonical_foods" ("region") WHERE "region" IS NOT NULL;
