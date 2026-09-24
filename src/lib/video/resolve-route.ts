import type { VideoStyleChipId } from '@/lib/studio/constants';

export type VideoQualityTier = 'quick' | 'best';

export interface VideoRouteResult {
  provider: 'xai' | 'fal-t2v';
  qualityTier: VideoQualityTier;
  creditCost: number;
  reason: string;
}

const PREMIUM_STYLES: VideoStyleChipId[] = ['product', 'food', 'beauty', 'space', 'service', 'hospitality', 'fashion'];

const QUICK_CREDITS: Record<number, number> = { 5: 4, 10: 8, 15: 12 };
const BEST_CREDITS:  Record<number, number> = { 5: 10, 10: 18, 15: 28 };

export function resolveTextToVideoRoute(input: {
  style: VideoStyleChipId;
  quality: VideoQualityTier;
  durationSeconds: 5 | 10 | 15;
  planType: string;
  isSuperuser: boolean;
  byokEnabled: boolean;
  isFirstVideoEver: boolean;
  availableVideoCredits: number;
}): VideoRouteResult {
  const { style, quality, durationSeconds, planType, isSuperuser, byokEnabled, isFirstVideoEver, availableVideoCredits } = input;

  if (isSuperuser) {
    return {
      provider:    quality === 'best' ? 'fal-t2v' : 'xai',
      qualityTier: quality,
      creditCost:  0,
      reason:      'superuser_unlimited',
    };
  }

  if (planType === 'free') {
    if (isFirstVideoEver && quality === 'best') {
      return {
        provider:    'fal-t2v',
        qualityTier: 'best',
        creditCost:  0,
        reason:      'first_video_premium_trial',
      };
    }
    return {
      provider:    'xai',
      qualityTier: 'quick',
      creditCost:  QUICK_CREDITS[durationSeconds] ?? 4,
      reason:      'free_plan_grok_only',
    };
  }

  if (byokEnabled) {
    return {
      provider:    quality === 'best' ? 'fal-t2v' : 'xai',
      qualityTier: quality,
      creditCost:  0,
      reason:      'byok_own_keys',
    };
  }

  if (quality === 'best') {
    const cost = BEST_CREDITS[durationSeconds] ?? 10;
    if (availableVideoCredits < cost) {
      return {
        provider:    'xai',
        qualityTier: 'quick',
        creditCost:  QUICK_CREDITS[durationSeconds] ?? 4,
        reason:      'insufficient_credits_fallback_quick',
      };
    }
    return {
      provider:    'fal-t2v',
      qualityTier: 'best',
      creditCost:  cost,
      reason:      PREMIUM_STYLES.includes(style)
        ? 'style_optimized_premium'
        : 'user_selected_premium',
    };
  }

  return {
    provider:    'xai',
    qualityTier: 'quick',
    creditCost:  QUICK_CREDITS[durationSeconds] ?? 4,
    reason:      'quick_route',
  };
}

export function getDefaultQuality(style: VideoStyleChipId, planType: string): VideoQualityTier {
  if (planType === 'free') return 'quick';
  if (PREMIUM_STYLES.includes(style)) return 'best';
  return 'quick';
}
