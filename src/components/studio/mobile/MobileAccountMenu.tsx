'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';

interface Props {
  userEmail: string;
}

// Back to the mobile studio after signing in again, not the desktop /studio default
const LOGOUT_CALLBACK_URL = '/login?callbackUrl=/studio/m';

export function MobileAccountMenu({ userEmail }: Props) {
  const t = useTranslations('mobile.shell');
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const initial = (userEmail[0] ?? 'U').toUpperCase();

  function handleLogout() {
    setSigningOut(true);
    signOut({ callbackUrl: LOGOUT_CALLBACK_URL });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('account')}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white after:absolute after:-inset-2 after:content-[""] ${
          open ? 'ring-2 ring-green-400/60' : ''
        }`}
      >
        {initial}
      </button>

      {open && (
        <>
          {/* Tap outside closes — portaled: the header's backdrop-filter would confine a fixed child to the header */}
          {createPortal(
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />,
            document.body,
          )}
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-[#16161d] shadow-2xl"
          >
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-[11px] text-gray-500">{t('signedInAs')}</p>
              <p className="truncate text-sm text-gray-200">{userEmail}</p>
            </div>
            <button
              role="menuitem"
              onClick={handleLogout}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-red-400 active:bg-white/[0.06] disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {signingOut ? t('loggingOut') : t('logout')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
