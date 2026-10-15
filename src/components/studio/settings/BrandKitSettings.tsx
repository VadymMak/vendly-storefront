'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useBrandKitForm } from '@/hooks/useBrandKitForm';
import { BrandKitPreview } from '@/components/studio/BrandKitPreview';
import { BrandKitFormSections, BrandKitSaveBar } from './BrandKitFormSections';

/** Desktop Brand Kit settings: form on the left, sticky live preview on the right. */
export function BrandKitSettings() {
  const t = useTranslations('settings.brandKit');
  const tSettings = useTranslations('settings');
  const form = useBrandKitForm();

  return (
    <div className="overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-1">
          <Link href="/studio/settings" className="text-sm text-gray-400 hover:text-white">← {t('back')}</Link>
          <h1 className="text-lg font-semibold text-white">{tSettings('myBrand')}</h1>
          <p className="text-sm text-gray-400">{t('sectionDesc')}</p>
        </div>

        {form.loading ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]" aria-busy="true">
            <div className="space-y-4">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-36 animate-pulse rounded-xl bg-white/[0.04]" />)}
            </div>
            <div className="mx-auto aspect-[9/16] w-full max-w-[280px] animate-pulse rounded-2xl bg-white/[0.06]" />
          </div>
        ) : form.loadFailed ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-400">{t('loadFailed')}</p>
            <button onClick={() => void form.retry()} className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">{t('retry')}</button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-7">
              <BrandKitFormSections form={form} />
              <BrandKitSaveBar form={form} />
            </div>
            <aside className="order-first lg:order-none">
              <div className="space-y-2 lg:sticky lg:top-6">
                <p className="text-center text-xs font-medium uppercase tracking-wide text-gray-500">{t('preview')}</p>
                <BrandKitPreview brandKit={form.draft} size="md" />
                <p className="text-center text-[11px] text-gray-500">{t('previewHint')}</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
