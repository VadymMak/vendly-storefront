import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'sk', 'uk', 'cs', 'de'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'sk';

export default getRequestConfig(async () => {
  const locale = defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
