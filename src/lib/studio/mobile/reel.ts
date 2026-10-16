import type { ReelCtaLayout, ReelCtaLinePlacement, ReelPhoto, ReelPhotoStatus, StudioWorkItem } from '@/lib/types';
import { REEL_CTA_LAYOUT } from '@/lib/constants';

/** Reel Creator holds at most this many photos */
export const MAX_REEL_PHOTOS = 5;

const STORAGE_KEY = 'reel-photos';

// sessionStorage can throw (private mode, blocked storage) — the flow then just starts empty
export function readReelPhotos(): ReelPhoto[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ReelPhoto[]).slice(0, MAX_REEL_PHOTOS) : [];
  } catch {
    return [];
  }
}

export function writeReelPhotos(photos: ReelPhoto[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(photos.slice(0, MAX_REEL_PHOTOS)));
  } catch {
    // ignore — the next screen shows its empty state
  }
}

// Photos uploaded from the phone in this tab — no grid but the library's phone tab can show them
// (they aren't studio jobs), so they're kept here to survive Quality Check "+" and back-navigation
const PHONE_STORAGE_KEY = 'reel-phone-photos';
const MAX_PHONE_PHOTOS = 30;

/** True for photos uploaded from the phone on the library's phone tab */
export function isPhonePhoto(photo: ReelPhoto): boolean {
  return photo.id.startsWith('phone-');
}

export function readPhonePhotos(): ReelPhoto[] {
  try {
    const raw = sessionStorage.getItem(PHONE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ReelPhoto[]).slice(0, MAX_PHONE_PHOTOS) : [];
  } catch {
    return [];
  }
}

export function writePhonePhotos(photos: ReelPhoto[]): void {
  try {
    sessionStorage.setItem(PHONE_STORAGE_KEY, JSON.stringify(photos.slice(0, MAX_PHONE_PHOTOS)));
  } catch {
    // ignore — uploads then last only until the library unmounts
  }
}

const CTA_LAYOUT_STORAGE_KEY = 'reel-ctaLayout';

/** Valid lines of an untrusted ctaLayout (sessionStorage / request body): x, y 0–1, scale clamped */
export function sanitizeCtaLayout(raw: unknown): ReelCtaLayout {
  const out: ReelCtaLayout = {};
  if (!raw || typeof raw !== 'object') return out;
  const { min, max } = REEL_CTA_LAYOUT.placementScale;
  for (const key of ['line1', 'line2'] as const) {
    const v = (raw as Record<string, unknown>)[key] as Partial<Record<keyof ReelCtaLinePlacement, unknown>> | undefined;
    if (!v || typeof v !== 'object') continue;
    const { x, y, scale } = v;
    if (![x, y, scale].every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
    const r = (n: number) => Math.round(n * 10000) / 10000;
    out[key] = {
      x: r(Math.min(Math.max(x as number, 0), 1)),
      y: r(Math.min(Math.max(y as number, 0), 1)),
      scale: r(Math.min(Math.max(scale as number, min), max)),
    };
  }
  return out;
}

export function readCtaLayout(): ReelCtaLayout {
  try {
    const raw = sessionStorage.getItem(CTA_LAYOUT_STORAGE_KEY);
    return raw ? sanitizeCtaLayout(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function writeCtaLayout(layout: ReelCtaLayout): void {
  try {
    if (layout.line1 || layout.line2) sessionStorage.setItem(CTA_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    else sessionStorage.removeItem(CTA_LAYOUT_STORAGE_KEY);
  } catch {
    // ignore — the layout then lasts until the page unmounts
  }
}

export function reelPhotoFromWork(item: StudioWorkItem, source: ReelPhoto['source']): ReelPhoto {
  return { id: item.id, url: item.url, operation: item.operation, generationMode: item.generationMode, source };
}

// Phase 1: judged by how the image was made. Real appeal scoring (sharpness, contrast, YOLO) comes with reel-lab.
export function assessReelPhoto(photo: ReelPhoto): ReelPhotoStatus {
  if (photo.operation === 'ai-edit' || photo.operation === 'upscale') return 'green';
  // Generated from a text prompt — already a finished AI image
  if (photo.operation === 'image' && photo.generationMode === 'text_create') return 'green';
  // Uploaded photo restyled but never Improved, cutouts, and anything unknown
  return 'yellow';
}
