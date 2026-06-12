import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveEmbeddingForFeedback } from '@/lib/studio/learning';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as {
    userPrompt?: string;
    enhancedPrompt?: string;
    tool?: string;
    model?: string;
    params?: Record<string, unknown>;
    resultUrl?: string;
    rating?: string;
    issue?: string;
  };

  const { userPrompt, enhancedPrompt, tool, model, params, resultUrl, rating, issue } = body;

  if (!userPrompt || !tool || !rating) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!['up', 'down'].includes(rating)) {
    return NextResponse.json({ error: 'Rating must be "up" or "down"' }, { status: 400 });
  }

  const feedback = await db.studioFeedback.create({
    data: {
      userId: session.user.id,
      userPrompt,
      enhancedPrompt: enhancedPrompt || '',
      tool,
      model: model || '',
      params: params ? JSON.parse(JSON.stringify(params)) : undefined,
      resultUrl: resultUrl || null,
      rating,
      issue: issue || null,
    },
  });

  // Generate embedding asynchronously — don't block the response
  saveEmbeddingForFeedback(feedback.id, userPrompt, enhancedPrompt || '')
    .catch(err => console.error('[feedback] Embedding save failed:', err));

  return NextResponse.json({ id: feedback.id, status: 'saved' });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tool = searchParams.get('tool');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

  const feedback = await db.studioFeedback.findMany({
    where: tool ? { tool } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      userPrompt: true,
      enhancedPrompt: true,
      tool: true,
      model: true,
      rating: true,
      issue: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ feedback });
}
