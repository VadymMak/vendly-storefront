'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  FONT_CATALOG,
  CATEGORY_LABELS,
  type FontCategory,
  type FontEntry,
} from '@/lib/fonts/font-categories';
import { loadGoogleFont, loadGoogleFontBoth, loadCustomFont } from '@/lib/fonts/font-loader';

interface FontPickerProps {
  value: string;
  onChange: (family: string) => void;
}

type ActiveTab = FontCategory | 'custom' | null;

// ── FontItem — loads and previews a single font ────────────────────────────

interface FontItemProps {
  entry: FontEntry;
  selected: boolean;
  onSelect: (family: string) => void;
}

function FontItem({ entry, selected, onSelect }: FontItemProps) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadGoogleFontBoth(entry.family)
      .then(() => { if (!cancelled) { setLoaded(true); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entry.family]);

  return (
    <button
      onClick={() => onSelect(entry.family)}
      className={[
        'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors',
        selected
          ? 'bg-green-600/20 text-green-400'
          : 'text-gray-100 hover:bg-white/8 hover:text-white',
      ].join(' ')}
    >
      <span className="truncate">{entry.family}</span>
      <span
        className="ml-2 shrink-0 text-[15px] leading-none text-gray-300"
        style={{ fontFamily: loaded ? `'${entry.family}', sans-serif` : 'inherit' }}
      >
        {loading && !loaded ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-gray-400" />
        ) : (
          'Aa'
        )}
      </span>
    </button>
  );
}

// ── CustomFontItem ────────────────────────────────────────────────────────────

interface CustomFontItemProps {
  family: string;
  displayName: string;
  selected: boolean;
  onSelect: (family: string) => void;
}

function CustomFontItem({ family, displayName, selected, onSelect }: CustomFontItemProps) {
  return (
    <button
      onClick={() => onSelect(family)}
      className={[
        'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors',
        selected
          ? 'bg-green-600/20 text-green-400'
          : 'text-gray-100 hover:bg-white/8 hover:text-white',
      ].join(' ')}
    >
      <span className="truncate">{displayName}</span>
      <span
        className="ml-2 shrink-0 text-[15px] leading-none text-gray-300"
        style={{ fontFamily: `'${family}', sans-serif` }}
      >
        Aa
      </span>
    </button>
  );
}

// ── Main FontPicker ───────────────────────────────────────────────────────────

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [search, setSearch]                 = useState('');
  const [activeTab, setActiveTab]           = useState<ActiveTab>(null);
  const [customFonts, setCustomFonts]       = useState<{ family: string; name: string }[]>([]);
  const [uploadError, setUploadError]       = useState('');
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  const visibleFonts = useMemo<FontEntry[]>(() => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return FONT_CATALOG.filter(f => f.family.toLowerCase().includes(q));
    }
    if (activeTab === null) return FONT_CATALOG.filter(f => f.popular);
    if (activeTab === 'custom') return [];
    return FONT_CATALOG.filter(f => f.category === activeTab);
  }, [search, activeTab]);

  const handleSelect = useCallback((family: string) => {
    onChange(family);
  }, [onChange]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    try {
      const family = await loadCustomFont(file);
      const name   = file.name.replace(/\.[^.]+$/, '');
      setCustomFonts(prev => {
        const exists = prev.some(f => f.family === family);
        return exists ? prev : [...prev, { family, name }];
      });
      setActiveTab('custom');
      onChange(family);
    } catch {
      setUploadError('Failed to load font file');
    }
    e.target.value = '';
  }, [onChange]);

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: null,         label: '★' },
    { id: 'sans-serif',  label: CATEGORY_LABELS['sans-serif'] },
    { id: 'serif',       label: CATEGORY_LABELS['serif'] },
    { id: 'handwritten', label: CATEGORY_LABELS['handwritten'] },
    { id: 'display',     label: CATEGORY_LABELS['display'] },
    { id: 'monospace',   label: CATEGORY_LABELS['monospace'] },
    { id: 'custom',      label: 'Custom' },
  ];

  const sectionLabel = search.trim()
    ? `Results (${visibleFonts.length})`
    : activeTab === null
      ? '★ Popular'
      : activeTab === 'custom'
        ? 'Custom Fonts'
        : `${CATEGORY_LABELS[activeTab as FontCategory]} (${visibleFonts.length})`;

  return (
    <div className="select-none rounded bg-black/30">
      {/* Search */}
      <div className="px-2 pt-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search fonts..."
          className="w-full rounded bg-white/8 px-2 py-1 text-[11px] text-white outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-green-600/60"
        />
      </div>

      {/* Category tabs */}
      <div className="mt-1.5 flex gap-0.5 overflow-x-auto px-2 pb-1 scrollbar-none">
        {tabs.map(tab => (
          <button
            key={String(tab.id)}
            onClick={() => { setSearch(''); setActiveTab(tab.id); }}
            className={[
              'shrink-0 rounded px-2 py-0.5 text-[10px] transition-colors',
              activeTab === tab.id && !search.trim()
                ? 'bg-green-600 text-white'
                : 'bg-white/6 text-gray-300 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Font list */}
      <div className="px-1 pb-1">
        {activeTab !== 'custom' || search.trim() ? (
          <>
            <div className="mb-0.5 px-1 text-[9px] uppercase tracking-wider text-gray-400">
              {sectionLabel}
            </div>
            <div className="max-h-[180px] overflow-y-auto pr-0.5">
              {visibleFonts.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-gray-400">No fonts found</div>
              ) : (
                visibleFonts.map(entry => (
                  <FontItem
                    key={entry.family}
                    entry={entry}
                    selected={value === entry.family}
                    onSelect={handleSelect}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mb-0.5 px-1 text-[9px] uppercase tracking-wider text-gray-400">
              Custom Fonts
            </div>
            <div className="max-h-[180px] overflow-y-auto pr-0.5">
              {customFonts.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-gray-400">No custom fonts yet</div>
              ) : (
                customFonts.map(f => (
                  <CustomFontItem
                    key={f.family}
                    family={f.family}
                    displayName={f.name}
                    selected={value === f.family}
                    onSelect={handleSelect}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Upload button */}
      <div className="border-t border-white/6 px-2 py-1.5">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded bg-white/6 px-2 py-1 text-center text-[10px] text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          + Upload .ttf / .otf / .woff2
        </button>
        {uploadError && (
          <div className="mt-1 text-[10px] text-red-400">{uploadError}</div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf,.woff2"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
