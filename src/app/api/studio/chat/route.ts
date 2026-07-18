import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAgentDecision } from '@/lib/studio/agent';
import { executeTool } from '@/lib/studio/tool-executor';
import { buildLearningContext, formatLearningContext } from '@/lib/studio/learning';
import { getComboPreset } from '@/lib/studio/prompt-library';
import { executeCombo } from '@/lib/studio/combo-executor';
import type { ChatMessage, SessionContext, MediaAttachment } from '@/lib/studio/types';

interface ChatRequest {
  message: string;
  context: SessionContext;
  history: ChatMessage[];
  hasAudio?: boolean;
  audioFileName?: string | null;
  imageQuality?: 'fast' | 'good';
  imageProvider?: 'flux' | 'grok';
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as ChatRequest;
    const { message, context, history, hasAudio, audioFileName, imageQuality, imageProvider } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const audioContext = hasAudio
      ? `\n[AUDIO STATUS: Music file "${audioFileName}" is uploaded and ready. It will be automatically added to any clip. Do NOT ask user to upload music — it's already done.]`
      : `\n[AUDIO STATUS: No music uploaded. If user wants music in clip, remind them to use the 🎵 button.]`;

    // Build learning context from feedback history (auto-activates at 50+ records)
    const learning = await buildLearningContext(message, null);
    const learningPrompt = formatLearningContext(learning);

    const decision = await getAgentDecision(message + audioContext, context, history, learningPrompt || undefined);

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

    // transform_image is client-side — frontend fetches image and calls Brain proxy
    if (decision.toolCall?.tool === 'transform_image') {
      return NextResponse.json({
        message: decision.message,
        toolUsed: 'transform_image',
        transformParams: decision.toolCall.params,
        context,
      });
    }

    if (decision.toolCall && !decision.comboId) {
      const cookieHeader = req.headers.get('cookie') || '';

      // Apply provider/quality overrides from UI toggles
      const toolParams = { ...decision.toolCall.params };
      const affectedTools = ['generate_image', 'edit_image'] as const;
      const isAffectedTool = (affectedTools as readonly string[]).includes(decision.toolCall.tool);
      if (isAffectedTool) {
        if (imageProvider === 'grok') {
          toolParams.provider = 'grok';
        } else if (imageQuality === 'good') {
          toolParams.provider = 'flux-dev';
        }
      }

      const result = await executeTool(
        decision.toolCall.tool,
        toolParams,
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
      enhancedPrompt: (decision.toolCall?.params?.prompt as string) || '',
      model: '',
      params: decision.toolCall?.params ?? null,
      context: updatedContext,
    });
  } catch (error) {
    console.error('[studio/chat] Error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
