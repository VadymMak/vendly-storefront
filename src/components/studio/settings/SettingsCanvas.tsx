'use client';

import { useState } from 'react';
import { clearLibrary } from '@/lib/studio/library-store';

interface Props {
  userEmail: string;
}

export function SettingsCanvas({ userEmail }: Props) {
  const [fluxKey, setFluxKey] = useState('');
  const [klingKey, setKlingKey] = useState('');
  const [klingSecret, setKlingSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [libraryCleared, setLibraryCleared] = useState(false);

  async function handleSaveKeys() {
    const body: Record<string, string> = {};
    if (fluxKey.trim())   body.fluxKey   = fluxKey.trim();
    if (klingKey.trim())  body.klingKey  = klingKey.trim();
    if (klingSecret.trim()) body.klingSecret = klingSecret.trim();
    if (!Object.keys(body).length) return;

    setIsSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/studio/byok-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaveMsg({ ok: true, text: 'Keys saved successfully' });
      setFluxKey(''); setKlingKey(''); setKlingSecret('');
    } catch {
      setSaveMsg({ ok: false, text: 'Failed to save — please try again' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  }

  function handleClearLibrary() {
    clearLibrary();
    setLibraryCleared(true);
    setTimeout(() => setLibraryCleared(false), 3000);
  }

  return (
    <div className="overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-7">
        <h1 className="text-lg font-semibold text-white">Settings</h1>

        {/* Account */}
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">Account</h2>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-400">Email</span>
              <span className="text-white">{userEmail}</span>
            </div>
          </div>
        </section>

        {/* Credits */}
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">Credits</h2>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-gray-400">Monthly credits reset on the 1st of each month.</p>
            <a
              href="/studio/pricing"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Buy more credits →
            </a>
          </div>
        </section>

        {/* BYOK */}
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">API Keys (Bring Your Own Key)</h2>
          <p className="text-xs text-gray-600">Use your own API keys for unlimited usage. Keys are encrypted at rest.</p>
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Flux API Key (Replicate)</label>
              <input
                type="password"
                value={fluxKey}
                onChange={e => setFluxKey(e.target.value)}
                placeholder="r8_..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25 focus:bg-white/8"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Kling API Key</label>
              <input
                type="password"
                value={klingKey}
                onChange={e => setKlingKey(e.target.value)}
                placeholder="Enter key…"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Kling API Secret</label>
              <input
                type="password"
                value={klingSecret}
                onChange={e => setKlingSecret(e.target.value)}
                placeholder="Enter secret…"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
              />
            </div>

            {saveMsg && (
              <p className={['text-xs', saveMsg.ok ? 'text-green-400' : 'text-red-400'].join(' ')}>
                {saveMsg.text}
              </p>
            )}

            <button
              onClick={handleSaveKeys}
              disabled={isSaving || (!fluxKey && !klingKey && !klingSecret)}
              className="min-h-[44px] rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save API Keys'}
            </button>
          </div>
        </section>

        {/* Data */}
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">Data</h2>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-300">Clear Library</p>
                <p className="text-xs text-gray-500">Remove all generation history from this device</p>
              </div>
              <button
                onClick={handleClearLibrary}
                className="min-h-[44px] rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
              >
                {libraryCleared ? '✓ Cleared' : 'Clear library'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
