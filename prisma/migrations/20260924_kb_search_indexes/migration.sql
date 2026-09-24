-- KB hybrid search (src/lib/kb/search.ts). Prisma can't express a generated
-- tsvector or an HNSW index, so re-run this after any `prisma db push`.

-- Full-text column, generated from heading + content
ALTER TABLE "KbChunk" ADD COLUMN IF NOT EXISTS "tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("heading", '') || ' ' || coalesce("content", ''))) STORED;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS "KbChunk_tsv_idx" ON "KbChunk" USING gin ("tsv");

-- HNSW index for fast similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS "KbChunk_embedding_idx"
ON "KbChunk"
USING hnsw ("embedding" vector_cosine_ops);
