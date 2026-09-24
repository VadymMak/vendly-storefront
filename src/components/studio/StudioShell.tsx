'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import CreditCounter from '@/components/studio/CreditCounter';
import { SidebarProvider, useSidebarContext } from '@/components/studio/SidebarContext';
import KbChatWidget from '@/components/studio/KbChatWidget';

// ── Icons ────────────────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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

function IconText() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function IconTransitions() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8L22 12L18 16" />
      <path d="M6 8L2 12L6 16" />
      <line x1="2" y1="12" x2="22" y2="12" opacity="0.3" />
    </svg>
  );
}

function IconMusic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconEffects() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
}

function IconAutoEdit() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M12.2 11.8L11 13M12.2 6.2L11 5"/>
      <path d="M2 22l10-10"/>
    </svg>
  );
}

// ── Nav config ───────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { href: '/studio',          label: 'Home',     Icon: IconHome },
  { href: '/studio/library',  label: 'My Work',  Icon: IconGrid },
  { href: '/studio/assemble', label: 'Assemble', Icon: IconScissors },
] as const;

const BOTTOM_NAV = [
  { href: '/studio/settings', label: 'Settings', Icon: IconGear },
] as const;

const ASSEMBLE_TOOLS = [
  { id: 'text',        label: 'Text',        Icon: IconText },
  { id: 'transitions', label: 'Transitions', Icon: IconTransitions },
  { id: 'audio',       label: 'Audio',       Icon: IconMusic },
  { id: 'effects',     label: 'Effects',     Icon: IconEffects },
  { id: 'auto-edit',   label: 'Auto Edit',   Icon: IconAutoEdit },
] as const;

// ── SidebarIcon ───────────────────────────────────────────────────────────────

function SidebarIcon({ Icon, label, isActive, onClick, href }: {
  Icon: React.ComponentType;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const cls = [
    'flex w-full flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[9px] font-medium transition-colors',
    isActive
      ? 'bg-green-500/10 text-green-500'
      : 'text-gray-500 hover:bg-white/5 hover:text-gray-300',
  ].join(' ');

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={cls}>
        <Icon />
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      <Icon />
      <span>{label}</span>
    </button>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  userEmail: string;
  children: React.ReactNode;
}

// ── Inner shell (uses context) ────────────────────────────────────────────────

function StudioShellInner({ userId, userEmail, children }: { userId: string; userEmail: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { expandedTool, setExpandedTool } = useSidebarContext();

  const isAssembleMode = pathname.startsWith('/studio/assemble');

  function isActive(href: string) {
    if (href === '/studio') return pathname === '/studio';
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Close tool panel when leaving Assemble
  useEffect(() => {
    if (!isAssembleMode) setExpandedTool(null);
  }, [isAssembleMode, setExpandedTool]);

  const sidebarContent = (
    <div className="flex h-full flex-col py-2">
      {/* Main nav */}
      <div className="flex flex-col items-center gap-0.5 px-1.5">
        {MAIN_NAV.map(({ href, label, Icon }) => (
          <SidebarIcon
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            isActive={isActive(href)}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </div>

      <div className="mx-2 my-1.5 h-px bg-white/[0.06]" />

      {/* Assemble tools — visible only in Assemble mode */}
      {isAssembleMode && (
        <>
          <div className="flex flex-col items-center gap-0.5 px-1.5">
            {ASSEMBLE_TOOLS.map(({ id, label, Icon }) => (
              <SidebarIcon
                key={id}
                label={label}
                Icon={Icon}
                isActive={expandedTool === id}
                onClick={() => {
                  setExpandedTool(expandedTool === id ? null : id);
                  setMobileOpen(false);
                }}
              />
            ))}
          </div>
          <div className="mx-2 my-1.5 h-px bg-white/[0.06]" />
        </>
      )}

      {/* Bottom: Library + Settings */}
      <div className="mt-auto flex flex-col items-center gap-0.5 px-1.5 pb-1">
        {BOTTOM_NAV.map(({ href, label, Icon }) => (
          <SidebarIcon
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            isActive={isActive(href)}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <>
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0f] text-white">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex h-12 flex-shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0a0f]/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            className="text-gray-400 transition-colors hover:text-white md:hidden"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle sidebar"
          >
            <IconHamburger />
          </button>
          <a href="/studio" className="text-base font-bold text-white">
            AI Studio
          </a>
        </div>
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
        {/* Mobile backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Icon sidebar — always visible on md+, slide-over on mobile */}
        <nav className="hidden w-[60px] flex-shrink-0 flex-col border-r border-white/10 bg-[#0d0d14] md:flex">
          {sidebarContent}
        </nav>

        {mobileOpen && (
          <nav className="fixed bottom-0 left-0 top-12 z-40 flex w-[60px] flex-col border-r border-white/10 bg-[#0d0d14] md:hidden">
            {sidebarContent}
          </nav>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
    <KbChatWidget userId={userId} />
    </>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function StudioShell({ userId, userEmail, children }: Props) {
  return (
    <SidebarProvider>
      <StudioShellInner userId={userId} userEmail={userEmail}>
        {children}
      </StudioShellInner>
    </SidebarProvider>
  );
}
