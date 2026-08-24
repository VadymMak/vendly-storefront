import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAgentDecision } from '@/lib/studio/agent';
import { executeTool } from '@/lib/studio/tool-executor';
import { buildLearningContext, formatLearningContext } from '@/lib/studio/learning';
import { getComboPreset } from '@/lib/studio/prompt-library';
import type { ComboStep } from '@/lib/studio/prompt-library';
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

    // DEBUG: log full context received from client
    console.log('[studio/chat] message:', JSON.stringify(message));
    console.log('[studio/chat] context received:', JSON.stringify({
      lastImageUrl: context.lastImageUrl,
      lastVideoUrl: context.lastVideoUrl,
      jobIds: context.jobIds,
      adClipState: context.adClipState,
      loraModel: context.loraModel ? '(set)' : null,
    }));

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

    // --- LANGUAGE DETECTION ---
    const hasCyrillic = /[а-яёА-ЯЁ]/.test(message);
    const languageInstruction = hasCyrillic
      ? '\n\n[LANGUAGE OVERRIDE: User is writing in Russian. You MUST respond ENTIRELY in Russian. No English words. No mixing languages.]'
      : '';

    // --- wantsAdClip: regular ad/clip requests (non-LoRA) ---
    const wantsAdClip =
      msgLower.includes('реклам') ||
      msgLower.includes('рекламн') ||
      msgLower.includes('клип') ||
      msgLower.includes('ролик') ||
      msgLower.includes(' clip') ||
      msgLower.includes('reel') ||
      msgLower.includes('ad for') ||
      msgLower.includes('make ad') ||
      msgLower.includes('create clip') ||
      msgLower.includes('сделай');

    // --- wantsLoraSpecific: only these trigger the LoRA trained-face flow ---
    const LORA_MODEL = 'vadymmak/anna-face-lora:4198443f5a945bd22a2dfdfdb4ec2ec47a5107b9c1c7e163c1d81c78489e72c6';
    const LORA_TRIGGER = 'ANNA';
    const wantsLoraSpecific =
      msgLower.includes('anna') ||
      msgLower.includes('лицом') ||
      msgLower.includes('face clip') ||
      msgLower.includes('same face') ||
      msgLower.includes('lora');

    // Broad LoRA logging (superset)
    const wantsLoraClip = wantsLoraSpecific || wantsAdClip;

    console.log('[studio/chat] wantsAdClip:', wantsAdClip, '| wantsLoraSpecific:', wantsLoraSpecific, '| loraModel:', !!context.loraModel, '| hasCyrillic:', hasCyrillic, '| msg:', msgLower);

    // State-based LoRA detection — no string matching on text
    const wasAskingLoraScene = context.lastAgentState === 'lora_asking_scene';

    // Enter LoRA flow when: specific keyword NOW, OR state says we were asking for scene (loraModel set from prev response)
    if (wantsLoraSpecific || (wasAskingLoraScene && context.loraModel)) {
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
        wasAskingLoraScene ||
        message.length > 60;

      if (!hasSceneDescription) {
        // Step 1: No scene described — ask director questions, set loraModel + state in context
        return NextResponse.json({
          message: 'Отлично! Создам клип с лицом ANNA. Уточни детали:\n\n🎬 **Где происходит сцена?** (пляж, ресторан, улица, лес, студия, кафе...)\n💃 **Что она делает?** (идёт, держит кофе, улыбается, смотрит в камеру...)\n👗 **Стиль одежды?** (casual, элегантное, пляжное, спортивное...)\n🌅 **Настроение?** (летнее, романтичное, динамичное, утреннее...)',
          toolUsed: null,
          context: { ...context, loraModel: LORA_MODEL, loraTriggerWord: LORA_TRIGGER, lastAgentState: 'lora_asking_scene' as const },
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

        // Ensure loraModel is set in context for the combo execution
        const loraContext = { ...context, loraModel: LORA_MODEL, loraTriggerWord: LORA_TRIGGER };
        const loraResult = await executeCombo(loraSteps, sceneBase, loraContext, cookieHeader);

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

        const loraFinalContext = {
          ...loraResult.finalContext,
          ...(jobIds.length > 0 ? { jobIds } : {}),
        };

        return NextResponse.json({
          message: `Генерирую 4 сцены с лицом ANNA: "${sceneBase}"\n\n${progressLines.join('\n')}${jobIds.length > 0 ? `\n\n🎬 Анимирую ${jobIds.length} сцен через Kling (~2-3 мин)` : ''}`,
          toolUsed: 'combo:lora_ad_clip',
          comboImages: comboImages.length > 0 ? comboImages : undefined,
          jobIds: jobIds.length > 0 ? jobIds : undefined,
          context: { ...loraFinalContext, lastAgentState: 'generating' as const },
        });
      }
    }
    // --- END LoRA CLIP INTENT ---

    // Declare lastState early — used by Movie Maker handlers and state routing below
    const lastState = context.lastAgentState;

    // --- MOVIE MAKER STATE TRANSITIONS (short-circuit before agent) ---

    // Step 1 → Step 2: User selected clip length
    if (lastState === 'asking_clip_length') {
      const len = msgLower.includes('60') ? 60
                : msgLower.includes('30') ? 30
                : msgLower.includes('15') ? 15
                : null;
      if (len) {
        const sceneCount = Math.round(len / 3);
        return NextResponse.json({
          message: `${len} секунд — ${sceneCount} сцен × 3 сек.\n\nКакое лицо использовать?`,
          toolUsed: null,
          buttons: [
            { label: '🎲 Случайное лицо', value: 'random' },
            { label: '👤 ANNA (сохранённое лицо)', value: 'lora' },
            { label: '📷 Загрузить фото', value: 'upload' },
          ],
          context: {
            ...context,
            clipLength: len as 15 | 30 | 60,
            sceneCount,
            sceneDuration: 3 as const,
            lastAgentState: 'asking_face_mode' as const,
          },
        });
      }
    }

    // Step 2 → Step 3: User selected face mode
    if (lastState === 'asking_face_mode') {
      const isLora = msgLower.includes('anna') || msgLower.includes('lora') || msgLower.includes('сохранённ');
      const isUpload = msgLower.includes('загрузить') || msgLower.includes('upload') || msgLower.includes('📷') || (!!context.uploadedReferenceUrl && !isLora);
      const isRandom = msgLower.includes('случайн') || msgLower.includes('random') || msgLower.includes('🎲') || msgLower === 'random';
      const faceMode: 'random' | 'lora' | 'upload' | null =
        isLora ? 'lora' : isUpload ? 'upload' : isRandom ? 'random' : null;

      if (faceMode) {
        const newCtx: SessionContext = {
          ...context,
          faceMode,
          ...(faceMode === 'lora' ? { loraModel: LORA_MODEL, loraTriggerWord: LORA_TRIGGER } : {}),
          lastAgentState: 'asking_business_type' as const,
        };
        return NextResponse.json({
          message: 'Отлично! Теперь выберите тему клипа:',
          toolUsed: null,
          buttons: [
            { label: '🍽️ Ресторан / Кафе', value: 'restaurant' },
            { label: '✂️ Барбершоп', value: 'barbershop' },
            { label: '💅 Nail salon', value: 'nail_salon' },
            { label: '💆 Спа / Массаж', value: 'spa' },
            { label: '🏪 Магазин', value: 'retail' },
            { label: '📱 Другое', value: 'other' },
          ],
          context: newCtx,
        });
      }
    }

    // Step 4 (approval) → Generate: user approved movieScript storyboard
    if (lastState === 'showing_script' && context.movieScript?.length) {
      const approvalWords = ['да', 'генерируй', 'давай', 'go', 'yes', 'нравится', 'одобряю', 'ok', 'ок', 'generate', 'старт', 'поехали', 'начинай', 'запускай'];
      const isApproval = approvalWords.some((w) => msgLower.includes(w));

      if (isApproval) {
        console.log('[studio/chat] Movie Maker approval → launching', context.movieScript.length, 'scenes, faceMode:', context.faceMode);
        const cookieHeader = req.headers.get('cookie') || '';
        const sceneTool = context.faceMode === 'random' ? 'generate_image' : 'generate_character';

        const movieSteps: ComboStep[] = context.movieScript.map((scene, i) => {
          if (context.faceMode === 'random') {
            return {
              tool: 'generate_image',
              description: `Сцена ${i + 1} — ${scene.title}`,
              promptTemplate: scene.description,
              params: { aspect_ratio: '9:16' } as Record<string, string | number>,
              alwaysGenerate: true,
            } satisfies ComboStep;
          }
          return {
            tool: 'generate_character',
            description: `Сцена ${i + 1} — ${scene.title}`,
            params: { scene_description: scene.description } as Record<string, string | number>,
            alwaysGenerate: true,
          } satisfies ComboStep;
        });
        movieSteps.push({
          tool: 'create_clip',
          description: `Анимирую и собираю ${context.clipLength || '?'}с клип`,
          params: { duration: context.sceneDuration || 3, animate_all: 1 },
        });

        const movieCtx: SessionContext = {
          ...context,
          ...(context.faceMode === 'lora' ? { loraModel: LORA_MODEL, loraTriggerWord: LORA_TRIGGER } : {}),
        };
        const movieResult = await executeCombo(movieSteps, '', movieCtx, cookieHeader);

        const comboImages = movieResult.steps
          .filter((s) => s.media?.type === 'image')
          .map((s) => s.media!.url);
        const animStep = movieResult.steps.find((s) => s.jobIds?.length);
        const jobIds = animStep?.jobIds ?? [];

        const progressLines = movieResult.steps.map((s, i) => {
          if (s.jobIds?.length) return `${i + 1}. ⏳ ${s.description} (${s.jobIds.length} видео генерируется...)`;
          if (s.error) return `${i + 1}. ❌ ${s.description}: ${s.error}`;
          if (s.jobId) return `${i + 1}. ⏳ ${s.description}`;
          return `${i + 1}. ✅ ${s.description}`;
        });

        return NextResponse.json({
          message: `🎬 Генерирую ${context.movieScript.length} сцен для ${context.clipLength || '?'}с клипа!\n\n${progressLines.join('\n')}${jobIds.length > 0 ? `\n\n⚡ Анимирую ${jobIds.length} сцен через Kling (~2-3 мин)` : ''}`,
          toolUsed: 'combo:movie_maker',
          comboImages: comboImages.length > 0 ? comboImages : undefined,
          jobIds: jobIds.length > 0 ? jobIds : undefined,
          context: { ...movieResult.finalContext, lastAgentState: 'generating_scenes' as const },
        });
      }
      // Not approval → fall through to agent (handles edits to storyboard)
    }

    // --- END MOVIE MAKER STATE TRANSITIONS ---

    // --- ASSEMBLE INTENT: short-circuit Haiku when videos are ready ---
    const wantsAssemble =
      msgLower.includes('assemble') ||
      msgLower.includes('собери') ||
      msgLower.includes('compile') ||
      msgLower.includes('final clip') ||
      msgLower.includes('финальный клип') ||
      msgLower.includes('собери клип') ||
      msgLower.includes('склей');

    if (wantsAssemble) {
      const adVideos = context.adClipState?.videos ?? [];
      const loraJobs = context.jobIds ?? [];
      const totalVideos = adVideos.length + loraJobs.length;

      console.log('[studio/chat] wantsAssemble=true | adVideos:', adVideos.length, '| loraJobs:', JSON.stringify(loraJobs), '| totalVideos:', totalVideos);

      if (totalVideos > 0) {
        console.log('[studio/chat] assemble short-circuit → create_clip');
        return NextResponse.json({
          message: `Собираю финальный клип из ${totalVideos} сцен...`,
          toolUsed: 'create_clip',
          clipParams: { style: 'cinematic', transition: 'fade', durationPerImage: 5, platform: 'instagram_reel' },
          context: {
            ...context,
            lastAgentState: 'done' as const,
            adClipState: context.adClipState
              ? { ...context.adClipState, currentStep: 'clip' as const }
              : undefined,
          },
        });
      }

      console.log('[studio/chat] wantsAssemble=true but no videos in context — falling through to agent');
    }
    // --- END ASSEMBLE INTENT ---

    // --- STATE-BASED ROUTING: inject instructions based on lastAgentState (no string matching) ---

    let stateInstruction = '';
    if (lastState === 'asking_director_questions') {
      if (context.clipLength) {
        // Movie Maker flow — generate movieScript storyboard
        stateInstruction = `\n\n[STATE: "asking_director_questions" in MOVIE MAKER flow. clipLength=${context.clipLength}s, sceneCount=${context.sceneCount}, faceMode="${context.faceMode ?? 'unknown'}". User described their content. Generate EXACTLY ${context.sceneCount} scenes as movieScript array. scene.description MUST be in English. Return state "showing_script".]`;
      } else {
        // Regular ad clip flow — call write_script
        stateInstruction = '\n\n[STATE: "asking_director_questions". User replied with scene/hero details. IMMEDIATELY call write_script. Do NOT ask more questions. Return state "ready_to_generate".]';
      }
    } else if (lastState === 'asking_business_type') {
      stateInstruction = '\n\n[STATE: "asking_business_type". User told you their business type. Ask director questions now → state "asking_director_questions".]';
    } else if (lastState === 'ready_to_generate') {
      stateInstruction = '\n\n[STATE: "ready_to_generate" (text storyboard shown). User approves → return combo "ad_clip_generate" → state "generating". User wants changes → rewrite specific scene, keep state "ready_to_generate".]';
    } else if (lastState === 'showing_script') {
      stateInstruction = `\n\n[STATE: "showing_script" (movieScript storyboard shown). User wants edits → update specific scenes, return full updated movieScript, keep state "showing_script". If user approves — route.ts handles it (you will NOT receive approval messages for this state).]`;
    }

    console.log('[studio/chat] lastAgentState:', lastState, '| stateInstruction applied:', !!stateInstruction);
    // --- END STATE-BASED ROUTING ---

    const decision = await getAgentDecision(
      message + audioContext + languageInstruction + stateInstruction,
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
            context: { ...comboResult.finalContext, lastAgentState: 'generating' as const },
          });
        }

        if (clipStep) {
          const clipStepDef = combo.steps.find((s) => s.tool === 'create_clip');
          const comboImages = comboResult.steps
            .filter((s) => s.media?.type === 'image')
            .map((s) => s.media!.url);
          return NextResponse.json({
            message: fullMessage,
            media: lastMedia ?? undefined,
            toolUsed: 'create_clip',
            clipParams: clipStepDef?.params ?? { style: 'cinematic', transition: 'fade', durationPerImage: 4, platform: 'instagram_reel' },
            comboImages: comboImages.length > 0 ? comboImages : undefined,
            context: { ...comboResult.finalContext, lastAgentState: 'done' as const },
          });
        }

        const videoStep = comboResult.steps.find((s) => s.jobId);

        return NextResponse.json({
          message: fullMessage,
          media: lastMedia ?? undefined,
          jobId: videoStep?.jobId ?? undefined,
          toolUsed: `combo:${decision.comboId}`,
          context: { ...comboResult.finalContext, lastAgentState: decision.state },
        });
      }
    }

    let media: MediaAttachment | undefined;
    let jobId: string | undefined;
    let toolMessage = decision.message;
    const updatedContext: SessionContext = {
      ...context,
      lastAgentState: decision.state,
      ...(decision.movieScript ? { movieScript: decision.movieScript } : {}),
    };

    // create_clip is client-side — return params to frontend without executing on server
    if (decision.toolCall?.tool === 'create_clip') {
      const clipCtx = { ...context, lastAgentState: 'done' as const };
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
        context: { ...context, lastAgentState: decision.state },
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
