import { streamText, tool, isStepCount, UIMessage, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateEmbedding } from '@/lib/kb/embedding';
import { hybridSearch } from '@/lib/kb/search';
import { trackKbGap, saveKbInteractionToBrain } from '@/lib/kb/learning';
import { getOrCreateCredits, isSuperuser } from '@/lib/credits';
import { getBrainStudioContext } from '@/lib/studio/brain-client';
import { executeTool } from '@/lib/studio/tool-executor';
import type { SessionContext } from '@/lib/studio/types';
import { getToolsForPage } from '@/lib/studio/chat-tools';
import { MODEL_CATALOG, getVideoCreditCost } from '@/lib/studio/config';
import {
  SKILL_CORE,
  SKILL_GENERATION,
  SKILL_VIDEO,
  SKILL_TIMELINE,
  SKILL_CREDITS,
  SKILL_COST_GATE,
  PAGE_CAPABILITIES,
} from '@/lib/studio/chat-skills';
import { NextRequest } from 'next/server';

// === Rate limiter (in-memory, per user) ===
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_MINUTE) return false;
  entry.count++;
  return true;
}

function extractTextFromMessage(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}

interface TimelineClipSnapshot {
  id: string;
  trackId: string;
  type: string;
  sourceUrl: string;
  startTime: number;
  duration: number;
  label?: string;
}

interface TimelineTrackSnapshot {
  id: string;
  type: string;
  clips: TimelineClipSnapshot[];
}

interface KbChatRequestBody {
  messages: UIMessage[];
  sessionId: string;
  currentPage?: string;
  errorContext?: string;
  language?: string;
  timelineState?: { tracks: TimelineTrackSnapshot[] };
  lastGeneratedImageUrl?: string | null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;

  if (!checkRateLimit(userId)) {
    return new Response('Too many requests', { status: 429 });
  }

  const cookieHeader = req.headers.get('cookie') ?? '';
  const body = (await req.json()) as KbChatRequestBody;
  const { messages, sessionId, currentPage, errorContext, language, timelineState, lastGeneratedImageUrl } = body;

  if (!messages?.length || !sessionId) {
    return new Response('Bad request', { status: 400 });
  }

  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage) {
    return new Response('No user message', { status: 400 });
  }

  const lastUserText = extractTextFromMessage(lastUserMessage);

  await db.chatMessage.create({
    data: { sessionId, userId, role: 'user', content: lastUserText },
  });

  const [credits, user, recentJobs, superuser] = await Promise.all([
    getOrCreateCredits(userId),
    db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, plan: true, uiLanguage: true },
    }),
    db.studioJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, type: true, status: true, error: true, createdAt: true, creditType: true, creditAmount: true },
    }),
    isSuperuser(userId),
  ]);

  const page = currentPage ?? 'home';
  const pageToolNames = getToolsForPage(page);
  const pageToolSet = new Set(pageToolNames);

  // ── Dynamic system prompt from composable skill blocks ──────────────────────
  const skills: string[] = [SKILL_CORE, SKILL_CREDITS, SKILL_COST_GATE];

  if (pageToolNames.some(t => ['generate_image', 'remove_background', 'upscale'].includes(t))) {
    skills.push(SKILL_GENERATION);
  }
  if (pageToolSet.has('generate_video')) {
    skills.push(SKILL_VIDEO);
  }
  if (pageToolSet.has('get_timeline')) {
    skills.push(SKILL_TIMELINE);
  }

  const userContextBlock = [
    `## User context`,
    `- Plan: ${credits.planType}${superuser ? ' (superuser — unlimited)' : ''}`,
    `- Image credits: ${credits.monthlyImages} monthly + ${credits.bonusImages} bonus`,
    `- Video credits: ${credits.monthlyVideos} monthly + ${credits.bonusVideos} bonus`,
    `- BYOK enabled: ${credits.byokEnabled}`,
    `- UI language: ${user?.uiLanguage || language || 'en'}`,
    currentPage ? `- Currently viewing: ${currentPage} tool` : '',
    errorContext ? `- User just saw this error: "${errorContext}"` : '',
    recentJobs.length > 0
      ? `- Recent jobs: ${recentJobs.map(j => `${j.type}(${j.status}${j.error ? ', error: ' + j.error.slice(0, 80) : ''})`).join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  const brainContext = superuser
    ? await getBrainStudioContext(lastUserText)
    : '';

  const pageCapability = PAGE_CAPABILITIES[page] ?? PAGE_CAPABILITIES['home'];

  const systemPrompt = [
    ...skills,
    `\nCurrent page: ${page}`,
    pageCapability,
    userContextBlock,
    brainContext ? `## Relevant context from previous sessions\n${brainContext}` : '',
  ].filter(Boolean).join('\n\n');

  // ── All tools — filtered per page at the bottom ──────────────────────────────
  const allTools = {
    searchDocs: tool({
      description: 'Search the VendShop AI Studio knowledge base for documentation about features, pricing, troubleshooting, workflows, and how-to guides. ALWAYS call this before answering any factual question.',
      inputSchema: z.object({
        query: z.string().describe('Search query — rephrase the user question as a concise search phrase in English'),
      }),
      execute: async ({ query }: { query: string }) => {
        const queryEmbedding = await generateEmbedding(query);
        const results = await hybridSearch(queryEmbedding, query, 5);
        if (results.length === 0) {
          trackKbGap({ sessionId, userId, question: lastUserText, searchQuery: query })
            .catch(() => {});
          return { found: false, message: 'No matching documentation found.' };
        }
        return {
          found: true,
          results: results.map(r => ({
            title: r.title,
            heading: r.heading,
            content: r.content,
            score: Math.round(r.score * 1000) / 1000,
          })),
        };
      },
    }),

    getUserCredits: tool({
      description: "Get the current user's credit balance, plan type, and usage. Use BEFORE any expensive operation (≥4 credits) to verify the user can afford it.",
      inputSchema: z.object({}),
      execute: async () => ({
        plan: credits.planType,
        monthlyImages: credits.monthlyImages,
        monthlyVideos: credits.monthlyVideos,
        bonusImages: credits.bonusImages,
        bonusVideos: credits.bonusVideos,
        byokEnabled: credits.byokEnabled,
        totalGeneratedImages: credits.totalGeneratedImages,
        totalGeneratedVideos: credits.totalGeneratedVideos,
        lastReset: credits.lastReset.toISOString(),
        isSuperuser: superuser,
        costReference: {
          image_quick:    MODEL_CATALOG['fal-schnell']?.creditCost ?? 1,
          image_best:     MODEL_CATALOG['fal-dev']?.creditCost ?? 2,
          image_hd:       MODEL_CATALOG['img-premium']?.creditCost ?? 3,
          video_quick_5s: getVideoCreditCost('vid-quick', 5),
          video_quick_10s: getVideoCreditCost('vid-quick', 10),
          video_quick_15s: getVideoCreditCost('vid-quick', 15),
          video_best_5s:  getVideoCreditCost('vid-best', 5),
          video_best_10s: getVideoCreditCost('vid-best', 10),
          video_best_15s: getVideoCreditCost('vid-best', 15),
          animate:        getVideoCreditCost('vid-animate', 5),
          remove_bg:      1,
          upscale:        1,
          auto_caption:   1,
        },
      }),
    }),

    getRecentJobs: tool({
      description: "Get the user's recent generation jobs with status and errors. Use when the user asks about their recent generations, why something failed, or job history.",
      inputSchema: z.object({
        limit: z.number().min(1).max(20).default(10).describe('Number of recent jobs to return'),
      }),
      execute: async ({ limit }: { limit: number }) => {
        const jobs = await db.studioJob.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true, type: true, status: true, error: true,
            creditType: true, creditAmount: true, creditDeducted: true,
            createdAt: true, metadata: true,
          },
        });
        return {
          totalJobs: jobs.length,
          jobs: jobs.map(j => ({
            id: j.id,
            type: j.type,
            status: j.status,
            error: j.error,
            credits: `${j.creditAmount} ${j.creditType || 'image'}`,
            creditDeducted: j.creditDeducted,
            createdAt: j.createdAt.toISOString(),
          })),
        };
      },
    }),

    getJobDiagnostics: tool({
      description: "Get detailed diagnostics for a specific failed job. Use when the user mentions a specific error or asks why a particular generation failed.",
      inputSchema: z.object({
        jobId: z.string().describe("The job ID to diagnose. If user doesn't provide one, use getRecentJobs first to find the latest failed job."),
      }),
      execute: async ({ jobId }: { jobId: string }) => {
        const job = await db.studioJob.findFirst({
          where: { id: jobId, userId },
          select: {
            id: true, type: true, status: true, error: true,
            creditType: true, creditAmount: true, creditDeducted: true,
            metadata: true, createdAt: true, updatedAt: true,
          },
        });
        if (!job) {
          return { found: false, message: 'Job not found or not owned by current user.' };
        }
        return {
          found: true,
          job: { ...job, createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString() },
        };
      },
    }),

    openStudioTool: tool({
      description: 'Navigate the user directly to a specific Studio tool or page. Use when the user asks to open, go to, or try a specific tool. Returns a navigation action that renders as a clickable button in the chat.',
      inputSchema: z.object({
        toolName: z.enum(['home', 'generate-image', 'generate-video', 'assemble', 'library', 'pricing', 'settings'])
          .describe('The Studio page to open: home=main dashboard, generate-image=image generator, generate-video=video/animation generator, assemble=video editor, library=saved files, pricing=plans & pricing, settings=account settings'),
      }),
      execute: async ({ toolName }: { toolName: string }) => {
        const destinations: Record<string, { path: string; label: string }> = {
          'home':            { path: '/studio',          label: 'Studio Home' },
          'generate-image':  { path: '/studio/generate', label: 'Generate Image' },
          'generate-video':  { path: '/studio/animate',  label: 'Generate Video' },
          'assemble':        { path: '/studio/assemble', label: 'Video Editor' },
          'library':         { path: '/studio/library',  label: 'My Library' },
          'pricing':         { path: '/studio/pricing',  label: 'Plans & Pricing' },
          'settings':        { path: '/studio/settings', label: 'Settings' },
        };
        const dest = destinations[toolName] ?? destinations['home'];
        return { action: 'navigate', path: dest.path, label: dest.label };
      },
    }),

    checkToolAvailability: tool({
      description: "Check whether a specific Studio tool is available for the current user based on their plan and remaining credits. Use when the user asks 'can I use X?' or 'do I have access to Y?'",
      inputSchema: z.object({
        toolName: z.string().describe("The tool or feature to check, e.g. 'video generation', 'BYOK', 'background removal', 'image generation'"),
      }),
      execute: async ({ toolName }: { toolName: string }) => {
        const lower = toolName.toLowerCase();
        const isVideo = lower.includes('video') || lower.includes('animat');
        const isByok = lower.includes('byok') || lower.includes('api key') || lower.includes('own key');

        if (isByok) {
          return {
            available: credits.byokEnabled || superuser,
            plan: credits.planType,
            note: credits.byokEnabled
              ? 'BYOK is enabled — you can generate with your own API keys.'
              : 'BYOK Creator plan (€7/mo) unlocks unlimited generation with your own API keys.',
          };
        }

        if (isVideo) {
          const total = credits.monthlyVideos + credits.bonusVideos;
          const available = total > 0 || superuser || credits.byokEnabled;
          return {
            available,
            videoCredits: total,
            plan: credits.planType,
            note: !available
              ? 'No video credits remaining. Upgrade to Starter (€12/mo, 50 video credits) or Pro (€29/mo, 200 video credits), or enable BYOK.'
              : null,
          };
        }

        const total = credits.monthlyImages + credits.bonusImages;
        const available = total > 0 || superuser || credits.byokEnabled;
        return {
          available,
          imageCredits: total,
          plan: credits.planType,
          note: !available
            ? 'No image credits remaining. They reset monthly, or upgrade your plan for more.'
            : null,
        };
      },
    }),

    suggestWorkflow: tool({
      description: 'Suggest a step-by-step workflow for accomplishing a creative goal with Studio tools. Returns a navigation action pointing to the most relevant tool. Use when the user describes a creative goal like "I want to create a product video" or "help me edit my photos".',
      inputSchema: z.object({
        goal: z.string().describe("The user's creative goal in English, e.g. 'create an animated product video' or 'remove background from product photo'"),
      }),
      execute: async ({ goal }: { goal: string }) => {
        const embedding = await generateEmbedding(goal);
        const docs = await hybridSearch(embedding, goal, 3);

        const lower = goal.toLowerCase();
        let path = '/studio';
        let label = 'Studio Home';

        if (lower.includes('video') || lower.includes('animat')) {
          path = '/studio/animate'; label = 'Generate Video';
        } else if (lower.includes('assemble') || lower.includes('edit') || lower.includes('clip') || lower.includes('timeline')) {
          path = '/studio/assemble'; label = 'Video Editor';
        } else if (lower.includes('image') || lower.includes('generate') || lower.includes('create') || lower.includes('background')) {
          path = '/studio/generate'; label = 'Generate Image';
        } else if (lower.includes('library') || lower.includes('saved') || lower.includes('download')) {
          path = '/studio/library'; label = 'My Library';
        }

        return {
          action: 'navigate',
          path,
          label,
          relatedDocs: docs.slice(0, 2).map(d => ({ title: d.title, heading: d.heading, excerpt: d.content.slice(0, 200) })),
        };
      },
    }),

    // ── Generation tools ──────────────────────────────────────────────────────
    generate_image: tool({
      description: 'Generate an image from a text prompt. Call this when the user asks to create, generate, or make an image.',
      inputSchema: z.object({
        prompt: z.string().describe('Detailed image description in English'),
        aspect_ratio: z.enum(['1:1', '9:16', '16:9', '4:3', '3:4']).default('1:1').describe('Image aspect ratio'),
      }),
      execute: async ({ prompt, aspect_ratio }: { prompt: string; aspect_ratio: string }) => {
        const ctx: SessionContext = { lastImageUrl: null, lastVideoUrl: null, lastAudioUrl: null, characterReferenceUrl: null };
        const result = await executeTool('generate_image', { prompt, aspect_ratio }, ctx, cookieHeader, userId);
        if (result.error) return { error: result.error };
        if (result.media) return { action: 'media_generated', type: 'image', url: result.media.url };
        return result;
      },
    }),

    remove_background: tool({
      description: 'Remove background from an image. Use the last generated image or an explicit URL.',
      inputSchema: z.object({
        imageUrl: z.string().optional().describe('URL of the image. If not provided, uses the last generated image.'),
      }),
      execute: async ({ imageUrl }: { imageUrl?: string }) => {
        const imgUrl = imageUrl || lastGeneratedImageUrl;
        if (!imgUrl) return { error: 'No image available. Generate an image first, then I can remove the background.' };
        const ctx: SessionContext = { lastImageUrl: imgUrl, lastVideoUrl: null, lastAudioUrl: null, characterReferenceUrl: null };
        const result = await executeTool('remove_background', {}, ctx, cookieHeader, userId);
        if (result.error) return { error: result.error };
        if (result.media) return { action: 'media_generated', type: 'image', url: result.media.url };
        return result;
      },
    }),

    upscale: tool({
      description: 'Upscale or enhance image quality. Use the last generated image or an explicit URL.',
      inputSchema: z.object({
        imageUrl: z.string().optional().describe('URL of the image. If not provided, uses the last generated image.'),
        type: z.enum(['upscale', 'portrait']).default('upscale'),
      }),
      execute: async ({ imageUrl, type }: { imageUrl?: string; type: string }) => {
        const imgUrl = imageUrl || lastGeneratedImageUrl;
        if (!imgUrl) return { error: 'No image available. Generate an image first, then I can upscale it.' };
        const ctx: SessionContext = { lastImageUrl: imgUrl, lastVideoUrl: null, lastAudioUrl: null, characterReferenceUrl: null };
        const result = await executeTool('upscale', { type }, ctx, cookieHeader, userId);
        if (result.error) return { error: result.error };
        if (result.media) return { action: 'media_generated', type: 'image', url: result.media.url };
        return result;
      },
    }),

    generate_video: tool({
      description: 'Generate a video from an image. Requires a source image URL. Cost: Quick tier 4-12 credits (5s/10s/15s), Best tier 10-28 credits. ALWAYS call getUserCredits first, tell the user the cost, and WAIT for their confirmation before calling this tool.',
      inputSchema: z.object({
        prompt: z.string().describe('Motion description, e.g. "slow zoom in, cinematic"'),
        imageUrl: z.string().optional().describe('Source image URL. Required if no image was previously generated.'),
        duration: z.enum(['5', '10']).default('5').describe('Video duration in seconds'),
        aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
      }),
      execute: async ({ prompt, imageUrl, duration, aspectRatio }: { prompt: string; imageUrl?: string; duration: string; aspectRatio: string }) => {
        const imgUrl = imageUrl || lastGeneratedImageUrl;
        if (!imgUrl) return { error: 'Please provide an image URL or generate an image first, then I can animate it.' };
        const ctx: SessionContext = { lastImageUrl: imgUrl, lastVideoUrl: null, lastAudioUrl: null, characterReferenceUrl: null };
        const result = await executeTool('image_to_video', { prompt, duration: Number(duration), aspectRatio }, ctx, cookieHeader, userId);
        if (result.error) return { error: result.error };
        return { action: 'video_job_started', jobId: result.jobId, message: result.message };
      },
    }),

    // ── Timeline tools (assemble page only) ───────────────────────────────────
    get_timeline: tool({
      description: 'Get the current timeline state. ALWAYS call this before modifying the timeline.',
      inputSchema: z.object({}),
      execute: async () => {
        const tracks = timelineState?.tracks ?? [];
        if (tracks.length === 0) return { tracks: [], message: 'The timeline is empty.' };
        const summary = tracks.map(t =>
          `Track "${t.id}" (${t.type}): ${t.clips.length} clip(s)${t.clips.length ? ' — ' + t.clips.map(c => `"${c.label || c.type}" at ${c.startTime}s (${c.duration}s)`).join(', ') : ''}`
        ).join('\n');
        return { tracks, summary };
      },
    }),

    add_clip: tool({
      description: 'Add a media clip to a track in the timeline.',
      inputSchema: z.object({
        trackId: z.string().describe('Track ID to add the clip to (from get_timeline)'),
        clipType: z.enum(['image', 'video', 'audio', 'text']),
        sourceUrl: z.string().describe('URL of the media'),
        startTime: z.number().min(0).describe('Start time in seconds'),
        duration: z.number().min(0.1).describe('Duration in seconds'),
        label: z.string().optional(),
      }),
      execute: async (args: { trackId: string; clipType: string; sourceUrl: string; startTime: number; duration: number; label?: string }) => ({
        action: 'timeline_command',
        command: 'addClipToTrack',
        args,
        message: `Adding ${args.clipType} clip to track "${args.trackId}" at ${args.startTime}s`,
      }),
    }),

    move_clip: tool({
      description: 'Move a clip to a different position or track.',
      inputSchema: z.object({
        clipId: z.string().describe('ID of the clip to move'),
        newTrackId: z.string().describe('Target track ID'),
        newStartTime: z.number().min(0).describe('New start time in seconds'),
      }),
      execute: async (args: { clipId: string; newTrackId: string; newStartTime: number }) => ({
        action: 'timeline_command',
        command: 'moveClip',
        args,
      }),
    }),

    trim_clip: tool({
      description: 'Trim a clip to change its start time and/or duration.',
      inputSchema: z.object({
        clipId: z.string(),
        newStartTime: z.number().min(0).describe('New start time in seconds'),
        newDuration: z.number().min(0.1).describe('New duration in seconds'),
      }),
      execute: async (args: { clipId: string; newStartTime: number; newDuration: number }) => ({
        action: 'timeline_command',
        command: 'trimClip',
        args,
      }),
    }),

    split_clip: tool({
      description: 'Split a clip into two at the given timeline time.',
      inputSchema: z.object({
        clipId: z.string(),
        splitTime: z.number().describe('Absolute timeline time in seconds to split at'),
      }),
      execute: async (args: { clipId: string; splitTime: number }) => ({
        action: 'timeline_command',
        command: 'splitClip',
        args,
      }),
    }),

    duplicate_clip: tool({
      description: 'Duplicate a clip (appended after original).',
      inputSchema: z.object({ clipId: z.string() }),
      execute: async (args: { clipId: string }) => ({
        action: 'timeline_command',
        command: 'duplicateClip',
        args,
      }),
    }),

    remove_clip: tool({
      description: 'Remove a clip from the timeline. ALWAYS confirm with the user before calling this.',
      inputSchema: z.object({ clipId: z.string().describe('ID of the clip to remove') }),
      execute: async (args: { clipId: string }) => ({
        action: 'timeline_command',
        command: 'removeClip',
        args,
      }),
    }),

    add_text_overlay: tool({
      description: 'Add a text overlay or title to the video.',
      inputSchema: z.object({
        text: z.string().describe('Text content'),
        startTime: z.number().min(0).describe('When the text appears (seconds)'),
        duration: z.number().min(0.5).describe('How long the text is visible (seconds)'),
        position: z.enum(['top', 'middle', 'bottom']).default('bottom'),
        style: z.enum(['title', 'subtitle', 'caption']).default('caption'),
      }),
      execute: async (args: { text: string; startTime: number; duration: number; position: string; style: string }) => ({
        action: 'timeline_command',
        command: 'addTextOverlay',
        args,
      }),
    }),

    set_playhead: tool({
      description: 'Move the playhead to a specific time position.',
      inputSchema: z.object({
        time: z.number().min(0).describe('Playhead position in seconds'),
      }),
      execute: async (args: { time: number }) => ({
        action: 'timeline_command',
        command: 'setPlayhead',
        args,
      }),
    }),

    auto_caption: tool({
      description: 'Automatically transcribe audio on the timeline and add synced text captions. Cost: 1 credit. Use when the user says "add captions", "subtitle this", "transcribe the audio", "add subtitles", etc.',
      inputSchema: z.object({
        style: z.enum(['subtitle', 'karaoke', 'word-by-word', 'sentence']).default('subtitle')
          .describe('Caption style: subtitle (classic), karaoke (typewriter), word-by-word (Instagram Reels pop), sentence (full sentences)'),
        language: z.string().optional().describe('ISO 639-1 language code (en, sk, uk, cs, de). Leave empty for auto-detect.'),
        wordsPerLine: z.number().min(2).max(8).default(4),
      }),
      execute: async ({ style, language, wordsPerLine }: { style: string; language?: string; wordsPerLine: number }) => ({
        action: 'auto_caption',
        args: { style, language, wordsPerLine },
        message: 'Starting auto-caption transcription...',
      }),
    }),
  };

  // Filter to only tools relevant for this page
  const tools = Object.fromEntries(
    Object.entries(allTools).filter(([name]) => pageToolSet.has(name))
  ) as typeof allTools;

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: isStepCount(8),
    temperature: 0.3,
    onEnd: async ({ text, steps }) => {
      if (text) {
        await db.chatMessage.create({
          data: { sessionId, userId, role: 'assistant', content: text },
        });

        const toolsUsed = steps
          .flatMap(s => (s.toolCalls as Array<{ toolName: string }>)?.map(tc => tc.toolName) ?? []);

        if (text.length > 50) {
          saveKbInteractionToBrain({ question: lastUserText, answer: text, toolsUsed });
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
