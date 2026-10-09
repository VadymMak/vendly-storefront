'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { STUDIO_CREDIT_PACKS } from '@/lib/constants';
import type { StudioCreditPackId } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reason?: 'video' | 'tier' | 'credits';
  onShowPlans?: () => void;
}

const REASON_TITLES: Record<NonNullable<Props['reason']>, string> = {
  video:   '🎬 Video Generation Requires Credits',
  tier:    '🔒 Unlock Best & HD Quality',
  credits: 'Buy Credits',
};

export default function CreditPackModal({ isOpen, onClose, reason = 'credits', onShowPlans }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleBuy(packId: StudioCreditPackId) {
    setLoading(packId);
    try {
      const res = await fetch('/api/studio/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: packId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Checkout error:', data.error);
      }
    } catch (err) {
      console.error('Failed to create checkout:', err);
    } finally {
      setLoading(null);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto bg-gray-900 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-white text-center mb-6">{REASON_TITLES[reason]}</h2>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STUDIO_CREDIT_PACKS.map(pack => (
            <div
              key={pack.id}
              className={`relative rounded-xl border p-4 flex flex-col gap-3 ${pack.popular ? 'border-green-500/50 bg-green-500/5' : 'border-white/10 bg-white/[0.02]'}`}
            >
              {pack.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                  Most Popular
                </span>
              )}

              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{pack.name}</p>
                <p className="text-2xl font-bold text-white mt-1">€{pack.priceEur}</p>
              </div>

              <ul className="space-y-1 text-sm text-gray-300 flex-1">
                <li className="flex items-center gap-1.5">
                  <span className="text-green-400 text-xs">✓</span>
                  {pack.images} images
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-green-400 text-xs">✓</span>
                  {pack.videos} video credits
                </li>
              </ul>

              <button
                onClick={() => handleBuy(pack.id)}
                disabled={loading !== null}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  pack.popular
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                }`}
              >
                {loading === pack.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Redirecting…
                  </span>
                ) : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-500 text-sm mt-4">
          Secure payment via Stripe · Credits never expire
        </p>
        {onShowPlans && (
          <p className="text-center text-sm text-gray-500 mt-2">
            Want unlimited monthly credits?{' '}
            <button
              onClick={() => { onClose(); onShowPlans(); }}
              className="text-green-400 hover:text-green-300 underline transition-colors"
            >
              See subscription plans →
            </button>
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
