'use client';

import { useState, useEffect, useCallback } from 'react';

interface PlatformKey {
  id: string;
  provider: string;
  keyHint: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuditEntry {
  id: string;
  provider: string;
  action: string;
  adminEmail: string;
  metadata: Record<string, string> | null;
  createdAt: string;
}

interface DashboardData {
  keys: PlatformKey[];
  spendByProvider: Record<string, number>;
  auditLogs: AuditEntry[];
}

const ALL_PROVIDERS = [
  { id: 'fal',          label: 'fal.ai',           icon: '🎬', desc: 'Primary — Kling video + Flux images' },
  { id: 'replicate',    label: 'Replicate',         icon: '🔄', desc: 'Fallback — Flux images' },
  { id: 'xai',          label: 'xAI (Grok)',        icon: '🤖', desc: 'Free — Grok Imagine images' },
  { id: 'bfl',          label: 'Black Forest Labs', icon: '🌲', desc: 'HD — FLUX.2 Pro images' },
  { id: 'openai',       label: 'OpenAI',            icon: '💬', desc: 'Chat + DALL-E' },
  { id: 'anthropic',    label: 'Anthropic',         icon: '🧠', desc: 'Chat — Claude' },
  { id: 'kling_key',    label: 'Kling (Key)',       icon: '🎥', desc: 'Direct Kling video API' },
  { id: 'kling_secret', label: 'Kling (Secret)',    icon: '🎥', desc: 'Direct Kling video API secret' },
];

const ACTION_COLORS: Record<string, string> = {
  created:  'bg-green-900/50 text-green-300',
  rotated:  'bg-blue-900/50 text-blue-300',
  disabled: 'bg-red-900/50 text-red-300',
  enabled:  'bg-emerald-900/50 text-emerald-300',
  deleted:  'bg-red-900/50 text-red-300',
};

export default function AdminKeysPage() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<string | null>(null);
  const [newKey, setNewKey]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/keys');
      if (res.ok) setData(await res.json() as DashboardData);
    } catch (err) {
      console.error('Failed to load keys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleSaveKey(provider: string) {
    if (!newKey.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: newKey.trim() }),
      });
      const result = await res.json() as { ok?: boolean; action?: string; error?: string };
      if (!res.ok) throw new Error(result.error ?? 'Failed');
      setMsg({ ok: true, text: `Key ${result.action} successfully` });
      setNewKey('');
      setAddMode(null);
      void fetchData();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  async function handleToggle(provider: string, isActive: boolean) {
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, isActive }),
      });
      if (res.ok) void fetchData();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  }

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

  const keyMap = new Map(data.keys.map(k => [k.provider, k]));
  const totalSpend = Object.values(data.spendByProvider).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Platform API Keys</h1>
        <p className="mt-1 text-sm text-gray-400">
          Manage production API keys. Keys are encrypted at rest (AES-256-GCM).
        </p>
      </div>

      {/* Spend Summary */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-300">Platform Spend (30 days)</h2>
        <p className="text-2xl font-bold text-green-400">${totalSpend.toFixed(2)}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {Object.entries(data.spendByProvider)
            .sort(([, a], [, b]) => b - a)
            .map(([provider, cost]) => (
              <span key={provider} className="text-xs text-gray-400">
                {provider}: <span className="text-green-400">${cost.toFixed(2)}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <p className={`rounded-lg px-4 py-2 text-sm ${msg.ok ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {msg.text}
        </p>
      )}

      {/* Keys Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-800/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-left text-xs text-gray-500">
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3 text-right">Spend (30d)</th>
              <th className="px-4 py-3">Last Used</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {ALL_PROVIDERS.map(prov => {
              const k = keyMap.get(prov.id);
              const spend = data.spendByProvider[prov.id] ?? 0;
              const isAdding = addMode === prov.id;

              return (
                <tr key={prov.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-white">{prov.icon} {prov.label}</span>
                      <p className="text-[10px] text-gray-500">{prov.desc}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {k ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${k.isActive ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                        {k.isActive ? 'Active' : 'Disabled'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-xs text-gray-500">
                        Not set
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {k ? k.keyHint : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-green-400">
                    {spend > 0 ? `$${spend.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {k?.lastUsedAt
                      ? new Date(k.lastUsedAt).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {isAdding ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            value={newKey}
                            onChange={e => setNewKey(e.target.value)}
                            placeholder="Paste key..."
                            className="w-48 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-white/25"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveKey(prov.id)}
                            disabled={saving || !newKey.trim()}
                            className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {saving ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setAddMode(null); setNewKey(''); }}
                            className="rounded px-2 py-1 text-xs text-gray-400 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => { setAddMode(prov.id); setNewKey(''); }}
                            className="rounded border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                          >
                            {k ? 'Rotate' : 'Add'}
                          </button>
                          {k && (
                            <button
                              onClick={() => handleToggle(prov.id, !k.isActive)}
                              className={`rounded border px-2 py-1 text-xs ${
                                k.isActive
                                  ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                  : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                              }`}
                            >
                              {k.isActive ? 'Disable' : 'Enable'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Audit Log */}
      {data.auditLogs.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-300">Audit Log</h2>
          <div className="space-y-2">
            {data.auditLogs.map(a => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span className={`rounded px-1.5 py-0.5 text-xs ${ACTION_COLORS[a.action] ?? 'bg-gray-700 text-gray-300'}`}>
                  {a.action}
                </span>
                <span className="text-gray-400">{a.provider}</span>
                <span className="text-xs text-gray-500">by {a.adminEmail}</span>
                <span className="ml-auto whitespace-nowrap text-xs text-gray-500">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="rounded-xl border border-blue-900/30 bg-blue-950/20 p-4 text-xs text-blue-300">
        <p className="font-medium">How it works</p>
        <ul className="mt-1 space-y-0.5 text-blue-400">
          <li>• Platform keys serve all non-BYOK users (free + paid without own keys)</li>
          <li>• Users with their own BYOK keys always use their keys first</li>
          <li>• Keys are encrypted with AES-256-GCM, never stored in plaintext</li>
          <li>• All changes are logged in the audit trail</li>
        </ul>
      </div>
    </div>
  );
}
