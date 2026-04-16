'use client';

import type { DaySchedule, WeekSchedule } from '@/lib/types';
import { DAY_KEYS } from '@/lib/constants';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface WeekScheduleEditorLabels {
  days: Record<DayKey, string>;
  closed: string;
  break: string;
}

interface Props {
  value: WeekSchedule;
  onChange: (next: WeekSchedule) => void;
  labels: WeekScheduleEditorLabels;
  /** 'light' for dashboard (default), 'dark' for brief form */
  variant?: 'light' | 'dark';
}

export default function WeekScheduleEditor({ value, onChange, labels, variant = 'light' }: Props) {
  const isDark = variant === 'dark';

  const dayLabelCls = isDark
    ? 'w-10 shrink-0 text-xs font-medium text-gray-400 uppercase'
    : 'w-10 shrink-0 text-xs font-medium text-gray-600 uppercase';

  const timeInputCls = isDark
    ? 'rounded border border-[#374151] bg-[#0F172A] px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-green-500'
    : 'rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary';

  const breakTimeCls = isDark
    ? 'rounded border border-amber-700 bg-amber-900/30 px-2 py-1 text-xs text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500'
    : 'rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400';

  const closedTextCls = isDark ? 'text-xs text-gray-500' : 'text-xs text-gray-400';

  const separatorCls = 'text-gray-400';

  return (
    <div className="space-y-2">
      {value.map((day, i) => {
        const dayKey = DAY_KEYS[i];
        const updateDay = (patch: Partial<DaySchedule>) => {
          const next = [...value] as WeekSchedule;
          next[i] = { ...next[i], ...patch };
          onChange(next);
        };

        return (
          <div key={dayKey} className="flex flex-wrap items-center gap-3">
            <span className={dayLabelCls}>{labels.days[dayKey]}</span>

            {/* Open/closed toggle */}
            <button
              type="button"
              onClick={() => updateDay({ open: !day.open })}
              className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${
                day.open ? 'bg-green-600' : isDark ? 'bg-gray-600' : 'bg-gray-300'
              }`}
              aria-label={day.open ? labels.closed : labels.days[dayKey]}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  day.open ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>

            {day.open ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="time"
                  value={day.from}
                  onChange={(e) => updateDay({ from: e.target.value })}
                  className={timeInputCls}
                />
                <span className={separatorCls}>—</span>
                <input
                  type="time"
                  value={day.to}
                  onChange={(e) => updateDay({ to: e.target.value })}
                  className={timeInputCls}
                />

                {/* Break toggle */}
                <button
                  type="button"
                  onClick={() =>
                    updateDay(
                      day.breakFrom
                        ? { breakFrom: undefined, breakTo: undefined }
                        : { breakFrom: '12:00', breakTo: '13:00' },
                    )
                  }
                  className={`ml-2 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    day.breakFrom
                      ? 'bg-amber-100 text-amber-700'
                      : isDark
                        ? 'bg-[#0F172A] text-gray-500 hover:text-gray-300'
                        : 'bg-gray-100 text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {labels.break}
                </button>

                {day.breakFrom && (
                  <div className="flex items-center gap-1">
                    <input
                      type="time"
                      value={day.breakFrom}
                      onChange={(e) => updateDay({ breakFrom: e.target.value })}
                      className={breakTimeCls}
                    />
                    <span className={separatorCls}>—</span>
                    <input
                      type="time"
                      value={day.breakTo || '13:00'}
                      onChange={(e) => updateDay({ breakTo: e.target.value })}
                      className={breakTimeCls}
                    />
                  </div>
                )}
              </div>
            ) : (
              <span className={closedTextCls}>{labels.closed}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
