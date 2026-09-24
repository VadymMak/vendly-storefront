import { db } from '@/lib/db';

interface SearchResult {
  id: string;
  documentId: string;
  heading: string;
  content: string;
  slug: string;
  title: string;
  score: number;
  vectorRank: number;
  ftsRank: number;
}

export async function hybridSearch(
  queryEmbedding: number[],
  queryText: string,
  topK: number = 5,
  rrf_k: number = 60,
): Promise<SearchResult[]> {
  const sanitized = queryText
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1)
    .join(' & ');

  if (!sanitized) {
    return vectorSearch(queryEmbedding, topK);
  }

  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const results = await db.$queryRaw<SearchResult[]>`
    WITH vector_results AS (
      SELECT
        c.id,
        c."documentId",
        c.heading,
        c.content,
        d.slug,
        d.title,
        ROW_NUMBER() OVER (ORDER BY c.embedding <=> ${embeddingStr}::vector) AS rank
      FROM "KbChunk" c
      JOIN "KbDocument" d ON d.id = c."documentId"
      ORDER BY c.embedding <=> ${embeddingStr}::vector
      LIMIT 20
    ),
    fts_results AS (
      SELECT
        c.id,
        c."documentId",
        c.heading,
        c.content,
        d.slug,
        d.title,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.tsv, to_tsquery('english', ${sanitized})) DESC) AS rank
      FROM "KbChunk" c
      JOIN "KbDocument" d ON d.id = c."documentId"
      WHERE c.tsv @@ to_tsquery('english', ${sanitized})
      LIMIT 20
    )
    SELECT
      COALESCE(v.id, f.id) AS id,
      COALESCE(v."documentId", f."documentId") AS "documentId",
      COALESCE(v.heading, f.heading) AS heading,
      COALESCE(v.content, f.content) AS content,
      COALESCE(v.slug, f.slug) AS slug,
      COALESCE(v.title, f.title) AS title,
      (
        COALESCE(1.0 / (${rrf_k} + v.rank), 0) +
        COALESCE(1.0 / (${rrf_k} + f.rank), 0)
      ) AS score,
      COALESCE(v.rank, 999) AS "vectorRank",
      COALESCE(f.rank, 999) AS "ftsRank"
    FROM vector_results v
    FULL OUTER JOIN fts_results f ON v.id = f.id
    ORDER BY score DESC
    LIMIT ${topK};
  `;

  return results;
}

async function vectorSearch(
  queryEmbedding: number[],
  topK: number,
): Promise<SearchResult[]> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  return db.$queryRaw<SearchResult[]>`
    SELECT
      c.id,
      c."documentId",
      c.heading,
      c.content,
      d.slug,
      d.title,
      (1 - (c.embedding <=> ${embeddingStr}::vector)) AS score,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> ${embeddingStr}::vector) AS "vectorRank",
      999 AS "ftsRank"
    FROM "KbChunk" c
    JOIN "KbDocument" d ON d.id = c."documentId"
    ORDER BY c.embedding <=> ${embeddingStr}::vector
    LIMIT ${topK};
  `;
}
