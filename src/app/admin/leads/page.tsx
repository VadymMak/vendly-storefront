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

const STATUS_CYCLE = ['new', 'in_progress', 'site_ready', 'paid', 'active'] as const;

const STATUS_META: Record<string, { label: string; classes: string }> = {
  new:         { label: 'Новый',      classes: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'В работе',   classes: 'bg-blue-100 text-blue-800' },
  site_ready:  { label: 'Сайт готов', classes: 'bg-purple-100 text-purple-800' },
  paid:        { label: 'Оплачен',    classes: 'bg-green-100 text-green-800' },
  active:      { label: 'Активный',   classes: 'bg-green-500 text-white' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, EditFields>>({});
  const [saving, setSaving]   = useState<string | null>(null);
  const [saved, setSaved]     = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/leads');
      const data = await res.json() as Lead[];
      setLeads(data);
      // Seed edit state for each lead (only for leads not already in editState)
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

  // Cycle status on click
  async function cycleStatus(lead: Lead) {
    const idx        = STATUS_CYCLE.indexOf(lead.status as typeof STATUS_CYCLE[number]);
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    // Optimistic update
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: nextStatus } : l));
    await fetch('/api/admin/leads', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, status: nextStatus }),
    });
  }

  // Save notes / siteUrl / siteName
  async function saveLead(id: string) {
    setSaving(id);
    const fields = editState[id];
    await fetch('/api/admin/leads', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
    // Reflect saved values back into leads list
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Лиды из чат-бота</h1>
          <p className="mt-1 text-sm text-neutral">
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
        <span className="text-xs text-neutral self-center ml-1">← кликни на статус для смены</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-neutral">Загрузка…</div>
      ) : leads.length === 0 ? (
        <div className="py-16 text-center text-neutral">Лидов пока нет. Заполни чат на главной!</div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => {
            const meta = STATUS_META[lead.status] ?? STATUS_META.new;
            const isExpanded = expanded === lead.id;
            const edit = editState[lead.id] ?? { notes: '', siteUrl: '', siteName: '' };

            return (
              <div
                key={lead.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* ── Summary row ── */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Left: contact + type */}
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
                    <p className="mt-0.5 truncate text-xs text-neutral">{lead.services}</p>
                  </div>

                  {/* Right: date + status badge + expand */}
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

                {/* ── Expanded details ── */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">

                      {/* ID */}
                      <div>
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">ID</p>
                        <p className="font-mono text-xs text-gray-600">{lead.id}</p>
                      </div>

                      {/* Created */}
                      <div>
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Создан</p>
                        <p className="text-xs text-gray-600">
                          {new Date(lead.createdAt).toLocaleString('sk')}
                        </p>
                      </div>

                      {/* Services (full) */}
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Услуги</p>
                        <p className="text-sm text-gray-700">{lead.services}</p>
                      </div>

                      {/* Demo URL */}
                      {lead.demoUrl && (
                        <div className="sm:col-span-2">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Показан демо</p>
                          <a
                            href={lead.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            {lead.demoUrl}
                          </a>
                        </div>
                      )}

                      {/* Site name */}
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

                      {/* Site URL */}
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

                      {/* Notes */}
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

                    {/* Save button */}
                    <div className="mt-3 flex items-center justify-end gap-3">
                      {saved === lead.id && (
                        <span className="text-xs font-medium text-green-600">✓ Сохранено</span>
                      )}
                      <button
                        onClick={() => void saveLead(lead.id)}
                        disabled={saving === lead.id}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
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
    </div>
  );
}
