// ── Provider abstraction types ────────────────────────────────────────────────

export interface ImageGenerateRequest {
  prompt: string;
  aspectRatio?: string;
  megapixels?: string;
  outputFormat?: 'webp' | 'png' | 'jpeg';
  referenceImage?: string; // for redux/variation models
}

export interface ImageEditRequest {
  prompt: string;
  imageUrl: string; // public URL already uploaded to blob storage
}

export interface MediaResult {
  url: string;
}

export interface ImageProvider {
  generate(req: ImageGenerateRequest, apiKey: string, modelId: string): Promise<MediaResult>;
  edit?(req: ImageEditRequest, apiKey: string, modelId: string): Promise<MediaResult>;
}

// ── Catalog types ─────────────────────────────────────────────────────────────

export type OperationType = 'generate' | 'edit' | 'upscale' | 'remove-bg' | 'video';
export type ProviderName  = 'replicate' | 'xai' | 'bfl' | 'fal';
export type ModelTier     = 'fast' | 'quality' | 'premium';

export interface ModelEntry {
  displayName:      string;
  provider:         ProviderName;
  modelId:          string;
  operation:        OperationType;
  tier:             ModelTier;
  costPerCall:      number;
  creditCost:       number;
  creditType:       'image' | 'video';
  apiKeyProvider:   string;
  envKeyName?:      string;
  byokOnly?:        boolean;
  supportedRatios?: string[];
  maxInputSize?:    number;
  enabled:          boolean;
}

// ── MODEL_CATALOG — single source of truth ───────────────────────────────────

export const MODEL_CATALOG: Record<string, ModelEntry> = {
  // ── Image Generation ──────────────────────────────────────────────────────
  'img-fast': {
    displayName:    'Flux Schnell (Fast)',
    provider:       'replicate',
    modelId:        'black-forest-labs/flux-schnell',
    operation:      'generate',
    tier:           'fast',
    costPerCall:    0.003,
    creditCost:     1,
    creditType:     'image',
    apiKeyProvider: 'replicate',
    envKeyName:     'REPLICATE_API_TOKEN',
    supportedRatios: ['1:1', '16:9', '9:16', '4:5', '3:2', '2:3', '4:3', '3:4'],
    enabled: true,
  },
  'img-quality': {
    displayName:    'Flux Dev (Quality)',
    provider:       'replicate',
    modelId:        'black-forest-labs/flux-dev',
    operation:      'generate',
    tier:           'quality',
    costPerCall:    0.03,
    creditCost:     2,
    creditType:     'image',
    apiKeyProvider: 'replicate',
    envKeyName:     'REPLICATE_API_TOKEN',
    supportedRatios: ['1:1', '16:9', '9:16', '4:5', '3:2', '2:3', '4:3', '3:4'],
    enabled: true,
  },
  'img-premium': {
    displayName:    'Flux Pro (Premium)',
    provider:       'bfl',
    modelId:        'flux-pro-1.1',
    operation:      'generate',
    tier:           'premium',
    costPerCall:    0.05,
    creditCost:     3,
    creditType:     'image',
    apiKeyProvider: 'bfl',
    envKeyName:     'BFL_API_KEY',
    supportedRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    enabled: true,
  },
  'img-grok': {
    displayName:    'Grok Imagine',
    provider:       'xai',
    modelId:        'grok-imagine-image-2.0',
    operation:      'generate',
    tier:           'quality',
    costPerCall:    0.0,
    creditCost:     0,
    creditType:     'image',
    apiKeyProvider: 'xai',
    byokOnly:       true,
    supportedRatios: ['1:1', '16:9', '9:16', '4:5', '3:2', '2:3', '4:3', '3:4'],
    enabled: true,
  },
  'img-redux': {
    displayName:    'Flux Redux',
    provider:       'replicate',
    modelId:        'black-forest-labs/flux-redux-schnell',
    operation:      'generate',
    tier:           'fast',
    costPerCall:    0.003,
    creditCost:     1,
    creditType:     'image',
    apiKeyProvider: 'replicate',
    envKeyName:     'REPLICATE_API_TOKEN',
    enabled: true,
  },

  // ── fal.ai Image Generation ───────────────────────────────────────────────
  'fal-schnell': {
    displayName:    'Flux Schnell (fal)',
    provider:       'fal',
    modelId:        'fal-ai/flux/schnell',
    operation:      'generate',
    tier:           'fast',
    costPerCall:    0.003,
    creditCost:     1,
    creditType:     'image',
    apiKeyProvider: 'fal',
    envKeyName:     'FAL_KEY',
    supportedRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '4:5', '3:2', '2:3'],
    enabled: true,
  },
  'fal-dev': {
    displayName:    'FLUX.2 Dev (fal)',
    provider:       'fal',
    modelId:        'fal-ai/flux-2/dev',
    operation:      'generate',
    tier:           'quality',
    costPerCall:    0.012,
    creditCost:     1,
    creditType:     'image',
    apiKeyProvider: 'fal',
    envKeyName:     'FAL_KEY',
    supportedRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '4:5', '3:2', '2:3'],
    enabled: true,
  },

  // ── fal.ai Image Editing ──────────────────────────────────────────────────
  'fal-kontext': {
    displayName:    'Flux Kontext Pro (fal)',
    provider:       'fal',
    modelId:        'fal-ai/flux-kontext/pro',
    operation:      'edit',
    tier:           'quality',
    costPerCall:    0.025,
    creditCost:     2,
    creditType:     'image',
    apiKeyProvider: 'fal',
    envKeyName:     'FAL_KEY',
    maxInputSize:   1024,
    enabled: true,
  },

  // ── Image Editing ─────────────────────────────────────────────────────────
  'edit-kontext': {
    displayName:    'Flux Kontext Pro',
    provider:       'replicate',
    modelId:        'black-forest-labs/flux-kontext-pro',
    operation:      'edit',
    tier:           'quality',
    costPerCall:    0.03,
    creditCost:     2,
    creditType:     'image',
    apiKeyProvider: 'replicate',
    envKeyName:     'REPLICATE_API_TOKEN',
    maxInputSize:   1024,
    enabled: true,
  },
  'edit-grok': {
    displayName:    'Grok Edit',
    provider:       'xai',
    modelId:        'grok-imagine-image-2.0',
    operation:      'edit',
    tier:           'quality',
    costPerCall:    0.0,
    creditCost:     0,
    creditType:     'image',
    apiKeyProvider: 'xai',
    byokOnly:       true,
    maxInputSize:   1024,
    enabled: true,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getModel(alias: string): ModelEntry | undefined {
  return MODEL_CATALOG[alias];
}

export function getModelsForOperation(op: OperationType): [string, ModelEntry][] {
  return Object.entries(MODEL_CATALOG).filter(([, m]) => m.operation === op && m.enabled);
}

/** Map from legacy UI provider strings to MODEL_CATALOG aliases */
export const LEGACY_GENERATE_ALIAS: Record<string, string> = {
  'flux':        'img-fast',
  'schnell':     'img-fast',
  'flux-dev':    'img-quality',
  'dev':         'img-quality',
  'flux-pro':    'img-premium',
  'pro':         'img-premium',
  'flux-redux':  'img-redux',
  'grok':        'img-grok',
  'fal-schnell': 'fal-schnell',
  'fal-dev':     'fal-dev',
};

export const LEGACY_EDIT_ALIAS: Record<string, string> = {
  'flux':        'edit-kontext',
  'grok':        'edit-grok',
  'fal-kontext': 'fal-kontext',
};

// ── Tier routing — ordered by preference (cheapest first, then fallback) ─────

export interface TierRoute {
  alias:    string;
  priority: number;
}

export const TIER_ROUTES: Record<ModelTier, TierRoute[]> = {
  fast: [
    { alias: 'fal-schnell', priority: 1 },
    { alias: 'img-fast',    priority: 2 },
  ],
  quality: [
    { alias: 'fal-dev',     priority: 1 },
    { alias: 'img-quality', priority: 2 },
    { alias: 'img-grok',    priority: 3 },
  ],
  premium: [
    { alias: 'img-premium', priority: 1 },
  ],
};

export const TIER_INFO: Record<ModelTier, { label: string; description: string; creditCost: number; estimatedSeconds: string }> = {
  fast:    { label: 'Quick', description: 'Fast draft',     creditCost: 1, estimatedSeconds: '~3s'  },
  quality: { label: 'Best',  description: 'Recommended',   creditCost: 2, estimatedSeconds: '~8s'  },
  premium: { label: 'HD',    description: 'Highest detail', creditCost: 3, estimatedSeconds: '~15s' },
};
