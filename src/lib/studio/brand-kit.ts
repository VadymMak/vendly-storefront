import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
