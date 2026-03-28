'use client';

import { useState } from 'react';

const PLANS = ['FREE', 'STARTER', 'PRO'] as const;

const PLAN_STYLES: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-700 border-gray-200',
  STARTER: 'bg-blue-100 text-blue-800 border-blue-200',
  PRO: 'bg-purple-100 text-purple-800 border-purple-200',
};

interface PlanSelectorProps {
  userId: string;
  currentPlan: string;
}

export default function PlanSelector({ userId, currentPlan }: PlanSelectorProps) {
  const [plan, setPlan] = useState(currentPlan);
  const [loading, setLoading] = useState(false);

  const handleChange = async (newPlan: string) => {
    if (newPlan === plan || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/set-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan: newPlan }),
      });
      if (res.ok) {
        setPlan(newPlan);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex gap-1">
      {PLANS.map((p) => (
        <button
          key={p}
          onClick={() => handleChange(p)}
          disabled={loading}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-all cursor-pointer ${
            plan === p
              ? PLAN_STYLES[p]
              : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
          } ${loading ? 'opacity-50' : ''}`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
