import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAgentDecision } from '@/lib/studio/agent';
import { executeTool } from '@/lib/studio/tool-executor';
import { getComboPreset } from '@/lib/studio/prompt-library';
import { executeCombo } from '@/lib/studio/combo-executor';
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

    // Handle combo (multi-step chain)
    if (decision.comboId) {
      const combo = getComboPreset(decision.comboId);
      if (combo) {
        const cookieHeader = req.headers.get('cookie') || '';
        const subject = (decision.toolCall?.params?.subject as string) || message;

        const comboResult = await executeCombo(combo.steps, subject, context, cookieHeader);

        const allMedia = comboResult.steps.filter((s) => s.media).map((s) => s.media!);
        const lastMedia = allMedia[allMedia.length - 1];
        const captionStep = comboResult.steps.find((s) => s.message && !s.media && !s.jobId);

        const progressLines = comboResult.steps.map((s, i) => {
          if (s.message === '__CREATE_CLIP__') return `${i + 1}. ⏳ ${s.description} (rendering in browser...)`;
          if (s.error) return `${i + 1}. ❌ ${s.description}: ${s.error}`;
          if (s.jobId) return `${i + 1}. ⏳ ${s.description} (generating...)`;
          return `${i + 1}. ✅ ${s.description}`;
        });

        let fullMessage = `${decision.message}\n\n${progressLines.join('\n')}`;
        if (captionStep?.message) {
          fullMessage += `\n\n📝 Caption:\n${captionStep.message}`;
        }

        // Check if combo ends with a client-side clip step
        const clipStep = comboResult.steps.find((s) => s.message === '__CREATE_CLIP__');
        if (clipStep) {
          const clipStepDef = combo.steps.find((s) => s.tool === 'create_clip');
          return NextResponse.json({
            message: fullMessage,
            media: lastMedia ?? undefined,
            toolUsed: 'create_clip',
            clipParams: clipStepDef?.params ?? { style: 'cinematic', transition: 'fade', durationPerImage: 4, platform: 'instagram_reel' },
            context: comboResult.finalContext,
          });
        }

        const videoStep = comboResult.steps.find((s) => s.jobId);

        return NextResponse.json({
          message: fullMessage,
          media: lastMedia ?? undefined,
          jobId: videoStep?.jobId ?? undefined,
          toolUsed: `combo:${decision.comboId}`,
          context: comboResult.finalContext,
        });
      }
    }

    let media: MediaAttachment | undefined;
    let jobId: string | undefined;
    let toolMessage = decision.message;
    const updatedContext: SessionContext = { ...context };

    // create_clip is client-side — return params to frontend without executing on server
    if (decision.toolCall?.tool === 'create_clip') {
      return NextResponse.json({
        message: decision.message,
        toolUsed: 'create_clip',
        clipParams: decision.toolCall.params,
        context,
      });
    }

    if (decision.toolCall && !decision.comboId) {
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
