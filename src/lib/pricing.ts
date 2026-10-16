// ===== AI Studio pricing — THE single source of truth for credit costs and rate limits =====
// Every charge (consumeCredits), every UI label, the chat/help-bot prompts and the KB docs read
// these numbers. Pure data: safe to import from client and server code alike.
// Derived views kept for existing callers: MODEL_CATALOG.creditCost / creditsByDuration and
// getVideoCreditCost (src/lib/studio/config.ts), CREDIT_COSTS / REEL_CREDIT_COST
// (src/lib/constants.ts) and RATE_LIMITS (src/lib/rate-limit.ts).

export type OperationId =
  | 'image-quick' | 'image-best' | 'image-hd'
  | 'kontext-edit' | 'creative-edit' | 'ai-style'
  | 'inpaint' | 'remove-bg' | 'upscale' | 'ai-blend'
  | 'scene-compose' | 'reference-generate' | 'start-frame'
  | 'video-animate-5s' | 'video-animate-10s'
  | 'video-quick-5s' | 'video-quick-10s' | 'video-quick-15s'
  | 'video-best-5s' | 'video-best-10s' | 'video-best-15s'
  | 'reel-image' | 'reel-video'
  | 'transcribe' | 'voiceover' | 'talking-avatar' | 'lip-sync'
  | 'chat-lora-character' | 'chat-generate-character' | 'chat-transform-image';

export interface OperationCost {
  id: OperationId;
  /** Human-readable name, e.g. "Quick image" */
  label: string;
  /** 0 when the operation uses video credits */
  imageCredits: number;
  /** 0 when the operation uses image credits */
  videoCredits: number;
  /** Free plan can use it (Best / HD images are forced down to Quick for free users) */
  freeAllowed: boolean;
}

type CostRow = Omit<OperationCost, 'id'>;
const img = (label: string, imageCredits: number, freeAllowed = true): CostRow =>
  ({ label, imageCredits, videoCredits: 0, freeAllowed });
const vid = (label: string, videoCredits: number): CostRow =>
  ({ label, imageCredits: 0, videoCredits, freeAllowed: true });

const ROWS: Record<OperationId, CostRow> = {
  // Text → image tiers (studio/generate). Best is 2 whichever Best model runs (fal-dev, Grok, Flux Dev).
  'image-quick':  img('Quick image', 1),
  'image-best':   img('Best image', 2, false),
  'image-hd':     img('HD image', 3, false),
  // Editing
  'kontext-edit':  img('Kontext edit', 2),     // also the photo transform in studio/generate
  'creative-edit': img('Creative Edit', 2),
  'ai-style':      img('AI Style', 1),         // Improve's AI finish; the base presets are free
  'inpaint':       img('Change or remove', 2),
  'remove-bg':     img('Remove background', 1),
  'upscale':       img('Upscale', 1),          // /api/enhance-image: upscale, SUPIR, face enhance
  'ai-blend':      img('AI Blend', 1),
  'scene-compose': img('Scene', 1),
  'reference-generate': img('From reference', 1),
  'start-frame':   img('Start frame', 1),      // Animate text → video start frame
  // Video (video credits). Free plan has 0 video credits but may use pack credits / its free Best trial.
  'video-animate-5s':  vid('Animate 5s', 5),
  'video-animate-10s': vid('Animate 10s', 5),
  'video-quick-5s':    vid('Quick video 5s', 4),
  'video-quick-10s':   vid('Quick video 10s', 8),
  'video-quick-15s':   vid('Quick video 15s', 12),
  'video-best-5s':     vid('Best video 5s', 10),
  'video-best-10s':    vid('Best video 10s', 18),
  'video-best-15s':    vid('Best video 15s', 28),
  // Reels (run on the platform FAL key in reel-service — never free through BYOK)
  'reel-image': img('Photo reel', 2),
  'reel-video': vid('AI video reel', 5),
  // Audio / avatar
  'transcribe':     img('Auto-captions', 1),
  'voiceover':      img('Voiceover', 1),
  'talking-avatar': vid('Talking avatar', 1),
  'lip-sync':       vid('Lip sync', 1),        // /api/brain/lip-sync — same job as talking-avatar
  // Studio chat tools that call a provider themselves
  'chat-lora-character':     img('Character (trained face)', 1),
  'chat-generate-character': img('Character (consistent face)', 1),
  'chat-transform-image':    img('Transform image', 1),
};

export const OPERATION_COSTS: Record<OperationId, OperationCost> = Object.fromEntries(
  (Object.keys(ROWS) as OperationId[]).map((id) => [id, { id, ...ROWS[id] }]),
) as Record<OperationId, OperationCost>;

export type CreditKind = 'image' | 'video';

/** Image + video credits of an operation */
export function getOperationCost(opId: OperationId): { imageCredits: number; videoCredits: number } {
  const { imageCredits, videoCredits } = OPERATION_COSTS[opId];
  return { imageCredits, videoCredits };
}

/** The (type, amount) consumeCredits / checkCredits take — every operation uses one credit kind */
export function operationCharge(opId: OperationId): { type: CreditKind; amount: number } {
  const { imageCredits, videoCredits } = OPERATION_COSTS[opId];
  return videoCredits > 0 ? { type: 'video', amount: videoCredits } : { type: 'image', amount: imageCredits };
}

/** Short label for buttons: "2 cr", "5 vid cr", or "free" */
export function getCreditLabel(opId: OperationId): string {
  const { imageCredits, videoCredits } = OPERATION_COSTS[opId];
  if (imageCredits > 0 && videoCredits > 0) return `${imageCredits} img + ${videoCredits} vid`;
  if (videoCredits > 0) return `${videoCredits} vid cr`;
  if (imageCredits > 0) return `${imageCredits} cr`;
  return 'free';
}

/** Long label for editor buttons: "1 credit" / "2 credits" / "5 video credits" */
export function getCreditLabelLong(opId: OperationId): string {
  const { type, amount } = operationCharge(opId);
  if (amount === 0) return 'free';
  return `${amount} ${type === 'video' ? 'video ' : ''}credit${amount === 1 ? '' : 's'}`;
}

/** KB / prose form: "2 image credits", "1 video credit" */
export function creditText(opId: OperationId): string {
  const { type, amount } = operationCharge(opId);
  return `${amount} ${type} credit${amount === 1 ? '' : 's'}`;
}

/**
 * Fills pricing placeholders in KB markdown (scripts/ingest-kb.ts): {{cost:<op>}} → "2 image credits",
 * {{credits:<op>}} → "2". An unknown operation id throws, so a typo fails the ingest instead of
 * reaching the help bot.
 */
export function renderPricingPlaceholders(text: string): string {
  return text.replace(/\{\{(cost|credits):([a-z0-9-]+)\}\}/g, (_m, kind: string, id: string) => {
    if (!(id in OPERATION_COSTS)) throw new Error(`Unknown pricing operation in KB doc: ${id}`);
    const op = id as OperationId;
    return kind === 'cost' ? creditText(op) : String(operationCharge(op).amount);
  });
}

// ── Video durations → operations ────────────────────────────────────────────────

export type VideoCostFamily = 'animate' | 'quick' | 'best';

export const VIDEO_OPERATIONS: Record<VideoCostFamily, Partial<Record<number, OperationId>>> = {
  animate: { 5: 'video-animate-5s', 10: 'video-animate-10s' },
  quick:   { 5: 'video-quick-5s', 10: 'video-quick-10s', 15: 'video-quick-15s' },
  best:    { 5: 'video-best-5s', 10: 'video-best-10s', 15: 'video-best-15s' },
};

/** Video credits per duration of a family, e.g. quick → { 5: 4, 10: 8, 15: 12 } */
export function videoCreditsByDuration(family: VideoCostFamily): Record<number, number> {
  return Object.fromEntries(
    Object.entries(VIDEO_OPERATIONS[family]).map(([sec, op]) => [Number(sec), OPERATION_COSTS[op as OperationId].videoCredits]),
  );
}

// ── Rate limits (requests per window, per plan) ──────────────────────────────────

export type RateLimitPlan = 'free' | 'starter' | 'pro' | 'byok_creator';

export interface RateLimitConfig {
  free: number;
  starter: number;
  pro: number;
  /** Superuser-only plan (BYOK) */
  byok_creator: number;
  unit: 'minute' | 'hour' | 'day';
}

export const RATE_LIMIT_TABLE = {
  generateImage: { free: 5,  starter: 30,  pro: 80,  byok_creator: 200,  unit: 'hour' },
  generateVideo: { free: 1,  starter: 3,   pro: 10,  byok_creator: 50,   unit: 'hour' },
  aiEdit:        { free: 5,  starter: 30,  pro: 80,  byok_creator: 200,  unit: 'hour' },
  enhanceImage:  { free: 5,  starter: 30,  pro: 80,  byok_creator: 200,  unit: 'hour' },
  removeBg:      { free: 5,  starter: 30,  pro: 80,  byok_creator: 200,  unit: 'hour' },
  imageTools:    { free: 60, starter: 200, pro: 400, byok_creator: 1000, unit: 'hour' },
  // Help bot — gpt-4o on the platform key, no credit cost, so the hourly cap is the only brake
  kbChat:        { free: 3,  starter: 20,  pro: 50,  byok_creator: 50,   unit: 'hour' },
  // Prompt enhancer — Claude on the platform key
  enhancePrompt: { free: 5,  starter: 20,  pro: 50,  byok_creator: 50,   unit: 'hour' },
  // Studio chat agent — its tools charge credits separately
  studioChat:    { free: 5,  starter: 30,  pro: 100, byok_creator: 100,  unit: 'hour' },
} as const satisfies Record<string, RateLimitConfig>;

/** Per user, all plans — credits are the real cap; this stops bursts against FAL/Kling */
export const REEL_RATE_LIMIT = { hourly: 10, daily: 30 } as const;

/** Same for every plan */
export const FLAT_RATE_LIMITS = {
  register:   { max: 2, unit: 'day' },  // sign-ups per network
  buyCredits: { max: 5, unit: 'hour' },
} as const satisfies Record<string, { max: number; unit: RateLimitConfig['unit'] }>;

export const RATE_LIMIT_WINDOW_MS: Record<RateLimitConfig['unit'], number> = {
  minute: 60_000,
  hour:   60 * 60 * 1000,
  day:    24 * 60 * 60 * 1000,
};
