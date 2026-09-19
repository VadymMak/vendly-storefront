'use client';

import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PACKS = [
  {
    id:       'starter' as const,
    label:    'Starter Pack',
    price:    '€5',
    images:   50,
    videos:   3,
    popular:  false,
    color:    'border-white/10',
  },
  {
    id:       'creator' as const,
    label:    'Creator Pack',
    price:    '€10',
    images:   150,
    videos:   8,
    popular:  true,
    color:    'border-green-500/50',
  },
  {
    id:       'pro' as const,
    label:    'Pro Pack',
    price:    '€20',
    images:   400,
    videos:   20,
    popular:  false,
    color:    'border-white/10',
  },
];

export default function CreditPackModal({ isOpen, onClose }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleBuy(packId: 'starter' | 'creator' | 'pro') {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0d0d14] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Get More Credits</h2>
            <p className="text-sm text-gray-400 mt-1">Credits never expire · Stacks with monthly allowance</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none ml-4"
          >
            ×
          </button>
        </div>

        {/* Cards */}
        <div className="flex gap-3 px-6 pb-2">
          {PACKS.map(pack => (
            <div
              key={pack.id}
              className={`relative flex-1 rounded-xl border p-4 flex flex-col gap-3 ${pack.color} ${pack.popular ? 'bg-green-500/5' : 'bg-white/[0.02]'}`}
            >
              {pack.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                  Most Popular
                </span>
              )}

              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{pack.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{pack.price}</p>
              </div>

              <ul className="space-y-1 text-sm text-gray-300 flex-1">
                <li className="flex items-center gap-1.5">
                  <span className="text-green-400 text-xs">✓</span>
                  {pack.images} images
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-green-400 text-xs">✓</span>
                  {pack.videos} videos
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

        <p className="text-center text-[11px] text-gray-600 px-6 py-4">
          Secure payment via Stripe · No subscription · Credits stacked as bonus, never reset
        </p>
      </div>
    </div>
  );
}
