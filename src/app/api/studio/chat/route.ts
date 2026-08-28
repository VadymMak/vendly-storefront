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
import { FACE_REGISTRY } from '@/lib/studio/face-registry';

const IS_MOCK = process.env.STUDIO_MOCK === 'true';

interface ChatRequest {
  message: string;
  context: SessionContext;
  history: ChatMessage[];
  hasAudio?: boolean;
  audioFileName?: string | null;
  imageQuality?: 'fast' | 'good';
  imageProvider?: 'flux' | 'grok';
}

async function ollamaChat(model: string, systemPrompt: string, userMessage: string, timeoutMs = 30000): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: false,
      options: { temperature: 0.1, num_predict: model.includes('1b') ? 80 : 300 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json() as { message?: { content?: string } };
  return data.message?.content || '';
}

const OLLAMA_EXTRACTOR_PROMPT = `You are a service AI for a video/image generation app.
Extract structured data from user messages and build a clean prompt for Claude.
Always respond with valid JSON only. No markdown. No explanation.

JSON structure:
{
  "action": "clip" | "lora_clip" | "movie" | "image" | "assemble" | "text",
  "face": "<NAME>" | "random" | "upload" | null,
  "scene": "<English scene description>",
  "style": "<visual style in English>",
  "duration": <seconds as number> | null,
  "business_type": "<type>" | null,
  "claude_prompt": "<complete English task description for Claude>"
}

Rules:
- action "lora_clip" when user mentions a specific person name (ANNA, KATE, etc.)
- action "clip" for generic ad clip/reel requests
- action "movie" when duration > 20sec or user says movie/scenario/history
- action "assemble" when user says assemble/combine/finalize/готово/собери
- face: extract the name exactly as written (ANNA not anna), null if not mentioned
- scene: always translate to English, be specific
- claude_prompt: write a complete creative brief in English for Claude to generate storyboard

CONTINUITY RULES for claude_prompt when action is lora_clip (critical for movie-like result):
- Choose ONE location for ALL 4 scenes (not beach + cafe + street — pick ONE from user request)
- ONE outfit described explicitly (e.g., "white sundress", "red blazer") — same in all 4 scenes
- ONE lighting condition (e.g., "golden hour", "soft morning light") — same in all 4 scenes
- Scenes must be PROGRESSIVE: arrive → explore → interact → emotional close-up
- Each scene: "[FaceName] [action], [SAME location], [SAME outfit], [SAME light], [camera angle]"
- claude_prompt must list all 4 scene descriptions explicitly following these rules

Examples:

Input: "сделай клип с лицом ANNA на пляже как реклама духов"
Output: {"action":"lora_clip","face":"ANNA","scene":"tropical beach at sunset","style":"luxury perfume advertisement, cinematic, golden hour light, white sundress","duration":null,"business_type":null,"claude_prompt":"Create a 4-scene lora_ad_clip with CONTINUITY. Location: tropical beach at sunset. Outfit: white sundress. Lighting: golden hour. Scenes: 1) ANNA arrives on beach, white sundress, golden hour, wide shot. 2) ANNA walks along water, same white sundress, same golden light, medium shot from behind. 3) ANNA holds perfume bottle looking at ocean, same outfit, same light, medium-close profile. 4) ANNA turns to camera with warm smile, beach softly blurred, same golden light, close-up portrait."}

Input: "создай рекламный клип для кафе 30 секунд"
Output: {"action":"clip","face":"random","scene":"cozy modern cafe, morning light","style":"lifestyle advertisement, warm, inviting","duration":30,"business_type":"cafe","claude_prompt":"Create a 10-scene storyboard for a cafe advertisement (30 seconds, 3 sec per scene). Setting: modern cozy cafe in the morning. Style: warm, lifestyle, inviting. Show: exterior, barista, coffee preparation, customer arriving, enjoying coffee, food close-up, social moment, terrace, logo, CTA."}

Input: "привет как дела"
Output: {"action":"text","face":null,"scene":null,"style":null,"duration":null,"business_type":null,"claude_prompt":null}`;

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

    // --- STEP 1: Instant JS routing — no network, no timeout risk ---
    function quickRoute(msg: string): { action: string; face: string | null } {
      const m = msg.toLowerCase();
      let face: string | null = null;
      for (const faceName of Object.keys(FACE_REGISTRY)) {
        if (msg.toUpperCase().includes(faceName)) { face = faceName; break; }
      }
      const action =
        face ? 'lora_clip' :
        m.includes('собери') || m.includes('собер') || m.includes('assemble') || m.includes('финальный') || m.includes('склей') ? 'assemble' :
        m.includes('клип') || m.includes('clip') || m.includes('рекламн') || m.includes('reel') || m.includes('ролик') ? 'clip' :
        m.includes('фильм') || m.includes('movie') || m.includes('сценари') ? 'movie' :
        m.includes('фото') || m.includes('изображ') || m.includes('image') || m.includes('генер') ? 'image' :
        'text';
      return { action, face };
    }

    const quickRouting = quickRoute(message);
    console.log('[studio/chat] JS routing:', quickRouting.action, '| face:', quickRouting.face);

    let extracted: {
      action: string;
      face: string | null;
      scene: string | null;
      style: string | null;
      duration: number | null;
      business_type: string | null;
      claude_prompt: string | null;
    } = {
      action: quickRouting.action,
      face: quickRouting.face,
      scene: null, style: null, duration: null, business_type: null, claude_prompt: null,
    };

    // Keyword scene extraction as baseline (used if 3B fails)
    if (msgLower.includes('пляж') || msgLower.includes('beach')) extracted.scene = 'beach';
    else if (msgLower.includes('кафе') || msgLower.includes('cafe')) extracted.scene = 'cozy cafe';
    else if (msgLower.includes('улиц') || msgLower.includes('street')) extracted.scene = 'city street';
    else if (msgLower.includes('лес') || msgLower.includes('forest')) extracted.scene = 'forest';
    else if (msgLower.includes('офис') || msgLower.includes('office')) extracted.scene = 'office';
    if (msgLower.includes('закат') || msgLower.includes('sunset')) extracted.scene = (extracted.scene ? extracted.scene + ' at sunset' : 'at sunset');

    // --- STEP 2: Full extraction with 3B (30s) — only if generation needed ---
    const needsGeneration = ['lora_clip', 'clip', 'movie', 'image'].includes(extracted.action);
    if (needsGeneration) {
      try {
        const fullRes = await ollamaChat('llama3.2:3b', OLLAMA_EXTRACTOR_PROMPT, message, 30000);
        const full = JSON.parse(fullRes) as typeof extracted;
        extracted = full;
        // Restore JS-detected face if 3B missed it
        if (!extracted.face && quickRouting.face) extracted.face = quickRouting.face;
        console.log('[studio/chat] 3B extracted:', JSON.stringify(extracted));
      } catch (err) {
        console.error('[studio/chat] 3B extraction failed, using JS routing + keyword scene:', err);
        // extracted already has action/face from quickRoute and keyword scene — safe to continue
      }
    }

    // Safety guard — lora_clip needs a face model resolved
    if (extracted.action === 'lora_clip' && !extracted.face && !context.loraModel) {
      return NextResponse.json({
        message: 'Не могу найти модель лица. Уточни: "сделай клип с лицом ANNA"',
        toolUsed: null,
        context,
      });
    }

    // Set context from extracted entities
    if (extracted.face && extracted.face !== 'random' && extracted.face !== 'upload') {
      const faceEntry = FACE_REGISTRY[extracted.face.toUpperCase()];
      if (faceEntry?.loraModel) {
        context.loraModel = faceEntry.loraModel;
        context.loraTriggerWord = faceEntry.triggerWord ?? null;
        console.log(`[studio/chat] Face set from registry: ${extracted.face} → ${faceEntry.loraModel}`);
      }
    }
    if (extracted.duration && !context.clipLength) {
      const dur = extracted.duration;
      context.clipLength = (dur >= 60 ? 60 : dur >= 30 ? 30 : 15) as 15 | 30 | 60;
      context.sceneCount = Math.floor(extracted.duration / 3);
      context.sceneDuration = 3;
    }
    if (extracted.scene) {
      context.currentScene = extracted.scene;
    }

    const wantsLoraSpecific = extracted.action === 'lora_clip';
    const wantsAdClip = extracted.action === 'clip' || extracted.action === 'movie';
    const wantsAssemble = extracted.action === 'assemble';
    const wantsLoraClip = wantsLoraSpecific || wantsAdClip;

    console.log('[studio/chat] action:', extracted.action, '| wantsLoraSpecific:', wantsLoraSpecific, '| wantsAdClip:', wantsAdClip, '| loraModel:', !!context.loraModel, '| hasCyrillic:', hasCyrillic);

    // State-based LoRA detection — no string matching on text
    const wasAskingLoraScene = context.lastAgentState === 'lora_asking_scene';

    // Enter LoRA flow when: specific keyword NOW, OR state says we were asking for scene (loraModel set from prev response)
    if (wantsLoraSpecific || (wasAskingLoraScene && context.loraModel)) {
      // Ollama gives us the scene directly; fallback to keyword/length check
      const hasSceneDescription =
        !!extracted.scene ||
        wasAskingLoraScene ||
        msgLower.includes('пляж') ||
        msgLower.includes('beach') ||
        msgLower.includes('кухн') ||
        msgLower.includes('улиц') ||
        msgLower.includes('ресторан') ||
        msgLower.includes('лес') ||
        msgLower.includes('офис') ||
        message.length > 60;
      const faceName = extracted.face ?? context.loraTriggerWord ?? 'ANNA';

      if (!hasSceneDescription) {
        // Step 1: No scene described — ask director questions (loraModel already set from extraction)
        return NextResponse.json({
          message: `Отлично! Создам клип с лицом ${faceName}. Уточни детали:\n\n🎬 **Где происходит сцена?** (пляж, ресторан, улица, лес, студия, кафе...)\n💃 **Что она делает?** (идёт, держит кофе, улыбается, смотрит в камеру...)\n👗 **Стиль одежды?** (casual, элегантное, пляжное, спортивное...)\n🌅 **Настроение?** (летнее, романтичное, динамичное, утреннее...)`,
          toolUsed: null,
          context: { ...context, lastAgentState: 'lora_asking_scene' as const },
        });
      }

      // Step 2: Scene described — run combo with 4 variations using English scene from Ollama
      const loraCombo = getComboPreset('lora_ad_clip');
      if (loraCombo) {
        const cookieHeader = req.headers.get('cookie') || '';
        const sceneBase = extracted.scene || message;
        // Continuity: same location + outfit + light across all 4 scenes, progressive action
        const styleCtx = extracted.style ? `, ${extracted.style}` : '';
        const sceneVariations = [
          `${sceneBase}${styleCtx}, wide establishing shot, character arriving or standing, full body visible`,
          `${sceneBase}${styleCtx}, medium shot, character walking or moving slowly, same exact setting and lighting`,
          `${sceneBase}${styleCtx}, medium-close shot, character pausing or interacting with environment, same setting and light`,
          `${sceneBase}${styleCtx}, close-up portrait, character facing camera with warm expression, same background softly blurred, same lighting`,
        ];

        // Clone steps with scene variations injected into each generate_image step
        let variationIdx = 0;
        const loraSteps = loraCombo.steps.map((step) => {
          if (step.tool === 'generate_image') {
            const variation = sceneVariations[variationIdx] ?? sceneBase;
            variationIdx++;
            return { ...step, params: { ...step.params, scene_description: variation } };
          }
          return step;
        });

        // loraModel already set in context from extraction block
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

        const loraFinalContext = {
          ...loraResult.finalContext,
          ...(jobIds.length > 0 ? { jobIds } : {}),
        };

        return NextResponse.json({
          message: `Генерирую 4 сцены с лицом ${faceName}: "${sceneBase}"\n\n${progressLines.join('\n')}${jobIds.length > 0 ? `\n\n🎬 Анимирую ${jobIds.length} сцен через Kling (~2-3 мин)` : ''}`,
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
          ...(faceMode === 'lora' ? { loraModel: FACE_REGISTRY['ANNA']?.loraModel ?? '', loraTriggerWord: FACE_REGISTRY['ANNA']?.triggerWord ?? null } : {}),
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
          ...(context.faceMode === 'lora' ? { loraModel: context.loraModel ?? FACE_REGISTRY['ANNA']?.loraModel ?? '', loraTriggerWord: context.loraTriggerWord ?? FACE_REGISTRY['ANNA']?.triggerWord ?? null } : {}),
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

    // Use Ollama-built English prompt when available; keep languageInstruction for response language
    const promptForClaude = extracted.claude_prompt
      ? extracted.claude_prompt + audioContext + languageInstruction + stateInstruction
      : message + audioContext + languageInstruction + stateInstruction;

    const decision = await getAgentDecision(
      promptForClaude,
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

        // Ensure loraModel is in context when agent routes to lora_ad_clip
        const annaEntry = FACE_REGISTRY['ANNA'];
        const comboContext = decision.comboId === 'lora_ad_clip' && !context.loraModel && annaEntry?.loraModel
          ? { ...context, loraModel: annaEntry.loraModel, loraTriggerWord: annaEntry.triggerWord ?? null }
          : context;

        // Inject Claude-generated continuity scenes into lora_ad_clip steps
        let stepsToRun = combo.steps;
        if (decision.comboId === 'lora_ad_clip' && decision.movieScript?.length) {
          let sceneIdx = 0;
          stepsToRun = combo.steps.map((step) => {
            if (step.tool === 'generate_image' && step.params?.use_lora && decision.movieScript![sceneIdx]) {
              const enriched = { ...step, params: { ...step.params, scene_description: decision.movieScript![sceneIdx].description } };
              sceneIdx++;
              return enriched;
            }
            return step;
          });
        }

        const comboResult = await executeCombo(stepsToRun, subject, comboContext, cookieHeader);

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
