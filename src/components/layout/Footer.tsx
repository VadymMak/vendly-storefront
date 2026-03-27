'use client';

import { useTranslations } from 'next-intl';
import { SITE_NAME } from '@/lib/constants';

export default function Footer() {
  const t = useTranslations('footer');

  const footerLinks = {
    product: [
      { label: t('features'), href: '#features' },
      { label: t('pricing'), href: '#pricing' },
      { label: t('templates'), href: '#' },
      { label: t('examples'), href: '#' },
    ],
    support: [
      { label: t('docs'), href: '#' },
      { label: t('contact'), href: '#' },
      { label: t('status'), href: '#' },
    ],
    legal: [
      { label: t('terms'), href: '#' },
      { label: t('privacy'), href: '#' },
      { label: t('gdpr'), href: '#' },
    ],
  };

  return (
    <footer className="border-t border-gray-100 bg-secondary text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="32" height="32" rx="7" fill="#16a34a" />
                <text x="6" y="23" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="white">V.</text>
              </svg>
              <h3 className="text-lg font-bold text-primary">Vendly</h3>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              {t('description')}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">{t('product')}</h4>
            <ul className="mt-4 space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-300 transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">{t('support')}</h4>
            <ul className="mt-4 space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-300 transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">{t('legal')}</h4>
            <ul className="mt-4 space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-300 transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-700 pt-8 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} {SITE_NAME}. {t('copyright')}
        </div>
      </div>
    </footer>
  );
}
