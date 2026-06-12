-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column
ALTER TABLE "StudioFeedback" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Add category column
ALTER TABLE "StudioFeedback" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- Create HNSW index for fast similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS "StudioFeedback_embedding_idx"
ON "StudioFeedback"
USING hnsw ("embedding" vector_cosine_ops);
