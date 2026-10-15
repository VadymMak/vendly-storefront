'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBrandKitForm } from '@/hooks/useBrandKitForm';
import { BrandKitPreview } from '@/components/studio/BrandKitPreview';
import { BrandKitFormSections, BrandKitSaveBar } from '@/components/studio/settings/BrandKitFormSections';

export function MobileBrandKitSettings() {
  const t = useTranslations('settings.brandKit');
  const tSettings = useTranslations('settings');
  const router = useRouter();
  const form = useBrandKitForm();

  return (
    <div className="flex flex-col pb-44" style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-gray-400"
          aria-label={t('back')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-base font-semibold text-white">{tSettings('myBrand')}</span>
      </div>

      {form.loading ? (
        <div className="space-y-4 px-4" aria-busy="true">
          <div className="mx-auto aspect-[9/16] w-full max-w-[160px] animate-pulse rounded-2xl bg-white/[0.06]" />
          {[0, 1, 2].map(i => <div key={i} className="h-32 animate-pulse rounded-xl bg-white/[0.04]" />)}
        </div>
      ) : form.loadFailed ? (
        <div className="mx-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-4 text-center">
          <p className="text-sm text-red-400">{t('loadFailed')}</p>
          <button onClick={() => void form.retry()} className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm text-white">{t('retry')}</button>
        </div>
      ) : (
        <>
          <div className="px-4 pb-6">
            <BrandKitPreview brandKit={form.draft} size="sm" />
            <p className="mt-2 text-center text-[11px] text-gray-500">{t('previewHint')}</p>
          </div>
          <div className="px-4">
            <BrandKitFormSections form={form} />
          </div>

          {/* Fixed save — above the bottom nav */}
          <div className="fixed right-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 z-40 bg-gradient-to-t from-[#0a0a0f] from-70% to-transparent px-4 pt-6 pb-2">
            <div className="mx-auto max-w-lg">
              <BrandKitSaveBar form={form} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
