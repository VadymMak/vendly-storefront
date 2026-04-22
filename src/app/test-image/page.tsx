'use client';

import { useState } from 'react';

export default function TestImagePage() {
  const [prompt, setPrompt]   = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [width, setWidth]       = useState(1024);
  const [height, setHeight]     = useState(768);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const res = await fetch('/api/generate-image', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, width, height }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Generation failed');
      setImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-[#1e293b] border border-[#334155] text-[#e2e8f0] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#16a34a]';

  return (
    <div className="min-h-screen bg-[#0b1220] text-[#e2e8f0] p-8">
      <div className="max-w-2xl mx-auto grid gap-5">
        <div>
          <h1 className="text-2xl font-bold mb-1">Flux Schnell — Image Test</h1>
          <p className="text-sm text-[#64748b]">Dev-only page · /api/generate-image</p>
        </div>

        <div className="grid gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Prompt</label>
            <textarea
              className={`${inputCls} resize-y min-h-[80px]`}
              placeholder="A modern barbershop interior, warm lighting, wooden accents, minimalist style"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Width</label>
              <input
                type="number"
                className={inputCls}
                value={width}
                min={256} max={1440} step={64}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Height</label>
              <input
                type="number"
                className={inputCls}
                value={height}
                min={256} max={1440} step={64}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </div>
          </div>

          <button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            className="w-full py-3 rounded-lg font-semibold text-[#052e13] bg-[#16a34a] hover:bg-[#22c55e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#f87171] text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="aspect-video rounded-xl bg-[#1e293b] border border-[#253349] animate-pulse flex items-center justify-center text-[#475569] text-sm">
            Generating {width}×{height}…
          </div>
        )}

        {imageUrl && (
          <div className="grid gap-2">
            <img
              src={imageUrl}
              alt="Generated"
              className="w-full rounded-xl border border-[#253349]"
            />
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#64748b] hover:text-[#94a3b8] break-all"
            >
              {imageUrl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
