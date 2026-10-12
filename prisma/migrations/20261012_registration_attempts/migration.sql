-- PROMPT-236: per-IP sign-up limit (hashed IPs, 30-day retention)
-- Run: psql $DATABASE_URL -f this_file.sql

CREATE TABLE IF NOT EXISTS "RegistrationAttempt" (
  "id"        TEXT         PRIMARY KEY,
  "ipHash"    TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "RegistrationAttempt_ipHash_createdAt_idx"
  ON "RegistrationAttempt" ("ipHash", "createdAt");

CREATE INDEX IF NOT EXISTS "RegistrationAttempt_createdAt_idx"
  ON "RegistrationAttempt" ("createdAt");
