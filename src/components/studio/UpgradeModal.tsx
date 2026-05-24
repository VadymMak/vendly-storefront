'use client';

import { useState } from 'react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'image' | 'video' | 'general';
}

export default function UpgradeModal({ isOpen, onClose, type = 'general' }: UpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBuyPack = async (packId: 'pack_s' | 'pack_l') => {
    setLoading(packId);
    try {
      const res = await fetch('/api/studio/buy-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to create checkout:', err);
    } finally {
      setLoading(null);
    }
  };

  const title = type === 'image'
    ? "You've used all your image credits"
    : type === 'video'
    ? "You've used all your video credits"
    : "Get more AI Studio credits";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
          Choose a credit pack or upgrade your plan for more monthly credits.
        </p>

        {/* Credit Packs */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleBuyPack('pack_s')}
            disabled={loading !== null}
            className="w-full flex items-center justify-between p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 dark:hover:border-green-500 transition-colors text-left"
          >
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">Credit Pack S</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">120 images + 5 videos</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Credits never expire</div>
            </div>
            <div className="text-lg font-bold text-green-600">
              {loading === 'pack_s' ? '...' : '€12'}
            </div>
          </button>

          <button
            onClick={() => handleBuyPack('pack_l')}
            disabled={loading !== null}
            className="w-full flex items-center justify-between p-4 border-2 border-green-500 rounded-xl hover:border-green-600 transition-colors text-left relative"
          >
            <span className="absolute -top-2.5 left-4 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
              Best value
            </span>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">Credit Pack L</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">350 images + 15 videos</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Credits never expire</div>
            </div>
            <div className="text-lg font-bold text-green-600">
              {loading === 'pack_l' ? '...' : '€29'}
            </div>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Plan upgrade link */}
        <div className="space-y-2">
          <a
            href="/pricing"
            className="block w-full text-center py-2.5 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
          >
            Upgrade plan — get more monthly credits →
          </a>
        </div>
      </div>
    </div>
  );
}
