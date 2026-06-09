import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAgentDecision } from '@/lib/studio/agent';
import { executeTool } from '@/lib/studio/tool-executor';
import type { ChatMessage, SessionContext, MediaAttachment } from '@/lib/studio/types';

interface ChatRequest {
  message: string;
  context: SessionContext;
  history: ChatMessage[];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as ChatRequest;
    const { message, context, history } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const decision = await getAgentDecision(message, context, history);

    let media: MediaAttachment | undefined;
    let jobId: string | undefined;
    let toolMessage = decision.message;
    const updatedContext: SessionContext = { ...context };

    if (decision.toolCall) {
      const cookieHeader = req.headers.get('cookie') || '';

      const result = await executeTool(
        decision.toolCall.tool,
        decision.toolCall.params,
        context,
        cookieHeader,
      );

      if (result.error) {
        toolMessage = `${decision.message}\n\n⚠️ ${result.error}`;
      } else {
        if (result.media) {
          media = result.media;
          if (result.media.type === 'image') {
            updatedContext.lastImageUrl = result.media.url;
          } else if (result.media.type === 'video') {
            updatedContext.lastVideoUrl = result.media.url;
          }
        }

        if (result.jobId) {
          jobId = result.jobId;
          toolMessage = `${decision.message}\n\n${result.message || 'Processing...'}`;
        }

        if (result.message && !result.media && !result.jobId) {
          toolMessage = `${decision.message}\n\n${result.message}`;
        }
      }
    }

    return NextResponse.json({
      message: toolMessage,
      media,
      jobId,
      toolUsed: decision.toolCall?.tool ?? null,
      context: updatedContext,
    });
  } catch (error) {
    console.error('[studio/chat] Error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
