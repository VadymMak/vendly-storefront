'use client';

import { useState, useEffect } from 'react';

interface CreditStatus {
  plan: string;
  superuser?: boolean;
  byok: boolean;
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

  // BYOK users see unlimited
  if (status.byok) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-sm">
        <span>∞ Unlimited (BYOK)</span>
      </div>
    );
  }

  const imgRemaining = status.monthly.images.remaining + status.bonus.images;
  const vidRemaining = status.monthly.videos.remaining + status.bonus.videos;
  const imgTotal = status.monthly.images.total;
  const vidTotal = status.monthly.videos.total;

  // Color coding: green >50%, yellow <30%, red <10%
  const getColor = (remaining: number, total: number) => {
    const pct = total > 0 ? remaining / total : 0;
    if (pct > 0.5) return 'text-green-600 dark:text-green-400';
    if (pct > 0.1) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
      <span className={getColor(imgRemaining, imgTotal)}>
        🖼 {imgRemaining}/{imgTotal + status.bonus.images}
      </span>
      <span className={getColor(vidRemaining, vidTotal)}>
        🎥 {vidRemaining}/{vidTotal + status.bonus.videos}
      </span>
      <button
        onClick={() => {
          // Dispatch custom event — StudioClient will listen and show upgrade modal
          window.dispatchEvent(new CustomEvent('studio:showUpgrade'));
        }}
        className="ml-1 px-2 py-0.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
      >
        + Buy more
      </button>
    </div>
  );
}
