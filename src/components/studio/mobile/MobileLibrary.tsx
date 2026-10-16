'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { compressImage } from '@/lib/studio/compress-image';
import { MAX_REEL_PHOTOS, isPhonePhoto, readPhonePhotos, readReelPhotos, reelPhotoFromWork, writePhonePhotos, writeReelPhotos } from '@/lib/studio/mobile/reel';
import type { ReelPhoto, StudioWorkItem, StudioWorkPage } from '@/lib/types';

type Filter = 'all' | 'image' | 'video';
// Reel select mode browses images only: AI results, the user's own photos, or fresh uploads from the phone
type ReelSource = 'library' | 'gallery' | 'phone';
type View = Filter | `select-${ReelSource}`;

const PAGE_SIZE = 30;
// Phone multi-select uploads in flight at once — keeps the upload route and slow mobile links unclogged
const PHONE_UPLOAD_CONCURRENCY = 3;
const SELECT_MODE_PATH = '/studio/m/library';
// Grid tiles go through Next's image optimizer (a ~5 KB thumbnail instead of the up-to-6 MB
// original). Only hosts in next.config remotePatterns can be optimized — others load as-is.
const OPTIMIZABLE_URL = /^https:\/\/(vendshop\.shop\/uploads\/|[^/]+\.public\.blob\.vercel-storage\.com\/)/;
const TILE_SIZES = '(max-width: 640px) 34vw, 220px';
const FILTERS: { id: Filter; key: 'filterAll' | 'filterImages' | 'filterVideos' }[] = [
  { id: 'all', key: 'filterAll' },
  { id: 'image', key: 'filterImages' },
  { id: 'video', key: 'filterVideos' },
];

const SOURCES: { id: ReelSource; key: 'sourceLibrary' | 'sourceGallery' | 'sourcePhone' }[] = [
  { id: 'library', key: 'sourceLibrary' },
  { id: 'gallery', key: 'sourceGallery' },
  { id: 'phone', key: 'sourcePhone' },
];

async function fetchWork(view: View, cursor?: string): Promise<StudioWorkPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (view === 'select-library') params.set('type', 'image');
  else if (view === 'select-gallery') params.set('source', 'uploads');
  else if (view !== 'all') params.set('type', view);
  if (cursor) params.set('cursor', cursor);
  const res = await fetch(`/api/studio/my-work?${params}`);
  if (!res.ok) throw new Error(`my-work ${res.status}`);
  return res.json() as Promise<StudioWorkPage>;
}

interface Loaded {
  filter: View;
  items: StudioWorkItem[];
  nextCursor: string | null;
  error: boolean;
}

interface Props {
  /** Opened from Reel Quality Check "+" — start in select mode with the current reel photos */
  initialSelect?: boolean;
  /** Opened from Home "Create Reel" card — show hint banner */
  reelSelectMode?: boolean;
}

export function MobileLibrary({ initialSelect = false, reelSelectMode = false }: Props) {
  const t = useTranslations('mobile.library');
  const tReel = useTranslations('mobile.reel');
  const router = useRouter();
  // Also read the live URL: enterSelectMode adds ?select=1 with replaceState, and Back restores this
  // page from Next's client cache — rendered with the props of the URL as it was before that
  const searchParams = useSearchParams();
  const startInSelect = initialSelect || searchParams.get('select') === '1';
  const [filter, setFilter] = useState<Filter>('all');
  const [selectMode, setSelectMode] = useState(startInSelect);
  // Frozen at mount — entering select mode later changes the URL but must not re-restore
  const [restoreOnMount] = useState(startInSelect);
  const [source, setSource] = useState<ReelSource>('library');
  // Keyed by id and kept across source tabs — the grid only holds the current tab's items
  const [selected, setSelected] = useState<Map<string, ReelPhoto>>(() => new Map());
  const view: View = selectMode ? `select-${source}` : filter;
  // Data is tagged with the view it was loaded for — a mismatch means a load is in flight
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Items whose media failed to load (expired blob, deleted file) — dropped from the grid
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set());
  // Phone uploads aren't studio jobs, so no other tab lists them — kept in sessionStorage (restored
  // on mount) so they're still on the phone tab after Quality Check "+" or back-navigation
  const [phonePhotos, setPhonePhotos] = useState<ReelPhoto[]>([]);
  // Nothing is written back until the stored list has been read — or the first render would wipe it
  const [phonePhotosRestored, setPhonePhotosRestored] = useState(false);
  // Multi-select batch: photos picked and photos finished (ok or failed) — count 0 = idle
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);
  const uploading = uploadCount > 0;
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loading = loaded?.filter !== view;
  const visibleItems = loaded ? loaded.items.filter((item) => !brokenIds.has(item.id)) : [];

  function markBroken(id: string) {
    setBrokenIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  useEffect(() => {
    // The phone tab has nothing to fetch
    if (view === 'select-phone') return;
    let cancelled = false;
    fetchWork(view)
      .then((d) => { if (!cancelled) setLoaded({ filter: view, items: d.items, nextCursor: d.nextCursor, error: false }); })
      .catch(() => { if (!cancelled) setLoaded({ filter: view, items: [], nextCursor: null, error: true }); });
    return () => { cancelled = true; };
  }, [view, reloadKey]);

  // Back from Quality Check "+": keep what is already in the reel (sessionStorage is client-only).
  // Selected phone photos join the phone grid too — the count must match what the tabs show.
  useEffect(() => {
    const restored = restoreOnMount ? readReelPhotos() : [];
    if (restoreOnMount) setSelected(new Map(restored.map((p) => [p.id, p])));
    const stored = readPhonePhotos();
    const missing = restored.filter((p) => isPhonePhoto(p) && !stored.some((s) => s.id === p.id));
    setPhonePhotos([...stored, ...missing]);
    setPhonePhotosRestored(true);
  }, [restoreOnMount]);

  useEffect(() => {
    if (phonePhotosRestored) writePhonePhotos(phonePhotos);
  }, [phonePhotos, phonePhotosRestored]);

  // A phone photo whose file is gone leaves the grid and the selection together
  function dropPhonePhoto(id: string) {
    setPhonePhotos((prev) => prev.filter((p) => p.id !== id));
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  // The URL mirrors select mode, so Back from Quality Check (header or system) lands here in select
  // mode and the mount restore brings the selection back. Next syncs native history calls.
  function enterSelectMode() {
    setSelectMode(true);
    window.history.replaceState(null, '', `${SELECT_MODE_PATH}?select=1`);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Map());
    window.history.replaceState(null, '', SELECT_MODE_PATH);
  }

  function toggleSelected(item: StudioWorkItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else if (next.size < MAX_REEL_PHOTOS) next.set(item.id, reelPhotoFromWork(item, source === 'phone' ? 'gallery' : source));
      return next;
    });
  }

  function togglePhonePhoto(photo: ReelPhoto) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(photo.id)) next.delete(photo.id);
      else if (next.size < MAX_REEL_PHOTOS) next.set(photo.id, photo);
      return next;
    });
  }

  /** Uploads one photo and auto-selects it while the reel has room. Throws on failure. */
  async function uploadPhonePhoto(file: File) {
    const compressed = await compressImage(file);
    const fd = new FormData();
    fd.append('image', compressed);
    const res = await fetch('/api/studio/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(res.status === 401 ? 'unauthorized' : `upload ${res.status}`);
    const data = await res.json() as { url: string; originalUrl?: string };
    // Treated as the user's own photo ('gallery') so Quality Check handles it like "My photos"
    const photo: ReelPhoto = {
      id: `phone-${crypto.randomUUID()}`,
      url: data.url,
      originalUrl: data.originalUrl,
      operation: 'upload',
      generationMode: null,
      source: 'gallery',
    };
    setPhonePhotos((prev) => [photo, ...prev]);
    setSelected((prev) => {
      if (prev.size >= MAX_REEL_PHOTOS) return prev;
      return new Map(prev).set(photo.id, photo);
    });
  }

  // Multi-select from the phone: at most PHONE_UPLOAD_CONCURRENCY uploads in flight
  async function handlePhoneUploads(files: File[]) {
    setUploadCount(files.length);
    setUploadDone(0);
    setUploadError(null);
    const queue = [...files];
    let failed = 0;
    let sessionExpired = false;
    const workers = Array.from({ length: Math.min(PHONE_UPLOAD_CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0 && !sessionExpired) {
        const file = queue.shift()!;
        try {
          await uploadPhonePhoto(file);
        } catch (e) {
          failed += 1;
          // Every remaining upload would fail the same way
          if (e instanceof Error && e.message === 'unauthorized') sessionExpired = true;
        }
        setUploadDone((n) => n + 1);
      }
    });
    await Promise.all(workers);
    if (sessionExpired) setUploadError(tReel('sessionExpired'));
    else if (failed === files.length) setUploadError(tReel('uploadFailed'));
    else if (failed > 0) setUploadError(tReel('uploadPartial', { done: files.length - failed, total: files.length }));
    setUploadCount(0);
  }

  function handleCreateReel() {
    writeReelPhotos([...selected.values()]);
    // Tells Quality Check that the previous history entry is this picker (its Back = history back)
    router.push('/studio/m/reel/check?from=library');
  }

  async function loadMore() {
    if (!loaded?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const d = await fetchWork(loaded.filter, loaded.nextCursor);
      setLoaded((prev) => (prev && prev.filter === loaded.filter
        ? { ...prev, items: [...prev.items, ...d.items], nextCursor: d.nextCursor }
        : prev));
    } catch {
      // keep what we have; the button stays so the user can retry
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className={`flex flex-col ${selectMode ? 'pb-36' : 'pb-6'}`} style={{ animation: 'wizardSlideRight 0.3s ease-out' }}>
      {/* Header */}
      {selectMode ? (
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <h1 className="text-base font-semibold text-white">{tReel('selected', { count: selected.size })}</h1>
          <button
            onClick={exitSelectMode}
            className="min-h-11 rounded-full px-4 text-sm font-medium text-gray-300 active:bg-white/[0.06]"
          >
            {tReel('cancel')}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <Link
            href="/studio/m"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-gray-400"
            aria-label={t('back')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 className="flex-1 text-base font-semibold text-white">{t('title')}</h1>
          <button
            onClick={enterSelectMode}
            className="min-h-11 rounded-full px-4 text-sm font-medium text-green-400 active:bg-white/[0.06]"
          >
            {tReel('select')}
          </button>
        </div>
      )}

      {/* Reel-select mode hint */}
      {reelSelectMode && selectMode && selected.size === 0 && (
        <div className="mx-4 mb-2 p-3 bg-green-500/10 rounded-xl text-center">
          <p className="text-white text-sm">{tReel('selectPhotosHint')}</p>
        </div>
      )}

      {/* Source tabs (select mode) — selection carries over between them */}
      {selectMode ? (
        <div className="flex gap-2 px-4 pb-3" role="tablist">
          {SOURCES.map(({ id, key }) => (
            <button
              key={id}
              role="tab"
              aria-selected={source === id}
              onClick={() => setSource(id)}
              className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                source === id ? 'bg-green-600 text-white' : 'bg-white/[0.06] text-gray-400 active:bg-white/[0.12]'
              }`}
            >
              {tReel(key)}
            </button>
          ))}
        </div>
      ) : (
        /* Filter tabs */
        <div className="flex gap-2 px-4 pb-3" role="tablist">
          {FILTERS.map(({ id, key }) => (
            <button
              key={id}
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                filter === id ? 'bg-green-600 text-white' : 'bg-white/[0.06] text-gray-400 active:bg-white/[0.12]'
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}

      {selectMode && source === 'phone' ? (
        <div className="px-4 pb-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || selected.size >= MAX_REEL_PHOTOS}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/20 bg-white/[0.04] py-6 text-sm text-gray-300 active:bg-white/[0.08] disabled:opacity-50"
          >
            {uploading ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />
                {tReel('uploadProgress', { done: uploadDone, total: uploadCount })}
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {tReel('uploadFromGallery')}
              </>
            )}
          </button>
          {uploadError && <p className="mt-2 text-center text-xs text-red-400">{uploadError}</p>}

          {phonePhotos.length > 0 && (
            <div className="-mx-4 mt-3 grid grid-cols-3 gap-0.5">
              {phonePhotos.map((photo) => (
                <SelectableTile
                  key={photo.id}
                  url={photo.url}
                  label={t('imageLabel')}
                  selected={selected.has(photo.id)}
                  disabled={!selected.has(photo.id) && selected.size >= MAX_REEL_PHOTOS}
                  onToggle={() => togglePhonePhoto(photo)}
                  onBroken={() => dropPhonePhoto(photo.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-3 gap-0.5" aria-busy="true">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="aspect-square animate-pulse bg-white/[0.06]" />
          ))}
        </div>
      ) : loaded.error ? (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="text-sm text-gray-400">{t('error')}</p>
          <button
            onClick={() => { setLoaded(null); setReloadKey((k) => k + 1); }}
            className="min-h-11 rounded-full border border-white/10 px-6 text-sm text-gray-300"
          >
            {t('retry')}
          </button>
        </div>
      ) : visibleItems.length === 0 && !loaded.nextCursor ? (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="text-base font-semibold text-white">{t('empty')}</p>
          <Link
            href="/studio/m/create"
            className="flex min-h-11 items-center rounded-2xl bg-green-600 px-6 text-sm font-semibold text-white active:bg-green-700"
          >
            {t('emptyAction')}
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-0.5">
            {visibleItems.map((item) =>
              item.type === 'video' ? (
                // Videos open the file itself — the Editor Hub is image-only
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-square overflow-hidden bg-white/[0.04]"
                  aria-label={t('videoLabel')}
                >
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline onError={() => markBroken(item.id)} className="h-full w-full object-cover" />
                  <span className="absolute right-1.5 bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                  </span>
                </a>
              ) : selectMode ? (
                <SelectableTile
                  key={item.id}
                  url={item.url}
                  label={t('imageLabel')}
                  selected={selected.has(item.id)}
                  disabled={!selected.has(item.id) && selected.size >= MAX_REEL_PHOTOS}
                  onToggle={() => toggleSelected(item)}
                  onBroken={() => markBroken(item.id)}
                />
              ) : (
                <Link
                  key={item.id}
                  href={`/studio/m/result/${item.id}`}
                  className="relative aspect-square overflow-hidden bg-white/[0.04] active:opacity-80"
                >
                  {/* Generic alt — the prompt must never leak into the page as fallback text */}
                  <Image
                    src={item.url}
                    alt={t('imageLabel')}
                    fill
                    sizes={TILE_SIZES}
                    unoptimized={!OPTIMIZABLE_URL.test(item.url)}
                    onError={() => markBroken(item.id)}
                    className="object-cover"
                  />
                </Link>
              ),
            )}
          </div>

          {loaded.nextCursor && (
            <div className="flex justify-center px-4 pt-5">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-6 text-sm text-gray-300 active:bg-white/[0.08] disabled:opacity-60"
              >
                {loadingMore && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-green-500" />}
                {t('loadMore')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Upload from phone on every source tab — sits above the Reel bar when it is shown */}
      {selectMode && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || selected.size >= MAX_REEL_PHOTOS}
          className={`fixed right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 shadow-lg active:bg-green-700 disabled:opacity-50 ${
            selected.size > 0 ? 'bottom-[calc(11.5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(5rem+env(safe-area-inset-bottom))]'
          }`}
          aria-label={tReel('uploadFromGallery')}
        >
          {uploading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          // Only as many as the reel still has room for — extra picks are dropped
          const toUpload = files.slice(0, Math.max(0, MAX_REEL_PHOTOS - selected.size));
          if (toUpload.length > 0) void handlePhoneUploads(toUpload);
        }}
      />

      {/* Reel bar sits above the bottom nav (4rem + safe area) */}
      {selectMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-white/10 bg-[#0a0a0f]/95 p-4 backdrop-blur-md">
          <p className="mb-2 text-center text-sm text-gray-400">
            {tReel('selected', { count: selected.size })} · {tReel('maxPhotos', { max: MAX_REEL_PHOTOS })}
          </p>
          <button
            onClick={handleCreateReel}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-green-600 py-3 text-base font-semibold text-white active:bg-green-700"
          >
            {tReel('checkPhotos')}
          </button>
        </div>
      )}
    </div>
  );
}

interface SelectableTileProps {
  url: string;
  label: string;
  selected: boolean;
  /** Reel is full — only selected tiles can be toggled */
  disabled: boolean;
  onToggle: () => void;
  onBroken: () => void;
}

function SelectableTile({ url, label, selected, disabled, onToggle, onBroken }: SelectableTileProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className="relative aspect-square overflow-hidden bg-white/[0.04] disabled:opacity-40"
    >
      <Image
        src={url}
        alt={label}
        fill
        sizes={TILE_SIZES}
        unoptimized={!OPTIMIZABLE_URL.test(url)}
        onError={onBroken}
        className={`object-cover transition-transform ${selected ? 'scale-90 rounded-lg' : ''}`}
      />
      <span
        className={`absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
          selected ? 'border-green-500 bg-green-500 text-white' : 'border-white/80 bg-black/30'
        }`}
        aria-hidden="true"
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
    </button>
  );
}
