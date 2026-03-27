'use client';

import type { ColorSchemeTokens } from '@/lib/types';
import { useCart } from './CartContext';

interface CartButtonProps {
  scheme: ColorSchemeTokens;
}

export default function CartButton({ scheme }: CartButtonProps) {
  const { totalItems, setIsOpen } = useCart();

  return (
    <button
      onClick={() => setIsOpen(true)}
      className={`relative rounded-lg p-2 transition-colors hover:${scheme.bgCard}`}
      aria-label={`Košík (${totalItems})`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
      </svg>
      {totalItems > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  );
}
