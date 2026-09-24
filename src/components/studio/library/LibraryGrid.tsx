'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStudioStore } from '@/lib/studio/store';

type FilterType = 'all' | 'image' | 'video';

interface WorkItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  model: string;
  style: string;
  operation: string;
  createdAt: string;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function LibraryCard({
  item,
  onAnimate,
  onAddToAssemble,
  onDownload,
  onDelete,
}: {
  item: WorkItem;
  onAnimate: () => void;
  onAddToAssemble: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const label = item.style || item.operation || item.type;
  return (
    <div className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors hover:border-white/20">
      {/* Media */}
      <div className="relative overflow-hidden">
        {item.type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={label} className="w-full object-cover" loading="lazy" />
        ) : (
          <video src={item.url} className="w-full object-cover" muted playsInline />
        )}

        {/* Type badge */}
        <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white">
          {item.type === 'image' ? 'Image' : 'Video'}
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-gray-400 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
          aria-label="Delete"
        >
          <IconX size={12} />
        </button>
      </div>

      {/* Style + meta */}
      <div className="p-3">
        <p className="line-clamp-1 text-xs font-medium capitalize text-gray-300">{label}</p>
        <p className="mt-0.5 text-xs text-gray-600">
          {new Date(item.createdAt).toLocaleDateString()}
          {item.model && ` · ${item.model}`}
        </p>

        {/* Action buttons */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {item.type === 'image' && (
            <button
              onClick={onAnimate}
              className="min-h-[36px] rounded-lg bg-green-600/20 px-2.5 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-600/30"
            >
              Animate →
            </button>
          )}
          <button
            onClick={onAddToAssemble}
            className="min-h-[36px] rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/15 hover:text-white"
          >
            + Assemble
          </button>
          <button
            onClick={onDownload}
            className="min-h-[36px] rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/15 hover:text-white"
          >
            Download
          </button>
          <button
            onClick={onDelete}
            className="min-h-[36px] rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-red-500/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────

export function LibraryGrid() {
  const router = useRouter();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/studio/my-work?limit=50')
      .then(r => r.ok ? r.json() : { items: [] })
      .then((data: { items: WorkItem[] }) => {
        setItems(data.items ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const filtered = items.filter(item => {
    if (filter !== 'all' && item.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!item.style.toLowerCase().includes(q) && !item.model.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function handleAnimate(item: WorkItem) {
    if (item.type !== 'image') return;
    router.push(`/studio/animate?image=${encodeURIComponent(item.url)}&prompt=`);
  }

  function handleAddToAssemble(item: WorkItem) {
    const store = useStudioStore.getState();
    store.initDefaultTracks();
    const vt = useStudioStore.getState().timelineTracks.find(t => t.type === 'video');
    if (vt) {
      const sorted = [...vt.clips].sort((a, b) => a.startTime - b.startTime);
      const last = sorted.at(-1);
      const startTime = last ? last.startTime + last.duration : 0;
      store.addClipToTrack(vt.id, {
        type: item.type as 'video' | 'image',
        startTime,
        duration: item.type === 'video' ? 5 : 3,
        sourceUrl: item.url,
        prompt: '',
      });
    }
    router.push('/studio/assemble');
  }

  async function handleDownload(item: WorkItem) {
    const ext = item.type === 'video' ? 'mp4' : 'webp';
    const filename = `studio-${item.type}-${Date.now()}.${ext}`;
    try {
      if (item.type === 'video') {
        window.location.assign(`/api/studio/download-video?jobId=${encodeURIComponent(item.id)}`);
        return;
      }

      let blob: Blob;
      if (item.url.startsWith('blob:')) {
        const res = await fetch(item.url);
        blob = await res.blob();
      } else {
        try {
          const directRes = await fetch(item.url);
          if (directRes.ok) {
            blob = await directRes.blob();
          } else {
            throw new Error(`Direct: ${directRes.status}`);
          }
        } catch {
          const proxyUrl = `/api/studio/proxy-image?url=${encodeURIComponent(item.url)}&download=${encodeURIComponent(filename)}`;
          const proxyRes = await fetch(proxyUrl);
          if (!proxyRes.ok) throw new Error(`Proxy: ${proxyRes.status}`);
          blob = await proxyRes.blob();
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: objectUrl,
        download: filename,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch (err) {
      console.error('[download]', err);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-base font-semibold text-white">Library</h1>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {(['all', 'image', 'video'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  'min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  filter === f ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                {f === 'all' ? 'All' : f === 'image' ? 'Images' : 'Videos'}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search style or model…"
            className="ml-auto rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/20"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {!loaded ? (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="mb-4 h-48 animate-pulse break-inside-avoid rounded-xl bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            {items.length === 0 ? (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-gray-600">
                  <IconGrid />
                </div>
                <div>
                  <p className="font-medium text-gray-300">Nothing here yet</p>
                  <p className="mt-1 text-sm text-gray-500">Generate images or videos to see them here</p>
                </div>
                <button
                  onClick={() => router.push('/studio/generate')}
                  className="min-h-[44px] rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Start generating →
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">No results for &ldquo;{search}&rdquo;</p>
            )}
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {filtered.map(item => (
              <LibraryCard
                key={item.id}
                item={item}
                onAnimate={() => handleAnimate(item)}
                onAddToAssemble={() => handleAddToAssemble(item)}
                onDownload={() => handleDownload(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
