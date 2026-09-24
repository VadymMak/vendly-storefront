import { db } from '@/lib/db';
import { saveToBrainAsync } from '@/lib/studio/brain-client';

export async function trackKbGap(params: {
  sessionId: string;
  userId: string;
  question: string;
  searchQuery: string;
}): Promise<void> {
  const { sessionId, userId, question, searchQuery } = params;

  await db.kbChatFeedback.create({
    data: {
      messageId: `gap-${Date.now()}`,
      sessionId,
      userId,
      rating: 'gap',
      question,
      answer: '',
      kbGap: true,
      comment: `Search query: ${searchQuery}`,
    },
  });

  saveToBrainAsync(
    question,
    '[KB GAP — no matching documentation]',
    'kb-chat-gap',
    { subject: `kb_gap:${searchQuery.slice(0, 50)}` },
  );
}

export function saveKbInteractionToBrain(params: {
  question: string;
  answer: string;
  toolsUsed: string[];
  rating?: 'up' | 'down';
}): void {
  const { question, answer, toolsUsed, rating } = params;

  saveToBrainAsync(
    question,
    answer.slice(0, 500),
    'kb-chat',
    {
      subject: `kb_${rating || 'auto'}:${question.slice(0, 50)}`,
      provider: 'gpt-4o-mini',
      quality: rating || 'unrated',
    },
  );

  void toolsUsed; // consumed via meta above
}

export async function getKbGapStats(days: number = 30): Promise<{
  totalGaps: number;
  totalFeedback: number;
  thumbsUp: number;
  thumbsDown: number;
  topGapQuestions: Array<{ question: string; count: number }>;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalGaps, totalFeedback, thumbsUp, thumbsDown] = await Promise.all([
    db.kbChatFeedback.count({ where: { kbGap: true, createdAt: { gte: since } } }),
    db.kbChatFeedback.count({ where: { createdAt: { gte: since } } }),
    db.kbChatFeedback.count({ where: { rating: 'up', createdAt: { gte: since } } }),
    db.kbChatFeedback.count({ where: { rating: 'down', createdAt: { gte: since } } }),
  ]);

  const gaps = await db.kbChatFeedback.findMany({
    where: { kbGap: true, createdAt: { gte: since } },
    select: { question: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const questionCounts = new Map<string, number>();
  for (const g of gaps) {
    const normalized = g.question.toLowerCase().trim().slice(0, 100);
    questionCounts.set(normalized, (questionCounts.get(normalized) || 0) + 1);
  }

  const topGapQuestions = [...questionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([question, count]) => ({ question, count }));

  return { totalGaps, totalFeedback, thumbsUp, thumbsDown, topGapQuestions };
}
