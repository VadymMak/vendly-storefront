/**
 * @deprecated PROMPT-253: the Brand Kit lives in the database now — use `useBrandKit()` from
 * `@/hooks/useBrandKit` (GET/PUT /api/studio/brand-kit). This localStorage store is no longer read by
 * any component; `useBrandKit` imports it once and keeps the key as a backup. The `BrandKit` type and
 * `toAssemblerBrandKit` stay: the Auto-Assemble timeline solver still consumes this shape.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FONT_PRESETS } from '@/lib/constants';
import type { BrandKitData } from '@/lib/types';

export interface BrandKit {
  businessName: string;
  logoDataUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  defaultCta: string;
  contactInfo: string;
}

interface BrandKitStore extends BrandKit {
  updateBrand: (partial: Partial<BrandKit>) => void;
  setLogo: (dataUrl: string | null) => void;
  clearBrand: () => void;
  isConfigured: boolean;
}

const DEFAULT_BRAND: BrandKit = {
  businessName: '',
  logoDataUrl: null,
  primaryColor: '#16a34a',
  secondaryColor: '#0f172a',
  accentColor: '#f59e0b',
  fontFamily: 'Inter',
  defaultCta: 'Learn More',
  contactInfo: '',
};

/** @deprecated use `useBrandKit()` from `@/hooks/useBrandKit` */
export const useBrandKitStore = create<BrandKitStore>()(
  persist(
    (set) => ({
      ...DEFAULT_BRAND,
      isConfigured: false,

      updateBrand: (partial) =>
        set((s) => ({ ...s, ...partial, isConfigured: true })),

      setLogo: (dataUrl) => set({ logoDataUrl: dataUrl, isConfigured: true }),

      clearBrand: () => set({ ...DEFAULT_BRAND, isConfigured: false }),
    }),
    {
      name: 'vendshop-brand-kit',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { updateBrand: _1, setLogo: _2, clearBrand: _3, ...data } = s;
        return data;
      },
    }
  )
);

/** Database Brand Kit → the shape the Auto-Assemble timeline solver reads. */
export function toAssemblerBrandKit(data: BrandKitData): BrandKit {
  return {
    businessName:   data.businessName,
    logoDataUrl:    data.logoUrl,
    primaryColor:   data.colorPrimary,
    secondaryColor: data.colorSecondary,
    // The solver colors the CTA text with accentColor
    accentColor:    data.colorText,
    fontFamily:     FONT_PRESETS.find(p => p.id === data.fontPreset)?.fontFamily ?? 'Inter',
    defaultCta:     data.ctaText,
    contactInfo:    data.instagramHandle ? `@${data.instagramHandle}` : '',
  };
}
