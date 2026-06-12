import { db } from '@/lib/db';
import type { FeedbackExample, ModelStat, LearningContext } from './types';

const ACTIVATION_THRESHOLD = 50;
const GOOD_EXAMPLES_LIMIT = 3;
const BAD_EXAMPLES_LIMIT = 2;

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[learning] No OPENAI_API_KEY — embedding generation skipped');
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    });

    if (!res.ok) {
      console.error('[learning] OpenAI embedding error:', res.status);
      return null;
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0]?.embedding ?? null;
  } catch (err) {
    console.error('[learning] Embedding generation failed:', err);
    return null;
  }
}

function detectCategory(prompt: string): string {
  const lower = prompt.toLowerCase();

  const categories: Array<[string, string[]]> = [
    ['food', ['food', 'pizza', 'cake', 'dish', 'meal', 'restaurant', 'cooking', 'appetizing', 'seafood', 'sushi', 'burger', 'dessert', 'salad', 'soup', 'bread', 'coffee', 'tea', 'drink', 'cocktail', 'wine', 'beer', 'fruit', 'vegetable', 'meat', 'cheese', 'pasta', 'rice', 'shrimp', 'mussels', 'gourmet']],
    ['portrait', ['face', 'portrait', 'person', 'woman', 'man', 'girl', 'boy', 'model', 'headshot', 'selfie', 'eyes', 'skin', 'hair', 'smile', 'expression', 'people']],
    ['product', ['product', 'soap', 'candle', 'cosmetic', 'packaging', 'bottle', 'box', 'brand', 'label', 'merchandise', 'goods', 'item', 'store', 'shop', 'ecommerce', 'commercial']],
    ['landscape', ['landscape', 'mountain', 'ocean', 'forest', 'sky', 'sunset', 'sunrise', 'beach', 'lake', 'river', 'nature', 'field', 'valley', 'hill', 'cloud', 'horizon']],
    ['architecture', ['building', 'architecture', 'interior', 'room', 'house', 'apartment', 'office', 'kitchen', 'bathroom', 'living room', 'bedroom', 'window', 'door', 'wall', 'floor', 'ceiling']],
    ['fashion', ['fashion', 'dress', 'clothes', 'outfit', 'style', 'shoes', 'bag', 'handbag', 'jewelry', 'accessory', 'fabric', 'textile', 'hat', 'scarf', 'watch']],
  ];

  for (const [category, keywords] of categories) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  return 'general';
}

export async function saveEmbeddingForFeedback(
  feedbackId: string,
  userPrompt: string,
  enhancedPrompt: string,
): Promise<void> {
  const textForEmbedding = `${userPrompt}\n${enhancedPrompt}`;
  const category = detectCategory(enhancedPrompt || userPrompt);

  const embedding = await generateEmbedding(textForEmbedding);

  if (embedding) {
    const vectorStr = `[${embedding.join(',')}]`;
    await db.$executeRawUnsafe(
      `UPDATE "StudioFeedback" SET "embedding" = $1::vector, "category" = $2 WHERE "id" = $3`,
      vectorStr,
      category,
      feedbackId,
    );
  } else {
    await db.studioFeedback.update({
      where: { id: feedbackId },
      data: { category },
    });
  }
}

async function hybridSearch(
  queryEmbedding: number[],
  tool: string | null,
  rating: 'up' | 'down',
  limit: number,
): Promise<FeedbackExample[]> {
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const conditions: string[] = [`"rating" = '${rating}'`, `"embedding" IS NOT NULL`];
  if (tool) {
    conditions.push(`"tool" = '${tool}'`);
  }
  const whereClause = conditions.join(' AND ');

  const results = await db.$queryRawUnsafe<Array<{
    userPrompt: string;
    enhancedPrompt: string;
    tool: string;
    model: string;
    rating: string;
    issue: string | null;
    similarity: number;
  }>>(
    `SELECT "userPrompt", "enhancedPrompt", "tool", "model", "rating", "issue",
            1 - ("embedding" <=> $1::vector) as similarity
     FROM "StudioFeedback"
     WHERE ${whereClause}
     ORDER BY "embedding" <=> $1::vector
     LIMIT $2`,
    vectorStr,
    limit,
  );

  return results;
}

async function getModelStats(): Promise<ModelStat[]> {
  const stats = await db.$queryRawUnsafe<Array<{
    tool: string;
    model: string;
    up_count: bigint;
    down_count: bigint;
    total: bigint;
    win_rate: number;
  }>>(
    `SELECT
       "tool",
       COALESCE(NULLIF("model", ''), 'default') as "model",
       COUNT(*) FILTER (WHERE "rating" = 'up') as up_count,
       COUNT(*) FILTER (WHERE "rating" = 'down') as down_count,
       COUNT(*) as total,
       ROUND(COUNT(*) FILTER (WHERE "rating" = 'up') * 100.0 / NULLIF(COUNT(*), 0)) as win_rate
     FROM "StudioFeedback"
     GROUP BY "tool", COALESCE(NULLIF("model", ''), 'default')
     HAVING COUNT(*) >= 3
     ORDER BY win_rate DESC`,
  );

  return stats.map(s => ({
    tool: s.tool,
    model: s.model,
    upCount: Number(s.up_count),
    downCount: Number(s.down_count),
    total: Number(s.total),
    winRate: Number(s.win_rate),
  }));
}

export async function buildLearningContext(
  userMessage: string,
  detectedTool: string | null,
): Promise<LearningContext> {
  const totalFeedback = await db.studioFeedback.count();

  if (totalFeedback < ACTIVATION_THRESHOLD) {
    return {
      isActive: false,
      totalFeedback,
      goodExamples: [],
      badExamples: [],
      modelStats: [],
    };
  }

  const queryEmbedding = await generateEmbedding(userMessage);

  if (!queryEmbedding) {
    const recentGood = await db.studioFeedback.findMany({
      where: {
        rating: 'up',
        ...(detectedTool ? { tool: detectedTool } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: GOOD_EXAMPLES_LIMIT,
      select: {
        userPrompt: true,
        enhancedPrompt: true,
        tool: true,
        model: true,
        rating: true,
        issue: true,
      },
    });

    const recentBad = await db.studioFeedback.findMany({
      where: {
        rating: 'down',
        ...(detectedTool ? { tool: detectedTool } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: BAD_EXAMPLES_LIMIT,
      select: {
        userPrompt: true,
        enhancedPrompt: true,
        tool: true,
        model: true,
        rating: true,
        issue: true,
      },
    });

    const modelStats = await getModelStats();

    return {
      isActive: true,
      totalFeedback,
      goodExamples: recentGood.map(e => ({ ...e, similarity: 0 })),
      badExamples: recentBad.map(e => ({ ...e, similarity: 0 })),
      modelStats,
    };
  }

  const [goodExamples, badExamples, modelStats] = await Promise.all([
    hybridSearch(queryEmbedding, detectedTool, 'up', GOOD_EXAMPLES_LIMIT),
    hybridSearch(queryEmbedding, detectedTool, 'down', BAD_EXAMPLES_LIMIT),
    getModelStats(),
  ]);

  return {
    isActive: true,
    totalFeedback,
    goodExamples,
    badExamples,
    modelStats,
  };
}

export function formatLearningContext(ctx: LearningContext): string {
  if (!ctx.isActive) return '';

  const parts: string[] = [];
  parts.push(`\n═══ LEARNING FROM USER FEEDBACK (${ctx.totalFeedback} total ratings) ═══`);

  if (ctx.goodExamples.length > 0) {
    parts.push('\n✅ SUCCESSFUL EXAMPLES — users liked these results. Follow these patterns:');
    for (const ex of ctx.goodExamples) {
      parts.push(`  Tool: ${ex.tool} | Model: ${ex.model || 'default'}`);
      parts.push(`  User asked: "${ex.userPrompt}"`);
      parts.push(`  You generated: "${ex.enhancedPrompt.slice(0, 200)}..."`);
      parts.push('');
    }
  }

  if (ctx.badExamples.length > 0) {
    parts.push('\n❌ FAILED EXAMPLES — users disliked these results. AVOID these patterns:');
    for (const ex of ctx.badExamples) {
      parts.push(`  Tool: ${ex.tool} | Model: ${ex.model || 'default'}`);
      parts.push(`  User asked: "${ex.userPrompt}"`);
      parts.push(`  You generated: "${ex.enhancedPrompt.slice(0, 200)}..."`);
      if (ex.issue) parts.push(`  Issue reported: "${ex.issue}"`);
      parts.push('');
    }
  }

  if (ctx.modelStats.length > 0) {
    parts.push('\n📊 MODEL PERFORMANCE (from real user ratings):');
    for (const stat of ctx.modelStats) {
      const bar = stat.winRate >= 80 ? '🟢' : stat.winRate >= 60 ? '🟡' : '🔴';
      parts.push(`  ${bar} ${stat.tool} → ${stat.model}: ${stat.winRate}% positive (${stat.upCount}👍 ${stat.downCount}👎 of ${stat.total} total)`);
    }
    parts.push('\n  Use the highest win-rate model as default for each tool. Recommend better models to users when relevant.');
  }

  parts.push('\n═══════════════════════════════════════════════════════');
  return parts.join('\n');
}
