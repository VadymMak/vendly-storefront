import type { ReelPhoto, ReelPhotoStatus, StudioWorkItem } from '@/lib/types';

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
