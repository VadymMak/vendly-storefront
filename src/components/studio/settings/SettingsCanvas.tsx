'use client';

import { useEffect, useState } from 'react';
import { clearLibrary } from '@/lib/studio/library-store';

interface Props {
  userEmail: string;
  isSuperuser: boolean;
  planType: string;
}

interface KeyRecord { provider: string; keyHint: string }

export function SettingsCanvas({ userEmail, isSuperuser, planType }: Props) {
  const [falKey, setFalKey]             = useState('');
  const [fluxKey, setFluxKey]           = useState('');
  const [xaiKey, setXaiKey]             = useState('');
  const [openaiKey, setOpenaiKey]       = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [bflKey, setBflKey]             = useState('');
  const [klingKey, setKlingKey]         = useState('');
  const [klingSecret, setKlingSecret]   = useState('');
  const [hints, setHints]               = useState<Record<string, string>>({});
  const [isSaving, setIsSaving]         = useState(false);
  const [saveMsg, setSaveMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [libraryCleared, setLibraryCleared] = useState(false);
  const [apiKeysOpen, setApiKeysOpen]   = useState(false);

  useEffect(() => {
    fetch('/api/user/api-keys')
      .then(r => r.ok ? r.json() : [])
      .then((keys: KeyRecord[]) => {
        const map: Record<string, string> = {};
        for (const k of keys) map[k.provider] = k.keyHint;
        setHints(map);
      })
      .catch(() => {});
  }, []);

  async function saveProviderKey(provider: string, key: string) {
    const res = await fetch('/api/user/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key }),
    });
    const data = await res.json() as { keyHint?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? 'Failed to save');
    setHints(prev => ({ ...prev, [provider]: data.keyHint! }));
  }

  async function handleSaveKeys() {
    const toSave: Array<[string, string]> = [];
    if (falKey.trim())       toSave.push(['fal', falKey.trim()]);
    if (fluxKey.trim())      toSave.push(['replicate', fluxKey.trim()]);
    if (xaiKey.trim())       toSave.push(['xai', xaiKey.trim()]);
    if (openaiKey.trim())    toSave.push(['openai', openaiKey.trim()]);
    if (anthropicKey.trim()) toSave.push(['anthropic', anthropicKey.trim()]);
    if (bflKey.trim())       toSave.push(['bfl', bflKey.trim()]);
    if (klingKey.trim())     toSave.push(['kling_key', klingKey.trim()]);
    if (klingSecret.trim())  toSave.push(['kling_secret', klingSecret.trim()]);
    if (!toSave.length) return;

    setIsSaving(true);
    setSaveMsg(null);
    try {
      await Promise.all(toSave.map(([p, k]) => saveProviderKey(p, k)));
      setSaveMsg({ ok: true, text: 'Keys saved successfully' });
      setFalKey(''); setFluxKey(''); setXaiKey(''); setOpenaiKey(''); setAnthropicKey('');
      setBflKey(''); setKlingKey(''); setKlingSecret('');
    } catch (err) {
      setSaveMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to save — please try again' });
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

  const isPaid = planType === 'starter' || planType === 'pro';

  const apiKeysForm = (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      {/* fal.ai (Primary Video + Images) */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">fal.ai API Key (Primary Video)</label>
        <p className="mb-1 text-[10px] text-gray-600">Kling 3.0 video + Flux image generation — primary provider</p>
        {isSuperuser && !hints.fal && !falKey && (
          <p className="mb-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-400">
            ⚠️ Add your fal.ai key to generate videos
          </p>
        )}
        {hints.fal && !falKey && (
          <p className="mb-1 text-[10px] text-gray-500">Saved: {hints.fal}</p>
        )}
        <input
          type="password"
          value={falKey}
          onChange={e => setFalKey(e.target.value)}
          placeholder={hints.fal ? 'Replace saved key…' : 'fal-...'}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
        />
      </div>

      {/* Replicate (Image fallback) */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">Replicate API Key (Image fallback)</label>
        {isSuperuser && !hints.replicate && !fluxKey && (
          <p className="mb-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-400">
            ⚠️ Optional: used as fallback if fal.ai is unavailable
          </p>
        )}
        {hints.replicate && !fluxKey && (
          <p className="mb-1 text-[10px] text-gray-500">Saved: {hints.replicate}</p>
        )}
        <input
          type="password"
          value={fluxKey}
          onChange={e => setFluxKey(e.target.value)}
          placeholder={hints.replicate ? 'Replace saved key…' : 'r8_...'}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
        />
      </div>

      {/* xAI (Grok) */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">xAI API Key (Grok)</label>
        {hints.xai && !xaiKey && (
          <p className="mb-1 text-[10px] text-gray-500">Saved: {hints.xai}</p>
        )}
        <input
          type="password"
          value={xaiKey}
          onChange={e => setXaiKey(e.target.value)}
          placeholder={hints.xai ? 'Replace saved key…' : 'xai-...'}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
        />
      </div>

      {/* OpenAI */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">OpenAI API Key</label>
        {hints.openai && !openaiKey && (
          <p className="mb-1 text-[10px] text-gray-500">Saved: {hints.openai}</p>
        )}
        <input
          type="password"
          value={openaiKey}
          onChange={e => setOpenaiKey(e.target.value)}
          placeholder={hints.openai ? 'Replace saved key…' : 'sk-...'}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
        />
      </div>

      {/* Anthropic */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">Anthropic API Key</label>
        {hints.anthropic && !anthropicKey && (
          <p className="mb-1 text-[10px] text-gray-500">Saved: {hints.anthropic}</p>
        )}
        <input
          type="password"
          value={anthropicKey}
          onChange={e => setAnthropicKey(e.target.value)}
          placeholder={hints.anthropic ? 'Replace saved key…' : 'sk-ant-...'}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
        />
      </div>

      {/* BFL */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">BFL API Key (Flux Direct)</label>
        <p className="mb-1 text-[10px] text-gray-600">Black Forest Labs — direct Flux Pro image generation</p>
        {hints.bfl && !bflKey && (
          <p className="mb-1 text-[10px] text-gray-500">Saved: {hints.bfl}</p>
        )}
        <input
          type="password"
          value={bflKey}
          onChange={e => setBflKey(e.target.value)}
          placeholder={hints.bfl ? 'Replace saved key…' : 'bfl-...'}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
        />
      </div>

      {/* Kling */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">Kling API Key</label>
        {hints.kling_key && !klingKey && (
          <p className="mb-1 text-[10px] text-gray-500">Saved: {hints.kling_key}</p>
        )}
        <input
          type="password"
          value={klingKey}
          onChange={e => setKlingKey(e.target.value)}
          placeholder={hints.kling_key ? 'Replace saved key…' : 'Enter key…'}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-400">Kling API Secret</label>
        {hints.kling_secret && !klingSecret && (
          <p className="mb-1 text-[10px] text-gray-500">Saved: {hints.kling_secret}</p>
        )}
        <input
          type="password"
          value={klingSecret}
          onChange={e => setKlingSecret(e.target.value)}
          placeholder={hints.kling_secret ? 'Replace saved secret…' : 'Enter secret…'}
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
        disabled={isSaving || (!falKey && !fluxKey && !xaiKey && !openaiKey && !anthropicKey && !bflKey && !klingKey && !klingSecret)}
        className="min-h-[44px] rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Save API Keys'}
      </button>
    </div>
  );

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

        {/* Credits & Subscription */}
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">Credits & Subscription</h2>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm space-y-3">
            <p className="text-gray-400">Monthly credits reset on the 1st of each month.</p>
            {planType !== 'free' && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">
                    Current plan: <span className="text-white font-medium capitalize">{planType === 'byok_creator' ? 'BYOK Creator' : planType}</span>
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/studio/portal', { method: 'POST' });
                      const data = await res.json() as { url?: string };
                      if (data.url) window.location.href = data.url;
                    } catch (err) {
                      console.error('Portal error:', err);
                    }
                  }}
                  className="min-h-[44px] rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                >
                  Manage subscription →
                </button>
              </div>
            )}
            <a
              href="/studio/pricing"
              className="inline-flex min-h-[44px] items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              {planType === 'free' ? 'Upgrade plan →' : 'Buy more credits →'}
            </a>
          </div>
        </section>

        {/* API Keys — superuser: always visible */}
        {isSuperuser && (
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">API Keys</h2>
            <p className="text-xs text-gray-600">Connect your own AI accounts at direct provider cost. Keys are encrypted at rest.</p>
            {apiKeysForm}
          </section>
        )}

        {/* API Keys — paid users: collapsible */}
        {!isSuperuser && isPaid && (
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setApiKeysOpen(o => !o)}
              className="flex w-full items-center justify-between"
            >
              <div>
                <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500 text-left">Advanced Settings</h2>
                <p className="text-xs text-gray-600 text-left">Connect your own AI accounts for premium model access</p>
              </div>
              <span className="text-gray-500 text-xs ml-4">{apiKeysOpen ? '▲' : '▼'}</span>
            </button>
            {apiKeysOpen && apiKeysForm}
          </section>
        )}

        {/* API Keys — free users: upgrade prompt */}
        {!isSuperuser && !isPaid && (
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">Video Generation</h2>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <p className="text-gray-400">Upgrade to Starter plan or buy credits to generate videos.</p>
              <a
                href="/studio/pricing"
                className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Upgrade plan →
              </a>
            </div>
          </section>
        )}

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
