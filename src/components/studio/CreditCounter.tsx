'use client';

import { useState, useEffect } from 'react';
import CreditPackModal from './CreditPackModal';
import PricingModal from './PricingModal';

interface CreditStatus {
  plan: string;
  superuser?: boolean;
  byok: boolean;
  byokUnlimited: boolean;
  monthly: {
    images: { used: number; total: number; remaining: number };
    videos: { used: number; total: number; remaining: number };
  };
  bonus: { images: number; videos: number };
  totalGenerated: { images: number; videos: number };
  phoneVerified: boolean;
  lastReset: string;
}

export default function CreditCounter() {
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPacks, setShowPacks] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/studio/credits');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  // Expose refresh function globally so generation handlers can update counter
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__refreshCredits = fetchCredits;
    return () => { delete (window as unknown as Record<string, unknown>).__refreshCredits; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (!status) return null;

  // Superusers see unlimited (Admin)
  if (status.superuser) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 rounded-lg text-sm">
        <span className="text-green-600 dark:text-green-400 font-medium">∞ Unlimited (Admin)</span>
      </div>
    );
  }

  // BYOK Creator users see unlimited + manage button
  if (status.byokUnlimited) {
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-sm">
          <span className="text-purple-600 dark:text-purple-400 font-medium">∞ Unlimited (Your API Key)</span>
          <button
            onClick={() => setShowPricing(true)}
            className="px-2 py-0.5 text-xs text-purple-400 hover:text-white transition-colors"
          >
            Manage
          </button>
        </div>
        <PricingModal
          isOpen={showPricing}
          onClose={() => setShowPricing(false)}
          currentPlan={status.plan}
          onBuyCredits={() => setShowPacks(true)}
        />
      </>
    );
  }

  const imgRemaining = status.monthly.images.remaining + status.bonus.images;
  const vidRemaining = status.monthly.videos.remaining + status.bonus.videos;
  const imgTotal = status.monthly.images.total;
  const vidTotal = status.monthly.videos.total;
  const isFree = status.plan === 'free';

  // Color coding: green >50%, yellow <30%, red <10%
  const getColor = (remaining: number, total: number) => {
    const pct = total > 0 ? remaining / total : 0;
    if (pct > 0.5) return 'text-green-600 dark:text-green-400';
    if (pct > 0.1) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
        {status.byok && (
          <span className="text-purple-400 text-xs" title="Using your own API keys">🔑</span>
        )}
        <span className={getColor(imgRemaining, imgTotal)}>
          🖼 {imgRemaining}/{imgTotal + status.bonus.images}
        </span>
        {isFree && status.bonus.videos === 0 ? (
          <button
            onClick={() => setShowPacks(true)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            🎥 Videos: Upgrade
          </button>
        ) : (
          <span className={getColor(vidRemaining, vidTotal + status.bonus.videos)}>
            🎥 {vidRemaining}/{vidTotal + status.bonus.videos}
          </span>
        )}
        <button
          onClick={() => setShowPacks(true)}
          className="ml-1 px-2 py-0.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
        >
          + Buy Credits
        </button>
        <button
          onClick={() => setShowPricing(true)}
          className="px-2 py-0.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          Plans
        </button>
      </div>

      <CreditPackModal
        isOpen={showPacks}
        onClose={() => setShowPacks(false)}
      />
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentPlan={status.plan}
        onBuyCredits={() => setShowPacks(true)}
      />
    </>
  );
}
