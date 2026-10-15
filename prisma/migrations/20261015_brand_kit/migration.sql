-- PROMPT-252: Brand Kit (one row per user)
-- Run: psql $DATABASE_URL -f this_file.sql
-- The UNIQUE constraint on "userId" already creates the lookup index.

CREATE TABLE IF NOT EXISTS "BrandKit" (
  "id"                TEXT             PRIMARY KEY,
  "userId"            TEXT             NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,

  "businessName"      TEXT,
  "logoUrl"           TEXT,
  "instagramHandle"   TEXT,

  "colorPrimary"      TEXT,
  "colorSecondary"    TEXT,
  "colorText"         TEXT,

  "fontPreset"        TEXT             NOT NULL DEFAULT 'modern',
  "subtitlePreset"    TEXT             NOT NULL DEFAULT 'clean',

  "ctaText"           TEXT,

  "watermarkEnabled"  BOOLEAN          NOT NULL DEFAULT true,
  "watermarkPosition" TEXT             NOT NULL DEFAULT 'bottom-right',
  "watermarkOpacity"  DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  "watermarkScale"    DOUBLE PRECISION NOT NULL DEFAULT 0.10,

  "enabled"           BOOLEAN          NOT NULL DEFAULT true,

  "createdAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
