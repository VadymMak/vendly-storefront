'use client';

import { useState, useEffect, useCallback } from 'react';

interface Summary {
  totalCalls:   number;
  totalCost:    number;
  totalCredits: number;
  totalErrors:  number;
  avgDuration:  number;
  byokCalls:    number;
  days:         number;
}

interface DailyEntry     { date: string; calls: number; cost: number; errors: number; }
interface ProviderEntry  { provider: string; calls: number; cost: number; errors: number; }
interface ModelEntry     { model: string; calls: number; cost: number; }
interface OperationEntry { operation: string; calls: number; }
interface UserEntry      { userId: string; email: string; name: string | null; calls: number; cost: number; }
interface ErrorEntry     { id: string; modelAlias: string; provider: string; errorMessage: string | null; createdAt: string; }

interface DashboardData {
  summary:      Summary;
  daily:        DailyEntry[];
  byProvider:   ProviderEntry[];
  byModel:      ModelEntry[];
  byOperation:  OperationEntry[];
  topUsers:     UserEntry[];
  recentErrors: ErrorEntry[];
}

const PERIOD_OPTIONS = [
  { label: '7 days',  value: 7  },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

const PROVIDER_COLORS: Record<string, string> = {
  replicate: '#3B82F6',
  fal:       '#8B5CF6',
  xai:       '#F59E0B',
  bfl:       '#10B981',
};

export default function StudioDashboardPage() {
  const [days, setDays]     = useState(30);
  const [data, setData]     = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/studio-usage?days=${days}`);
      if (res.ok) setData(await res.json() as DashboardData);
    } catch (err) {
      console.error('Failed to fetch studio usage:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-purple-500" />
      </div>
    );
  }

  if (!data) {
    return <p className="py-20 text-center text-gray-400">Failed to load data</p>;
  }

  const { summary, daily, byProvider, byModel, topUsers, recentErrors } = data;
  const maxDailyCalls    = Math.max(...daily.map(d => d.calls), 1);
  const maxProviderCalls = Math.max(...byProvider.map(p => p.calls), 1);
  const maxModelCalls    = Math.max(...byModel.map(m => m.calls), 1);

  return (
    <div className="space-y-6">
      {/* Header + Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Studio Usage</h1>
          <p className="mt-1 text-sm text-gray-400">AI generation analytics</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-800 p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                days === opt.value
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {([
          { label: 'Total Calls',   value: summary.totalCalls.toLocaleString(),                                          color: 'text-white'    },
          { label: 'Total Cost',    value: `$${summary.totalCost.toFixed(2)}`,                                           color: 'text-green-400' },
          { label: 'Credits Used',  value: summary.totalCredits.toLocaleString(),                                        color: 'text-blue-400'  },
          { label: 'Errors',        value: summary.totalErrors.toLocaleString(), color: summary.totalErrors > 0 ? 'text-red-400'    : 'text-gray-400' },
          { label: 'Avg Duration',  value: `${(summary.avgDuration / 1000).toFixed(1)}s`,                                color: 'text-yellow-400' },
          { label: 'BYOK Calls',    value: summary.byokCalls.toLocaleString(),                                           color: 'text-purple-400' },
        ] as const).map(card => (
          <div key={card.label} className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-xs text-gray-400">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Daily Usage Chart (CSS bars) */}
      {daily.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-300">Daily Usage</h2>
          <div className="flex items-end gap-[2px]" style={{ height: 120 }}>
            {daily.map(d => (
              <div
                key={d.date}
                className="group relative flex-1 rounded-t bg-purple-500 transition-colors hover:bg-purple-400"
                style={{ height: `${(d.calls / maxDailyCalls) * 100}%`, minHeight: 2 }}
                title={`${d.date}: ${d.calls} calls, $${d.cost.toFixed(3)}`}
              >
                <div className="absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                  {d.date}: {d.calls} calls
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            <span>{daily[0]?.date}</span>
            <span>{daily[daily.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Two-column: Providers + Models */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* By Provider */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-300">By Provider</h2>
          <div className="space-y-2">
            {byProvider.map(p => (
              <div key={p.provider} className="flex items-center gap-3">
                <span className="w-20 capitalize text-sm text-gray-300">{p.provider}</span>
                <div className="flex-1">
                  <div
                    className="h-6 rounded"
                    style={{
                      width:           `${(p.calls / maxProviderCalls) * 100}%`,
                      backgroundColor: PROVIDER_COLORS[p.provider] ?? '#6B7280',
                      minWidth:        4,
                    }}
                  />
                </div>
                <span className="w-16 text-right text-sm text-gray-400">{p.calls}</span>
                <span className="w-20 text-right text-xs text-green-400">${p.cost.toFixed(2)}</span>
              </div>
            ))}
            {byProvider.length === 0 && (
              <p className="text-sm text-gray-500">No data</p>
            )}
          </div>
        </div>

        {/* By Model */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-300">By Model</h2>
          <div className="space-y-2">
            {byModel.map(m => (
              <div key={m.model} className="flex items-center gap-3">
                <span className="w-28 truncate text-sm text-gray-300">{m.model}</span>
                <div className="flex-1">
                  <div
                    className="h-6 rounded bg-blue-500"
                    style={{ width: `${(m.calls / maxModelCalls) * 100}%`, minWidth: 4 }}
                  />
                </div>
                <span className="w-16 text-right text-sm text-gray-400">{m.calls}</span>
                <span className="w-20 text-right text-xs text-green-400">${m.cost.toFixed(2)}</span>
              </div>
            ))}
            {byModel.length === 0 && (
              <p className="text-sm text-gray-500">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Users Table */}
      {topUsers.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-300">Top Users</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-left text-xs text-gray-500">
                <th className="pb-2">User</th>
                <th className="pb-2 text-right">Calls</th>
                <th className="pb-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {topUsers.map(u => (
                <tr key={u.userId}>
                  <td className="py-2 text-gray-300">{u.name ?? u.email}</td>
                  <td className="py-2 text-right text-gray-400">{u.calls}</td>
                  <td className="py-2 text-right text-green-400">${u.cost.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4">
          <h2 className="mb-3 text-sm font-semibold text-red-400">
            Recent Errors ({recentErrors.length})
          </h2>
          <div className="space-y-2">
            {recentErrors.slice(0, 10).map(e => (
              <div key={e.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 rounded bg-red-900/50 px-1.5 py-0.5 text-xs text-red-300">
                  {e.provider}
                </span>
                <span className="text-gray-400">{e.modelAlias}</span>
                <span className="flex-1 truncate text-red-300">
                  {e.errorMessage ?? 'Unknown error'}
                </span>
                <span className="whitespace-nowrap text-xs text-gray-500">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {summary.totalCalls === 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 py-16 text-center">
          <p className="text-gray-400">No usage data for the last {days} days</p>
          <p className="mt-1 text-sm text-gray-500">
            Usage logs are recorded when users generate or edit images via the unified studio routes
          </p>
        </div>
      )}
    </div>
  );
}
