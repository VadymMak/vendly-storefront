import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAgentDecision } from '@/lib/studio/agent';
import { executeTool } from '@/lib/studio/tool-executor';
import { buildLearningContext, formatLearningContext } from '@/lib/studio/learning';
import { getComboPreset } from '@/lib/studio/prompt-library';
import { executeCombo } from '@/lib/studio/combo-executor';
import { SUPERUSER_EMAILS } from '@/lib/credits';
import { getBrainStudioContext, saveToBrainAsync } from '@/lib/studio/brain-client';
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

    // Auto-animate next ad clip scene — bypasses agent entirely
    if (message === '__animate_next__' && context.adClipState) {
      const { scenes, videos } = context.adClipState;
      const nextIndex = videos.length;
      const cookieHeader = req.headers.get('cookie') || '';

      if (nextIndex < scenes.length) {
        const animCtx: SessionContext = { ...context, lastImageUrl: scenes[nextIndex] };
        const animResult = await executeTool('image_to_video', {
          prompt: 'slow dolly forward, cinematic movement, warm atmospheric',
          aspectRatio: '9:16',
          duration: 5,
        }, animCtx, cookieHeader);

        return NextResponse.json({
          message: `🎬 Animating scene ${nextIndex + 1}/${scenes.length}... (~30-60 sec)`,
          jobId: animResult.jobId ?? undefined,
          toolUsed: 'image_to_video',
          context,
        });
      }

      return NextResponse.json({
        message: `✅ All ${scenes.length} scenes animated! Say "assemble final clip" to compile the ad.`,
        context: { ...context, adClipState: { ...context.adClipState, currentStep: 'clip' as const } },
        toolUsed: null,
      });
    }

    const audioContext = hasAudio
      ? `\n[AUDIO STATUS: Music file "${audioFileName}" is uploaded and ready. It will be automatically added to any clip. Do NOT ask user to upload music — it's already done.]`
      : `\n[AUDIO STATUS: No music uploaded. If user wants music in clip, remind them to use the 🎵 button.]`;

    // Build learning context from feedback history (auto-activates at 50+ records)
    const learning = await buildLearningContext(message, null);
    const learningPrompt = formatLearningContext(learning);

    // Brain context — only for superusers
    const isSuperuser = (SUPERUSER_EMAILS as readonly string[]).includes(
      session.user.email?.toLowerCase() ?? '',
    );
    const brainContext = isSuperuser
      ? await getBrainStudioContext(message)
      : '';

    // --- LoRA CLIP INTENT: two-step — director questions → generate ---
    const msgLower = message.toLowerCase();
    const wantsLoraClip =
      msgLower.includes('anna') ||
      msgLower.includes('лицом') ||
      msgLower.includes('face clip') ||
      msgLower.includes('same face') ||
      msgLower.includes('lora');

    // Check if previous assistant message was asking LoRA director questions
    const prevAssistantMsg = [...history].reverse().find((m) => m.role === 'assistant')?.content ?? '';
    const wasAskingLoraQuestions =
      prevAssistantMsg.includes('Где происходит сцена') ||
      prevAssistantMsg.includes('Что она делает') ||
      prevAssistantMsg.includes('Уточни детали') ||
      prevAssistantMsg.includes('face clip with ANNA');

    if ((wantsLoraClip || wasAskingLoraQuestions) && context.loraModel) {
      const hasSceneDescription =
        msgLower.includes('пляж') || msgLower.includes('beach') ||
        msgLower.includes('кухн') || msgLower.includes('kitchen') ||
        msgLower.includes('улиц') || msgLower.includes('street') ||
        msgLower.includes('ресторан') || msgLower.includes('restaurant') ||
        msgLower.includes('лес') || msgLower.includes('forest') ||
        msgLower.includes('офис') || msgLower.includes('office') ||
        msgLower.includes('кафе') || msgLower.includes('cafe') ||
        msgLower.includes('студи') || msgLower.includes('studio') ||
        msgLower.includes('парк') || msgLower.includes('park') ||
        wasAskingLoraQuestions ||
        message.length > 60;

      if (!hasSceneDescription) {
        // Step 1: No scene described — ask director questions
        return NextResponse.json({
          message: 'Отлично! Создам клип с лицом ANNA. Уточни детали:\n\n🎬 **Где происходит сцена?** (пляж, ресторан, улица, лес, студия, кафе...)\n💃 **Что она делает?** (идёт, держит кофе, улыбается, смотрит в камеру...)\n👗 **Стиль одежды?** (casual, элегантное, пляжное, спортивное...)\n🌅 **Настроение?** (летнее, романтичное, динамичное, утреннее...)',
          toolUsed: null,
          context,
        });
      }

      // Step 2: Scene described — run combo with 4 variations
      const loraCombo = getComboPreset('lora_ad_clip');
      if (loraCombo) {
        const cookieHeader = req.headers.get('cookie') || '';
        const sceneBase = message;
        const sceneVariations = [
          `${sceneBase}, wide establishing shot`,
          `${sceneBase}, medium shot, natural expression`,
          `${sceneBase}, close-up portrait, bokeh background`,
          `${sceneBase}, dynamic angle, cinematic lighting`,
        ];

        // Clone steps with scene variations injected into each generate_character step
        let variationIdx = 0;
        const loraSteps = loraCombo.steps.map((step) => {
          if (step.tool === 'generate_character') {
            const variation = sceneVariations[variationIdx] ?? sceneBase;
            variationIdx++;
            return { ...step, params: { ...step.params, scene_description: variation } };
          }
          return step;
        });

        const loraResult = await executeCombo(loraSteps, sceneBase, context, cookieHeader);

        const comboImages = loraResult.steps
          .filter((s) => s.media?.type === 'image')
          .map((s) => s.media!.url);

        const animateStep = loraResult.steps.find((s) => s.jobIds && s.jobIds.length > 0);
        const jobIds = animateStep?.jobIds ?? [];

        const progressLines = loraResult.steps.map((s, i) => {
          if (s.jobIds?.length) return `${i + 1}. ⏳ ${s.description} (${s.jobIds.length} videos generating...)`;
          if (s.error) return `${i + 1}. ❌ ${s.description}: ${s.error}`;
          if (s.jobId) return `${i + 1}. ⏳ ${s.description} (generating...)`;
          return `${i + 1}. ✅ ${s.description}`;
        });

        return NextResponse.json({
          message: `Генерирую 4 сцены с лицом ANNA: "${sceneBase}"\n\n${progressLines.join('\n')}${jobIds.length > 0 ? `\n\n🎬 Анимирую ${jobIds.length} сцен через Kling (~2-3 мин)` : ''}`,
          toolUsed: 'combo:lora_ad_clip',
          comboImages: comboImages.length > 0 ? comboImages : undefined,
          jobIds: jobIds.length > 0 ? jobIds : undefined,
          context: loraResult.finalContext,
        });
      }
    }
    // --- END LoRA CLIP INTENT ---

    const decision = await getAgentDecision(
      message + audioContext,
      context,
      history,
      learningPrompt || undefined,
      brainContext || undefined,
    );

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

        // ad_clip_generate: set adClipState + launch ALL animations in parallel
        if (clipStep && decision.comboId === 'ad_clip_generate') {
          const comboImages = comboResult.steps
            .filter((s) => s.media?.type === 'image')
            .map((s) => s.media!.url);

          comboResult.finalContext.adClipState = {
            scenes: comboImages,
            videos: [],
            currentStep: 'videos',
          };

          const motionPrompts = [
            'slow dolly forward, cinematic movement, warm atmospheric lighting',
            'gentle camera pull-back, subject in focus, golden hour light',
            'subtle pan right, intimate close detail, warm cinematic',
          ];

          const videoJobResults = await Promise.all(
            comboImages.map(async (imageUrl, idx) => {
              const animCtx: SessionContext = { ...comboResult.finalContext, lastImageUrl: imageUrl };
              const result = await executeTool('image_to_video', {
                prompt: motionPrompts[idx] ?? motionPrompts[0],
                aspectRatio: '9:16',
                duration: 5,
              }, animCtx, cookieHeader);
              return result.jobId ?? null;
            })
          );

          const jobIds = videoJobResults.filter((id): id is string => id !== null);

          return NextResponse.json({
            message: fullMessage + `\n\n🎬 Animating ${jobIds.length} scene${jobIds.length !== 1 ? 's' : ''} in parallel... (~2 min)`,
            media: lastMedia ?? undefined,
            jobIds: jobIds.length > 0 ? jobIds : undefined,
            toolUsed: `combo:ad_clip_generate`,
            comboImages: comboImages.length > 0 ? comboImages : undefined,
            context: comboResult.finalContext,
          });
        }

        if (clipStep) {
          const clipStepDef = combo.steps.find((s) => s.tool === 'create_clip');
          // Only pass images generated in THIS combo — prevents collecting all session images
          const comboImages = comboResult.steps
            .filter((s) => s.media?.type === 'image')
            .map((s) => s.media!.url);
          return NextResponse.json({
            message: fullMessage,
            media: lastMedia ?? undefined,
            toolUsed: 'create_clip',
            clipParams: clipStepDef?.params ?? { style: 'cinematic', transition: 'fade', durationPerImage: 4, platform: 'instagram_reel' },
            comboImages: comboImages.length > 0 ? comboImages : undefined,
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
      const clipCtx = { ...context };
      if (decision.toolCall.params.brandName) clipCtx.brandName = String(decision.toolCall.params.brandName);
      if (decision.toolCall.params.slogan) clipCtx.slogan = String(decision.toolCall.params.slogan);
      return NextResponse.json({
        message: decision.message,
        toolUsed: 'create_clip',
        clipParams: decision.toolCall.params,
        context: clipCtx,
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
            // Lock reference image for character consistency across scenes
            if (decision.toolCall?.tool === 'generate_character') {
              updatedContext.characterReferenceUrl = result.media.url;
            }
          } else if (result.media.type === 'video') {
            updatedContext.lastVideoUrl = result.media.url;
          } else if (result.media.type === 'audio') {
            updatedContext.lastAudioUrl = result.media.url;
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

    // Save to Brain async (non-blocking, superusers only)
    if (isSuperuser && toolMessage) {
      saveToBrainAsync(message, toolMessage, decision.toolCall?.tool ?? undefined, {
        provider: imageProvider,
        quality: imageQuality,
        aspect_ratio: decision.toolCall?.params?.aspect_ratio as string | undefined,
        subject: decision.toolCall?.params?.subject as string | undefined,
      });
    }

    return NextResponse.json({
      message: toolMessage,
      media,
      jobId,
      toolUsed: decision.toolCall?.tool ?? null,
      enhancedPrompt: (decision.toolCall?.params?.prompt as string) || '',
      model: '',
      params: decision.toolCall?.params ?? null,
      buttons: decision.buttons ?? null,
      context: updatedContext,
    });
  } catch (error) {
    console.error('[studio/chat] Error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
