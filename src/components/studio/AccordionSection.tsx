'use client';
import { useState } from 'react';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function AccordionSection({ title, defaultOpen = false, children }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:bg-white/[0.03] hover:text-gray-200"
      >
        {title}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={['transition-transform duration-200', isOpen ? 'rotate-90' : ''].join(' ')}
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
