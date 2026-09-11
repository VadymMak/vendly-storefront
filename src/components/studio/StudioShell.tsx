'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import CreditCounter from '@/components/studio/CreditCounter';

// ── Inline SVG icons ────────────────────────────────────────────────────────

function IconSparkle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconScissors() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconHamburger() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ── Nav config ───────────────────────────────────────────────────────────────

const NAV_TOP = [
  { href: '/studio/generate', label: 'Generate', Icon: IconSparkle },
  { href: '/studio/animate',  label: 'Animate',  Icon: IconPlay },
  { href: '/studio/assemble', label: 'Assemble', Icon: IconScissors },
] as const;

const NAV_BOTTOM = [
  { href: '/studio/library',  label: 'Library',  Icon: IconGrid },
  { href: '/studio/settings', label: 'Settings', Icon: IconGear },
] as const;

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  userEmail: string;
  children: React.ReactNode;
}

// ── Component ────────────────────────────────────────────────────────────────

export function StudioShell({ userEmail, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAssembleMode = pathname.startsWith('/studio/assemble');

  function navItemClass(href: string) {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return [
      'flex items-center gap-3 rounded-md py-2.5 transition-colors',
      // Tablet (md): always icon-only. Desktop (lg): full if not collapsed
      'justify-center px-0',
      !collapsed && 'lg:justify-start lg:px-2',
      isActive
        ? 'border-l-4 border-green-600 bg-white/5 text-white'
        : 'border-l-4 border-transparent text-gray-400 hover:bg-white/5 hover:text-white',
    ].filter(Boolean).join(' ');
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <nav className="flex flex-1 flex-col gap-1 p-2 pt-4">
        {NAV_TOP.map(({ href, label, Icon }) => (
          <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={navItemClass(href)}>
            <span className="flex-shrink-0"><Icon /></span>
            {!collapsed && <span className="hidden lg:block truncate text-sm font-medium">{label}</span>}
          </Link>
        ))}
      </nav>

      <nav className="flex flex-col gap-1 p-2">
        {NAV_BOTTOM.map(({ href, label, Icon }) => (
          <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={navItemClass(href)}>
            <span className="flex-shrink-0"><Icon /></span>
            {!collapsed && <span className="hidden lg:block truncate text-sm font-medium">{label}</span>}
          </Link>
        ))}
      </nav>

      <div className="hidden border-t border-white/10 p-2 lg:block">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex w-full items-center justify-center py-2 text-gray-500 transition-colors hover:text-white"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0f] text-white">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex h-14 flex-shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0a0f]/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            className="text-gray-400 transition-colors hover:text-white md:hidden"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle sidebar"
          >
            <IconHamburger />
          </button>
          <a href="/studio" className="text-lg font-bold text-white">
            AI Studio
          </a>
        </div>

        <div className="hidden flex-1 md:flex" />

        <div className="flex items-center gap-4">
          <CreditCounter />
          <span className="hidden text-xs text-gray-400 sm:block">{userEmail}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="cursor-pointer text-xs text-gray-500 transition-colors hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar — hidden entirely in Assemble mode */}
        {!isAssembleMode && (
          <>
            <aside
              className={[
                'flex-shrink-0 overflow-hidden border-r border-white/10 bg-[#0d0d14]',
                'transition-[width,transform] duration-200',
                'hidden md:flex md:flex-col',
                collapsed ? 'md:w-14' : 'md:w-14 lg:w-[200px]',
                mobileOpen ? 'fixed bottom-0 left-0 top-14 z-40 flex w-[200px] flex-col' : '',
              ].join(' ')}
            >
              {sidebarContent}
            </aside>

            {mobileOpen && (
              <aside className="fixed bottom-0 left-0 top-14 z-40 flex w-[200px] flex-col overflow-hidden border-r border-white/10 bg-[#0d0d14] md:hidden">
                {sidebarContent}
              </aside>
            )}
          </>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
