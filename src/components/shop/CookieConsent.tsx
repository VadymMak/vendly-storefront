'use client';

import { useState, useEffect } from 'react';

interface CookieConsentProps {
  text: string;
  acceptLabel: string;
  declineLabel: string;
}

const STORAGE_KEY = 'vendshop-cookie-consent';

export default function CookieConsent({ text, acceptLabel, declineLabel }: CookieConsentProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if user hasn't responded yet
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage unavailable — show banner
      setVisible(true);
    }
  }, []);

  const handleResponse = (accepted: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, accepted ? 'accepted' : 'declined');
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 animate-fade-in-up">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-lg sm:flex-row sm:gap-4">
        {/* Cookie icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0 text-primary" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="10" r="1.5" fill="currentColor" />
          <circle cx="14" cy="8" r="1" fill="currentColor" />
          <circle cx="12" cy="14" r="1.5" fill="currentColor" />
          <circle cx="16" cy="13" r="1" fill="currentColor" />
          <circle cx="9" cy="16" r="1" fill="currentColor" />
        </svg>

        <p className="flex-1 text-center text-sm text-gray-600 sm:text-left">
          {text}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => handleResponse(false)}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 cursor-pointer"
          >
            {declineLabel}
          </button>
          <button
            onClick={() => handleResponse(true)}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark cursor-pointer"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
