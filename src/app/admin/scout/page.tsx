'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = 'New' | 'Contacted' | 'Demo Sent' | 'Sold';

const STATUS_OPTIONS: LeadStatus[] = ['New', 'Contacted', 'Demo Sent', 'Sold'];

const STATUS_COLORS: Record<LeadStatus, string> = {
  'New':       'bg-yellow-500/20 text-yellow-300 border-yellow-700',
  'Contacted': 'bg-blue-500/20 text-blue-300 border-blue-700',
  'Demo Sent': 'bg-purple-500/20 text-purple-300 border-purple-700',
  'Sold':      'bg-green-500/20 text-green-300 border-green-700',
};

interface ApifyPlace {
  title?: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  totalScore?: number;
  address?: string;
  categoryName?: string;
}

interface ScoutLead {
  id: string;
  title: string;
  phone: string;
  website: string | null;
  rating: number;
  address: string;
  category: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'admin-scout-statuses';

function makeId(item: ApifyPlace, idx: number): string {
  const slug = (item.title ?? '').toLowerCase().replace(/\s+/g, '-').slice(0, 24);
  return `${idx}-${slug}`;
}

function transformLeads(raw: ApifyPlace[]): ScoutLead[] {
  return raw.map((item, i) => ({
    id:       makeId(item, i),
    title:    item.title ?? '—',
    phone:    item.phoneUnformatted ?? item.phone ?? '',
    website:  item.website ?? null,
    rating:   item.totalScore ?? 0,
    address:  item.address ?? '—',
    category: item.categoryName ?? '—',
  }));
}

function buildCsv(leads: ScoutLead[], statuses: Record<string, LeadStatus>, city: string): string {
  const header = ['Business', 'Phone', 'Website', 'Rating', 'Address', 'Category', 'Status'].join(',');
  const rows = leads.map(l => [
    `"${l.title.replace(/"/g, '""')}"`,
    `"${l.phone}"`,
    l.website ? `"${l.website}"` : 'NO',
    l.rating.toFixed(1),
    `"${l.address.replace(/"/g, '""')}"`,
    `"${l.category}"`,
    `"${statuses[l.id] ?? 'New'}"`,
  ].join(','));
  return [header, ...rows].join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScoutPage() {
  const router = useRouter();

  const [query, setQuery]               = useState('');
  const [city, setCity]                 = useState('Trenčín');
  const [maxResults, setMaxResults]     = useState(50);
  const [loading, setLoading]           = useState(false);
  const [results, setResults]           = useState<ScoutLead[]>([]);
  const [filterNoWebsite, setFilterNoWebsite] = useState(false);
  const [statuses, setStatuses]         = useState<Record<string, LeadStatus>>({});
  const [toast, setToast]               = useState<string | null>(null);
  const [searched, setSearched]         = useState(false);
  const [page, setPage]                 = useState(1);
  const perPage = 25;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setStatuses(JSON.parse(saved) as Record<string, LeadStatus>);
    } catch { /* ignore */ }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const setStatus = useCallback((id: string, status: LeadStatus) => {
    setStatuses(prev => {
      const next = { ...prev, [id]: status };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || !city.trim()) return;
    setLoading(true);
    setSearched(true);
    setResults([]);
    try {
      const res = await fetch('/api/admin/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), city: city.trim(), maxResults }),
      });
      const data = await res.json() as { results?: ApifyPlace[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResults(transformLeads(data.results ?? []));
      setPage(1);
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Search failed'}`);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const csv = buildCsv(displayResults, statuses, city);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scout-${query}-${city}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCreateDemo(lead: ScoutLead) {
    localStorage.setItem('pendingDemo', JSON.stringify({
      name: lead.title, phone: lead.phone, city, address: lead.address,
    }));
    const params = new URLSearchParams({ name: lead.title, phone: lead.phone, city });
    showToast('✓ Opening site generator...');
    setTimeout(() => router.push(`/create?${params.toString()}`), 800);
  }

  const displayResults = filterNoWebsite
    ? results.filter(l => !l.website)
    : results;

  const noWebsiteCount  = results.filter(l => !l.website).length;
  const totalPages      = Math.ceil(displayResults.length / perPage);
  const paginatedResults = displayResults.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Leads Scout</h1>
        <p className="mt-1 text-sm text-gray-400">
          Find businesses without websites via Google Places (Apify)
        </p>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        className="rounded-xl border border-[#374151] bg-[#1E293B] p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Business Type
            </label>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="florist, barber, auto repair, restaurant..."
              className="w-full rounded-lg border border-[#374151] bg-[#0F172A] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-indigo-500"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Trenčín, Bratislava, Praha..."
              className="w-full rounded-lg border border-[#374151] bg-[#0F172A] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-indigo-500"
            />
          </div>
          <div className="w-32 shrink-0">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Max Results
            </label>
            <select
              value={maxResults}
              onChange={e => setMaxResults(Number(e.target.value))}
              className="w-full rounded-lg border border-[#374151] bg-[#0F172A] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim() || !city.trim()}
            className="flex h-[42px] shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Search
              </>
            )}
          </button>
        </div>

        {loading && (
          <p className="mt-3 text-xs text-gray-500">
            Querying Google Places via Apify — searching up to {maxResults} places,
            may take {maxResults > 50 ? '1–3 minutes' : '20–60 seconds'}...
          </p>
        )}
      </form>

      {/* Results section */}
      {searched && !loading && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={filterNoWebsite}
                  onChange={e => { setFilterNoWebsite(e.target.checked); setPage(1); }}
                  className="h-4 w-4 accent-indigo-500"
                />
                Show without website only
              </label>
              <span className="text-xs text-gray-500">
                {displayResults.length} of {results.length} results
                {noWebsiteCount > 0 && (
                  <>
                    {' · '}
                    <span className="text-amber-400">{noWebsiteCount} without website</span>
                  </>
                )}
              </span>
            </div>

            {displayResults.length > 0 && (
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 rounded-lg border border-[#374151] bg-[#1E293B] px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-[#263349]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export CSV
              </button>
            )}
          </div>

          {/* Empty state */}
          {displayResults.length === 0 ? (
            <div className="rounded-xl border border-[#374151] bg-[#1E293B] py-16 text-center">
              <p className="text-gray-500">No results found. Try different search terms.</p>
            </div>
          ) : (
            <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-[#374151]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#374151] bg-[#0F172A]">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">#</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Business</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Website</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Rating</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Address</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#374151] bg-[#1E293B]">
                  {paginatedResults.map((lead, i) => {
                    const status = statuses[lead.id] ?? 'New';
                    return (
                      <tr key={lead.id} className="transition-colors hover:bg-[#263349]">
                        <td className="px-4 py-3 text-xs text-gray-600">{(page - 1) * perPage + i + 1}</td>

                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{lead.title}</p>
                          <p className="text-xs text-gray-500">{lead.category}</p>
                        </td>

                        <td className="px-4 py-3">
                          {lead.phone ? (
                            <a
                              href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-400 hover:underline"
                            >
                              {lead.phone}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {lead.website ? (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-green-800 bg-green-900/40 px-2.5 py-0.5 text-xs font-medium text-green-400 hover:bg-green-900/60"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                              YES
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-800 bg-red-900/40 px-2.5 py-0.5 text-xs font-medium text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              NO
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {lead.rating > 0 ? (
                            <span className="text-sm text-amber-400">★ {lead.rating.toFixed(1)}</span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>

                        <td className="max-w-[180px] truncate px-4 py-3 text-xs text-gray-400">
                          {lead.address}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <select
                            value={status}
                            onChange={e => setStatus(lead.id, e.target.value as LeadStatus)}
                            className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium outline-none transition-colors bg-transparent ${STATUS_COLORS[status]}`}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s} className="bg-[#1E293B] text-white">
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleCreateDemo(lead)}
                            className="whitespace-nowrap rounded-lg border border-indigo-700 bg-indigo-600/20 px-2.5 py-1 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-600/40"
                          >
                            Create Demo
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages} · Showing {paginatedResults.length} of {displayResults.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-[#374151] bg-[#1E293B] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-[#263349] disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        p === page
                          ? 'bg-indigo-600 text-white'
                          : 'border border-[#374151] bg-[#1E293B] text-gray-300 hover:bg-[#263349]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-[#374151] bg-[#1E293B] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-[#263349] disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in rounded-xl border border-[#374151] bg-[#1E293B] px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
