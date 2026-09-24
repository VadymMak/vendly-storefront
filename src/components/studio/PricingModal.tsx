'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: string;
  onBuyCredits?: () => void;
}

type PlanKey = 'starter' | 'pro' | 'byok_creator';

function getPlanDisplay(key: PlanKey) {
  switch (key) {
    case 'starter': return {
      name: 'Starter', price: 9,
      features: ['100 images/month', '20 video credits/month', 'Best & HD quality tiers', 'Own API keys supported'],
    };
    case 'pro': return {
      name: 'Pro', price: 19,
      features: ['300 images/month', '60 video credits/month', 'Best & HD quality tiers', 'Priority generation queue', 'Own API keys supported'],
    };
    case 'byok_creator': return {
      name: 'BYOK Creator', price: 7,
      features: ['Unlimited with your API keys', 'All quality tiers unlocked', 'Full model access', 'Priority queue'],
    };
  }
}

const PLANS: { key: PlanKey; popular?: boolean }[] = [
  { key: 'starter' },
  { key: 'pro', popular: true },
  { key: 'byok_creator' },
];

export default function PricingModal({ isOpen, onClose, currentPlan, onBuyCredits }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubscribe(plan: PlanKey) {
    setLoading(plan);
    setError(null);
    try {
      const res = await fetch('/api/studio/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Failed to subscribe');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading('portal');
    try {
      const res = await fetch('/api/studio/portal', { method: 'POST' });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
    } finally {
      setLoading(null);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto bg-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-white text-center mb-6">Choose Your Plan</h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(({ key, popular }) => {
            const plan = getPlanDisplay(key);
            const isCurrent = currentPlan === key;

            return (
              <div
                key={key}
                className={`relative rounded-xl p-5 border flex flex-col ${
                  popular
                    ? 'border-green-500 bg-green-900/20'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                {popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs bg-green-600 text-white px-3 py-0.5 rounded-full whitespace-nowrap">
                    Most Popular
                  </span>
                )}

                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold text-white">€{plan.price}</span>
                  <span className="text-gray-400 text-sm">/month</span>
                </div>

                <ul className="text-sm text-gray-300 space-y-2 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    onClick={handlePortal}
                    disabled={loading !== null}
                    className="w-full py-2 rounded-lg bg-green-700 text-white text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {loading === 'portal' ? 'Loading…' : '✓ Current Plan · Manage'}
                  </button>
                ) : currentPlan && currentPlan !== 'free' ? (
                  <button
                    onClick={handlePortal}
                    disabled={loading !== null}
                    className="w-full py-2 rounded-lg bg-gray-800 text-gray-500 text-sm cursor-not-allowed disabled:opacity-50"
                  >
                    {loading === 'portal' ? 'Loading…' : 'Cancel current plan first'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(key)}
                    disabled={loading !== null}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                      popular
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    {loading === key ? 'Loading…' : 'Subscribe'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Not ready for a subscription?{' '}
          <button
            onClick={() => { onClose(); onBuyCredits?.(); }}
            className="text-green-400 hover:text-green-300 underline"
          >
            Buy a credit pack instead
          </button>
        </p>

        {currentPlan && currentPlan !== 'free' && (
          <p className="text-center text-sm text-gray-500 mt-2">
            <button onClick={handlePortal} className="hover:text-white underline transition-colors">
              Manage billing & cancel
            </button>
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
