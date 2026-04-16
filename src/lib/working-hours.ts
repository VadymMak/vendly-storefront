import type { WeekSchedule } from './types';

export const LOCALIZED_DAYS: Record<string, string[]> = {
  sk: ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'],
  cs: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
  uk: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
};

export const LOCALIZED_CLOSED: Record<string, string> = {
  sk: 'Zatvorené',
  cs: 'Zavřeno',
  uk: 'Зачинено',
  de: 'Geschlossen',
  en: 'Closed',
  ru: 'Закрыто',
};

/** Generate a compact opening hours string from structured schedule in shop language */
export function formatStructuredHours(hours: WeekSchedule, lang: string): string {
  const days = LOCALIZED_DAYS[lang] || LOCALIZED_DAYS.en;
  const closed = LOCALIZED_CLOSED[lang] || LOCALIZED_CLOSED.en;

  const groups: { start: number; end: number; open: boolean; from: string; to: string }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = hours[i];
    const key = d.open ? `${d.from}-${d.to}` : 'closed';
    const last = groups[groups.length - 1];
    const lastKey = last ? (last.open ? `${last.from}-${last.to}` : 'closed') : '';

    if (last && lastKey === key && last.end === i - 1) {
      last.end = i;
    } else {
      groups.push({ start: i, end: i, open: d.open, from: d.from, to: d.to });
    }
  }

  return groups
    .map((g) => {
      const range = g.start === g.end
        ? days[g.start]
        : `${days[g.start]}–${days[g.end]}`;
      return g.open ? `${range} ${g.from}–${g.to}` : `${range} ${closed}`;
    })
    .join(', ');
}
