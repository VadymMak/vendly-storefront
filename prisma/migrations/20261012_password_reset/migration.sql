-- PROMPT-237: password reset tokens (hashed) + session invalidation on password change
-- Run: psql $DATABASE_URL -f this_file.sql

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id"            TEXT         PRIMARY KEY,
  "userId"        TEXT         NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tokenHash"     TEXT         NOT NULL,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "usedAt"        TIMESTAMP(3),
  "requestIpHash" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key"
  ON "PasswordResetToken" ("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_createdAt_idx"
  ON "PasswordResetToken" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_requestIpHash_createdAt_idx"
  ON "PasswordResetToken" ("requestIpHash", "createdAt");
