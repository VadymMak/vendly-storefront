'use client';

import { useState, useEffect } from 'react';

const CONSENT_KEY = 'cookie_consent_de';

type ConsentValue = { necessary: true; maps: boolean; version: '1' };

function readConsent(): ConsentValue | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentValue;
  } catch {
    return null;
  }
}

function writeConsent(maps: boolean) {
  try {
    const value: ConsentValue = { necessary: true, maps, version: '1' };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
  } catch {}
}

export function useCookieConsent(): { mapsAllowed: boolean } {
  const [mapsAllowed, setMapsAllowed] = useState(false);

  useEffect(() => {
    const consent = readConsent();
    setMapsAllowed(consent?.maps ?? false);

    const handler = () => setMapsAllowed(readConsent()?.maps ?? false);
    window.addEventListener('cookie-consent-updated', handler);
    return () => window.removeEventListener('cookie-consent-updated', handler);
  }, []);

  return { mapsAllowed };
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readConsent()) setVisible(true);
  }, []);

  const accept = (maps: boolean) => {
    writeConsent(maps);
    window.dispatchEvent(new Event('cookie-consent-updated'));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie-Einstellungen"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[--color-bg]/95 backdrop-blur-md px-4 py-4"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-[13px] leading-relaxed text-[--color-text-muted]">
          Diese Website verwendet Cookies und Google Maps. Mit Klick auf{' '}
          <strong className="text-[--color-text]">{'„Alle akzeptieren"'}</strong> stimmen Sie zu.{' '}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => accept(false)}
            className="rounded-full border border-[--color-border] px-4 py-2 text-[13px] font-semibold text-[--color-text-muted] transition-colors hover:border-[--color-accent] hover:text-[--color-accent] cursor-pointer"
          >
            Nur notwendige
          </button>
          <button
            onClick={() => accept(true)}
            className="rounded-full bg-[--color-accent] px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
          >
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
