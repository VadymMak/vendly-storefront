'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ColorSchemeTokens } from '@/lib/types';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { useCart } from './CartContext';

interface CartDrawerProps {
  scheme: ColorSchemeTokens;
}

export default function CartDrawer({ scheme }: CartDrawerProps) {
  const pathname = usePathname();
  const slug = pathname.split('/')[2] || '';
  const { items, removeItem, updateQuantity, totalPrice, currency, isOpen, setIsOpen } = useCart();
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col ${scheme.bg} shadow-xl`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b ${scheme.border} px-4 py-4`}>
          <h2 className="text-lg font-bold">Košík</h2>
          <button
            onClick={() => setIsOpen(false)}
            className={`rounded-lg p-2 ${scheme.textMuted} hover:opacity-70`}
            aria-label="Zavrieť košík"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={`${scheme.textMuted} opacity-50`}>
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              <p className={`mt-4 ${scheme.textMuted}`}>Košík je prázdny</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map(({ item, quantity }) => (
                <li key={item.id} className={`flex gap-3 rounded-lg ${scheme.bgCard} p-3`}>
                  {/* Thumbnail */}
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {item.images[0] ? (
                      <img src={item.images[0]} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-30">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col">
                    <p className="text-sm font-medium leading-tight">{item.name}</p>
                    <p className={`mt-1 text-sm font-semibold`}>
                      {(item.price || 0).toFixed(2)} {currencySymbol}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, quantity - 1)}
                        className={`flex h-7 w-7 items-center justify-center rounded ${scheme.border} border text-sm`}
                      >
                        -
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, quantity + 1)}
                        className={`flex h-7 w-7 items-center justify-center rounded ${scheme.border} border text-sm`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className={`self-start rounded p-1 ${scheme.textMuted} hover:opacity-70`}
                    aria-label={`Odstrániť ${item.name}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className={`border-t ${scheme.border} px-4 py-4`}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-medium">Spolu:</span>
              <span className="text-xl font-bold">
                {totalPrice.toFixed(2)} {currencySymbol}
              </span>
            </div>
            <Link
              href={`/shop/${slug}/checkout`}
              onClick={() => setIsOpen(false)}
              className={`block w-full rounded-lg ${scheme.accent} ${scheme.accentHover} px-6 py-3 text-center font-semibold transition-colors`}
            >
              Objednať
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
