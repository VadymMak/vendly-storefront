'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { FONT_PRESETS } from '@/lib/constants';
import type { BrandColors, BrandKitData, BrandKitSaveInput, BrandLogoUploadResult } from '@/lib/types';

// One module-level store shared by every useBrandKit() caller (Settings, Assemble panel, Auto-Assemble),
// so a save in one place is seen everywhere without each component refetching.

interface BrandKitState {
  brandKit: BrandKitData | null;
  exists: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const INITIAL: BrandKitState = { brandKit: null, exists: false, loading: true, saving: false, error: null };

let state: BrandKitState = INITIAL;
const listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;

function setState(patch: Partial<BrandKitState>) {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null) as { error?: string } | null;
  return json?.error ?? fallback;
}

// ── One-time migration from the old Assemble store (src/lib/studio/brand-kit.ts) ──

const OLD_STORE_KEY = 'vendshop-brand-kit';
const MIGRATED_FLAG = 'vendshop-brand-kit-migrated';
const HEX = /^#[0-9A-Fa-f]{6}$/;

// The old store's untouched defaults — not worth carrying over as if the user chose them
const OLD_DEFAULTS: Record<string, string> = {
  primaryColor: '#16a34a', secondaryColor: '#0f172a', accentColor: '#f59e0b',
  fontFamily: 'Inter', defaultCta: 'Learn More',
};

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Old zustand-persist state → PUT body. Only fields the user actually changed. */
function mapOldBrand(old: Record<string, unknown>): BrandKitSaveInput {
  const out: BrandKitSaveInput = {};
  const changed = (key: string) => {
    const value = str(old[key]);
    return value && value !== OLD_DEFAULTS[key] ? value : null;
  };

  const businessName = changed('businessName');
  if (businessName) out.businessName = businessName.slice(0, 80);
  const cta = changed('defaultCta');
  if (cta) out.ctaText = cta.slice(0, 40);
  const primary = changed('primaryColor');
  if (primary && HEX.test(primary)) out.colorPrimary = primary;
  const secondary = changed('secondaryColor');
  if (secondary && HEX.test(secondary)) out.colorSecondary = secondary;
  // The old accent was the CTA text color in Auto-Assemble — the closest new field is colorText
  const accent = changed('accentColor');
  if (accent && HEX.test(accent)) out.colorText = accent;
  // Free font names → the preset that uses that font, if any
  const font = changed('fontFamily');
  const preset = FONT_PRESETS.find(p => p.fontFamily === font);
  if (preset) out.fontPreset = preset.id;

  return out;
}

async function migrateFromLocalStorage(): Promise<void> {
  let raw: string | null;
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    raw = localStorage.getItem(OLD_STORE_KEY);
  } catch {
    return; // storage blocked (private mode etc.)
  }
  if (!raw) return;

  let old: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    old = parsed.state ?? {};
  } catch {
    return;
  }
  // clearBrand() leaves isConfigured false — nothing the user set up
  if (!old.isConfigured) return;

  const body = mapOldBrand(old);
  const logoDataUrl = str(old.logoDataUrl);
  if (Object.keys(body).length === 0 && !logoDataUrl?.startsWith('data:image/')) return;

  if (Object.keys(body).length > 0) {
    const res = await fetch('/api/studio/brand-kit', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return; // retried on the next visit
    const json = await res.json() as { data: BrandKitData };
    setState({ brandKit: json.data, exists: true });
  }

  if (logoDataUrl?.startsWith('data:image/')) {
    try {
      const blob = await (await fetch(logoDataUrl)).blob();
      await uploadLogoRequest(new File([blob], 'migrated-logo', { type: blob.type || 'image/png' }));
    } catch (err) {
      console.warn('[BrandKit] logo migration failed:', err);
    }
  }

  // The old key stays as a backup; the flag stops a second import
  try { localStorage.setItem(MIGRATED_FLAG, new Date().toISOString()); } catch {}
  console.log('[BrandKit] migrated from localStorage');
}

// ── Requests ──────────────────────────────────────────────────────────────────

async function fetchBrandKit(): Promise<void> {
  try {
    const res = await fetch('/api/studio/brand-kit', { cache: 'no-store' });
    if (!res.ok) throw new Error(await readError(res, 'Failed to load brand kit'));
    const json = await res.json() as { exists: boolean; data: BrandKitData };
    setState({ brandKit: json.data, exists: json.exists, error: null });
    if (!json.exists) await migrateFromLocalStorage();
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : 'Failed to load brand kit' });
  } finally {
    setState({ loading: false });
  }
}

function load(force = false): Promise<void> {
  if (!loadPromise || force) loadPromise = fetchBrandKit();
  return loadPromise;
}

async function uploadLogoRequest(file: File): Promise<BrandLogoUploadResult> {
  const fd = new FormData();
  fd.append('logo', file);
  const res = await fetch('/api/studio/brand-kit/logo', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(await readError(res, 'Upload failed'));
  const json = await res.json() as BrandLogoUploadResult;
  // The server may have filled empty colors from the logo — reload the whole kit
  await load(true);
  return json;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseBrandKitReturn extends BrandKitState {
  save: (data: BrandKitSaveInput) => Promise<boolean>;
  uploadLogo: (file: File) => Promise<BrandLogoUploadResult | null>;
  /** Colors suggested from the current logo, or null if there is none / it can't be read */
  extractLogoColors: () => Promise<BrandColors | null>;
  refresh: () => Promise<void>;
}

export function useBrandKit(): UseBrandKitReturn {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => INITIAL);

  useEffect(() => { void load(); }, []);

  const save = useCallback(async (data: BrandKitSaveInput): Promise<boolean> => {
    setState({ saving: true, error: null });
    try {
      const res = await fetch('/api/studio/brand-kit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await readError(res, 'Save failed'));
      const json = await res.json() as { data: BrandKitData };
      setState({ brandKit: json.data, exists: true });
      return true;
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : 'Save failed' });
      return false;
    } finally {
      setState({ saving: false });
    }
  }, []);

  const uploadLogo = useCallback(async (file: File): Promise<BrandLogoUploadResult | null> => {
    setState({ saving: true, error: null });
    try {
      return await uploadLogoRequest(file);
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : 'Upload failed' });
      return null;
    } finally {
      setState({ saving: false });
    }
  }, []);

  const extractLogoColors = useCallback(async (): Promise<BrandColors | null> => {
    const res = await fetch('/api/studio/brand-kit/logo', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json() as { suggestedColors?: BrandColors };
    return json.suggestedColors ?? null;
  }, []);

  const refresh = useCallback(() => load(true), []);

  return { ...snapshot, save, uploadLogo, extractLogoColors, refresh };
}
