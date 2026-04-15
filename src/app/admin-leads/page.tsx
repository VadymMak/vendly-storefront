'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  businessType: string;
  services: string;
  contact: string;
  language: string;
  demoUrl: string | null;
  status: string;
  notes: string | null;
  siteName: string | null;
  siteUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

type EditFields = { notes: string; siteUrl: string; siteName: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_PASSWORD  = 'vendshop2026';
const STORAGE_KEY     = 'vendshop-admin';
const STATUS_CYCLE    = ['new', 'in_progress', 'site_ready', 'paid', 'active'] as const;

const STATUS_META: Record<string, { label: string; classes: string }> = {
  new:         { label: 'Новый',      classes: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'В работе',   classes: 'bg-blue-100 text-blue-800' },
  site_ready:  { label: 'Сайт готов', classes: 'bg-purple-100 text-purple-800' },
  paid:        { label: 'Оплачен',    classes: 'bg-green-100 text-green-800' },
  active:      { label: 'Активный',   classes: 'bg-green-500 text-white' },
};

// ─── Password Gate ─────────────────────────────────────────────────────────────

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [value, setValue]   = useState('');
  const [error, setError]   = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      onAuth();
    } else {
      setError(true);
      setValue('');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" fill="white" />
              <polyline points="9 22 9 12 15 12 15 22" stroke="white" strokeWidth="1.5" />
            </svg>
          </div>
          <span className="text-lg font-bold text-secondary">VendShop Admin</span>
        </div>
        <h1 className="mb-1 text-xl font-bold text-secondary">Панель лидов</h1>
        <p className="mb-6 text-sm text-gray-500">Введи пароль для доступа</p>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            placeholder="Пароль"
            autoFocus
            className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:border-primary ${
              error ? 'border-red-400 bg-red-50' : 'border-gray-200'
            }`}
          />
          {error && (
            <p className="text-xs text-red-500">Неверный пароль</p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

function LeadsPanel({ onLogout }: { onLogout: () => void }) {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, EditFields>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/leads');
      const data = await res.json() as Lead[];
      setLeads(data);
      setEditState((prev) => {
        const next = { ...prev };
        data.forEach((lead) => {
          if (!next[lead.id]) {
            next[lead.id] = {
              notes:    lead.notes    ?? '',
              siteUrl:  lead.siteUrl  ?? '',
              siteName: lead.siteName ?? '',
            };
          }
        });
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLeads(); }, [loadLeads]);

  async function cycleStatus(lead: Lead) {
    const idx        = STATUS_CYCLE.indexOf(lead.status as typeof STATUS_CYCLE[number]);
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: nextStatus } : l));
    await fetch('/api/admin/leads', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, status: nextStatus }),
    });
  }

  async function saveLead(id: string) {
    setSaving(id);
    const fields = editState[id];
    await fetch('/api/admin/leads', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
    setLeads((prev) => prev.map((l) =>
      l.id === id ? { ...l, notes: fields.notes, siteUrl: fields.siteUrl, siteName: fields.siteName } : l,
    ));
    setSaving(null);
    setSaved(id);
    setTimeout(() => setSaved(null), 2000);
  }

  function updateField(id: string, key: keyof EditFields, value: string) {
    setEditState((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    onLogout();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-red-200 bg-red-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" fill="white" />
                <polyline points="9 22 9 12 15 12 15 22" stroke="white" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="font-bold text-secondary">VendShop</span>
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/admin" className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-white/60 transition-colors">
              Full Admin →
            </a>
            <button
              onClick={logout}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Top row */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Лиды из чат-бота</h1>
            <p className="mt-1 text-sm text-gray-500">
              {loading ? 'Загрузка…' : `${leads.length} лидов`}
            </p>
          </div>
          <button
            onClick={() => void loadLeads()}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            ↻ Обновить
          </button>
        </div>

        {/* Status legend */}
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(STATUS_META).map(([key, { label, classes }]) => (
            <span key={key} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
              {label}
            </span>
          ))}
          <span className="self-center ml-1 text-xs text-gray-400">← кликни на статус для смены</span>
        </div>

        {/* Leads list */}
        {loading ? (
          <div className="py-16 text-center text-gray-400">Загрузка…</div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-gray-400">Лидов пока нет.</div>
        ) : (
          <div className="space-y-2">
            {leads.map((lead) => {
              const meta       = STATUS_META[lead.status] ?? STATUS_META.new;
              const isExpanded = expanded === lead.id;
              const edit       = editState[lead.id] ?? { notes: '', siteUrl: '', siteName: '' };

              return (
                <div key={lead.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  {/* Summary row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-secondary">{lead.contact}</span>
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {lead.businessType}
                        </span>
                        <span className="text-xs text-gray-400">{lead.language.toUpperCase()}</span>
                        {lead.siteName && (
                          <span className="text-xs font-medium text-primary">{lead.siteName}</span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{lead.services}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden text-xs text-gray-400 sm:block">
                        {new Date(lead.createdAt).toLocaleDateString('sk')}
                      </span>
                      <button
                        onClick={() => void cycleStatus(lead)}
                        title="Кликни для смены статуса"
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${meta.classes}`}
                      >
                        {meta.label}
                      </button>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : lead.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
                        aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">ID</p>
                          <p className="font-mono text-xs text-gray-600">{lead.id}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Создан</p>
                          <p className="text-xs text-gray-600">{new Date(lead.createdAt).toLocaleString('sk')}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Услуги</p>
                          <p className="text-sm text-gray-700">{lead.services}</p>
                        </div>
                        {lead.demoUrl && (
                          <div className="sm:col-span-2">
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Показан демо</p>
                            <a href={lead.demoUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline">
                              {lead.demoUrl}
                            </a>
                          </div>
                        )}
                        <div>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
                            Название сайта
                          </label>
                          <input
                            type="text"
                            value={edit.siteName}
                            onChange={(e) => updateField(lead.id, 'siteName', e.target.value)}
                            placeholder="Название проекта"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
                            URL готового сайта
                          </label>
                          <input
                            type="url"
                            value={edit.siteUrl}
                            onChange={(e) => updateField(lead.id, 'siteUrl', e.target.value)}
                            placeholder="https://..."
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
                            Заметки
                          </label>
                          <textarea
                            value={edit.notes}
                            onChange={(e) => updateField(lead.id, 'notes', e.target.value)}
                            rows={3}
                            placeholder="Заметки о лиде, переговорах, статусе..."
                            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-3">
                        {saved === lead.id && (
                          <span className="text-xs font-medium text-green-600">✓ Сохранено</span>
                        )}
                        <button
                          onClick={() => void saveLead(lead.id)}
                          disabled={saving === lead.id}
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                        >
                          {saving === lead.id ? 'Сохранение…' : 'Сохранить'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function AdminLeadsPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  // Not yet checked sessionStorage (SSR guard)
  if (authed === null) return null;

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return <LeadsPanel onLogout={() => setAuthed(false)} />;
}
