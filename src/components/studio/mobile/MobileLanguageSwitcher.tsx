'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'cs', label: 'CZ' },
  { code: 'de', label: 'DE' },
] as const;

export function MobileLanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('mobile.shell');

  function handleChange(newLocale: string) {
    if (newLocale === locale) return;
    document.cookie = `locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t('language')}>
      {LOCALES.map(({ code, label }) => {
        const active = locale === code;
        return (
          <button
            key={code}
            onClick={() => handleChange(code)}
            role="radio"
            aria-checked={active}
            className={`relative rounded-full px-2.5 py-2 text-[11px] font-semibold leading-none transition-colors after:absolute after:-inset-x-[3px] after:-inset-y-2 after:content-[""] ${
              active
                ? 'bg-green-600 text-white'
                : 'bg-white/[0.06] text-gray-400 active:bg-white/[0.12]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
