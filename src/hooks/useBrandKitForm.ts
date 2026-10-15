'use client';

import { useEffect, useState } from 'react';
import { useBrandKit } from '@/hooks/useBrandKit';
import { BRAND_KIT_DEFAULTS } from '@/lib/constants';
import type { BrandColors, BrandKitData, BrandKitSaveInput } from '@/lib/types';

/** Everything the Save button sends — logoUrl is excluded (only POST /logo sets it). */
function toSaveInput(d: BrandKitData): BrandKitSaveInput {
  return {
    businessName:      d.businessName,
    instagramHandle:   d.instagramHandle,
    ctaText:           d.ctaText,
    colorPrimary:      d.colorPrimary,
    colorSecondary:    d.colorSecondary,
    colorText:         d.colorText,
    fontPreset:        d.fontPreset,
    subtitlePreset:    d.subtitlePreset,
    watermarkEnabled:  d.watermarkEnabled,
    watermarkPosition: d.watermarkPosition,
    watermarkOpacity:  d.watermarkOpacity,
    watermarkScale:    d.watermarkScale,
    enabled:           d.enabled,
  };
}

/** Form state for the Brand Kit settings screens (mobile + desktop share it). */
export function useBrandKitForm() {
  const kit = useBrandKit();
  const [draft, setDraft] = useState<BrandKitData>(BRAND_KIT_DEFAULTS);
  const [suggested, setSuggested] = useState<BrandColors | null>(null);
  const [notice, setNotice] = useState<'saved' | 'noLogoColors' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [synced, setSynced] = useState<BrandKitData | null>(null);

  // First load fills the form; later reloads (after a save or logo upload) only bring the logo in,
  // so unsaved edits survive. Adjusted during render rather than in an effect.
  if (kit.brandKit && kit.brandKit !== synced) {
    const loaded = kit.brandKit;
    setDraft(synced === null ? loaded : d => ({ ...d, logoUrl: loaded.logoUrl }));
    setSynced(loaded);
  }

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  const dirty = kit.brandKit !== null
    && JSON.stringify(toSaveInput(draft)) !== JSON.stringify(toSaveInput(kit.brandKit));

  function setField<K extends keyof BrandKitData>(key: K, value: BrandKitData[K]) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  function applyColors(colors: BrandColors) {
    setDraft(d => ({ ...d, colorPrimary: colors.primary, colorSecondary: colors.secondary, colorText: colors.text }));
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    const result = await kit.uploadLogo(file);
    setUploading(false);
    if (result) setSuggested(result.suggestedColors);
  }

  async function resetToLogoColors() {
    const colors = await kit.extractLogoColors();
    if (colors) applyColors(colors);
    else setNotice('noLogoColors');
  }

  async function removeLogo() {
    await kit.save({ logoUrl: null });
  }

  async function save() {
    if (await kit.save(toSaveInput(draft))) setNotice('saved');
  }

  return {
    draft,
    setField,
    dirty,
    loading: kit.loading && kit.brandKit === null,
    loadFailed: !kit.loading && kit.brandKit === null,
    saving: kit.saving,
    uploading,
    error: kit.error,
    notice,
    suggested,
    acceptSuggested: () => { if (suggested) applyColors(suggested); setSuggested(null); },
    dismissSuggested: () => setSuggested(null),
    uploadLogo,
    removeLogo,
    resetToLogoColors,
    save,
    retry: kit.refresh,
  };
}

export type BrandKitForm = ReturnType<typeof useBrandKitForm>;
