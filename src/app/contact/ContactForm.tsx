'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const CONTACT_EMAIL = 'makevytssvadym@gmail.com';
const WHATSAPP_NUMBER = '421901234567';

function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="rgba(22,163,74,0.15)" />
      <path d="M14 24l8 8 12-14" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ContactForm() {
  const t = useTranslations('contactPage');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`VendShop inquiry from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    window.open(`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`, '_blank');
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">

        {/* Left — contact info */}
        <div className="lg:col-span-2 space-y-6">
          {/* WhatsApp */}
          <div className="rounded-2xl border border-[--color-border] bg-[--color-card] p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
                <WhatsAppIcon />
              </div>
              <h3 className="text-base font-semibold text-white">{t('whatsappTitle')}</h3>
            </div>
            <p className="text-sm text-[--color-text-muted] mb-4">{t('whatsappDesc')}</p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <WhatsAppIcon />
              {t('whatsappBtn')}
            </a>
          </div>

          {/* Email */}
          <div className="rounded-2xl border border-[--color-border] bg-[--color-card] p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <MailIcon />
              </div>
              <h3 className="text-base font-semibold text-white">{t('emailTitle')}</h3>
            </div>
            <p className="text-sm text-[--color-text-muted] mb-4">{t('emailDesc')}</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm font-medium text-primary hover:underline break-all"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        {/* Right — form */}
        <div className="lg:col-span-3 rounded-2xl border border-[--color-border] bg-[--color-card] p-6 sm:p-8">
          {sent ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-center">
              <CheckCircleIcon />
              <h3 className="text-xl font-semibold text-white">{t('successTitle')}</h3>
              <p className="text-[--color-text-muted]">{t('successDesc')}</p>
              <button
                onClick={() => { setSent(false); setName(''); setEmail(''); setMessage(''); }}
                className="mt-2 text-sm text-primary hover:underline"
              >
                ← Send another
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-white mb-6">{t('formTitle')}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[--color-text-muted]">
                    {t('nameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('namePlaceholder')}
                    className="w-full rounded-xl border border-[--color-border] bg-[--color-bg] px-4 py-3 text-sm text-white placeholder-[--color-text-dim] outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[--color-text-muted]">
                    {t('emailLabel')}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="w-full rounded-xl border border-[--color-border] bg-[--color-bg] px-4 py-3 text-sm text-white placeholder-[--color-text-dim] outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[--color-text-muted]">
                    {t('messageLabel')}
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('messagePlaceholder')}
                    className="w-full resize-none rounded-xl border border-[--color-border] bg-[--color-bg] px-4 py-3 text-sm text-white placeholder-[--color-text-dim] outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  {t('submit')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
