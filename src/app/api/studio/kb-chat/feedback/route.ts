import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveKbInteractionToBrain } from '@/lib/kb/learning';

interface FeedbackRequest {
  messageId: string;
  sessionId: string;
  rating: 'up' | 'down';
  question: string;
  answer: string;
  comment?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as FeedbackRequest;
  const { messageId, sessionId, rating, question, answer, comment } = body;

  if (!messageId || !sessionId || !rating || !question) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  await db.kbChatFeedback.create({
    data: {
      messageId,
      sessionId,
      userId: session.user.id,
      rating,
      question,
      answer: answer?.slice(0, 2000) || '',
      comment: comment?.slice(0, 500),
    },
  });

  saveKbInteractionToBrain({ question, answer, toolsUsed: [], rating });

  return NextResponse.json({ success: true });
}
