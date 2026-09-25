-- PROMPT-159: Billing Accuracy & Credit Atomicity
-- Run: psql $DATABASE_URL -f this_file.sql

-- Stripe event deduplication table
CREATE TABLE IF NOT EXISTS "StripeEvent" (
  "eventId"     TEXT      PRIMARY KEY,
  "type"        TEXT      NOT NULL,
  "processedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Atomic first-free-video claim flag
ALTER TABLE "StudioCredits"
  ADD COLUMN IF NOT EXISTS "freeVideoUsed" BOOLEAN NOT NULL DEFAULT false;
