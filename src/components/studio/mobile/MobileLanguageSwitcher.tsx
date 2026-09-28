'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  sk: 'SK',
  uk: 'UA',
  cs: 'CZ',
  de: 'DE',
};

export function MobileLanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function handleChange(newLocale: string) {
    document.cookie = `locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="appearance-none rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-gray-300 outline-none focus:ring-1 focus:ring-green-500/50"
      aria-label="Language"
    >
      {Object.entries(LOCALE_LABELS).map(([code, label]) => (
        <option key={code} value={code} className="bg-[#1a1a2e] text-white">
          {label}
        </option>
      ))}
    </select>
  );
}
