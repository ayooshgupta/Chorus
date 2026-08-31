export type Freq = 'daily' | 'weekly' | 'monthly';
export type MonthlyPattern = 'day_of_month' | 'nth_weekday';
export type Assignment = 'dedicated' | 'alternating' | 'adhoc';

export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];
export const WEEKDAY_NAME = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export const EFFORTS = [
  { label: 'Quick', weight: 1 },
  { label: 'Normal', weight: 2 },
  { label: 'Effort', weight: 3 },
  { label: 'Big job', weight: 5 }
];

import { HOUSEHOLD_TZ } from './config';

export type Recurrence = {
  freq: Freq;
  interval: number;
  byweekday: number[];
  monthlyPattern: MonthlyPattern | null;
  anchor: string;
};

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toIso(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function addDays(date: Date, n: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}

export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HOUSEHOLD_TZ }).format(new Date());
}

export function shortDate(iso: string): string {
  const d = parseDate(iso);
  return `${WEEKDAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export function nthOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

export function nthLabel(n: number): string {
  return ['first', 'second', 'third', 'fourth', 'last'][Math.min(n, 5) - 1] ?? 'first';
}

export function describe(r: Recurrence): string {
  const anchor = parseDate(r.anchor);

  if (r.freq === 'daily') {
    return r.interval === 1 ? 'Every day' : `Every ${r.interval} days`;
  }

  if (r.freq === 'weekly') {
    const days = [...r.byweekday]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_NAME[d])
      .filter(Boolean);
    const list =
      days.length <= 1
        ? days[0] ?? ''
        : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
    return r.interval === 1 ? `Every ${list}` : `Every ${r.interval} weeks on ${list}`;
  }

  const every = r.interval === 1 ? 'Every month' : `Every ${r.interval} months`;
  if (r.monthlyPattern === 'nth_weekday') {
    return `${every} on the ${nthLabel(nthOfMonth(anchor))} ${WEEKDAY_NAME[anchor.getDay()]}`;
  }
  return `${every} on the ${ordinal(anchor.getDate())}`;
}

export function perWeek(r: Recurrence): number {
  if (r.freq === 'daily') return 7 / r.interval;
  if (r.freq === 'weekly') return Math.max(r.byweekday.length, 1) / r.interval;
  return 12 / (52.1786 * r.interval);
}

export function formatLoad(n: number): string {
  return n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function matches(r: Recurrence, date: Date): boolean {
  const anchor = parseDate(r.anchor);
  if (date < anchor) return false;

  if (r.freq === 'daily') {
    return daysBetween(anchor, date) % r.interval === 0;
  }

  if (r.freq === 'weekly') {
    if (!r.byweekday.includes(date.getDay())) return false;
    const weeks = Math.round(daysBetween(startOfWeek(anchor), startOfWeek(date)) / 7);
    return weeks % r.interval === 0;
  }

  const months = monthsBetween(anchor, date);
  if (months < 0 || months % r.interval !== 0) return false;

  if (r.monthlyPattern === 'nth_weekday') {
    if (date.getDay() !== anchor.getDay()) return false;

    if (nthOfMonth(anchor) >= 5) {
      return addDays(date, 7).getMonth() !== date.getMonth();
    }
    return nthOfMonth(date) === nthOfMonth(anchor);
  }

  const target = Math.min(anchor.getDate(), daysInMonth(date));
  return date.getDate() === target;
}

export function nextDate(r: Recurrence, afterIso: string | null): string | null {
  const anchor = parseDate(r.anchor);
  let cursor = afterIso ? addDays(parseDate(afterIso), 1) : anchor;
  if (cursor < anchor) cursor = anchor;

  for (let i = 0; i < 800; i += 1) {
    if (matches(r, cursor)) return toIso(cursor);
    cursor = addDays(cursor, 1);
  }
  return null;
}

export type Bucket = 'overdue' | 'today' | 'week' | 'weekend';

export function bucketFor(dueIso: string, todayIsoValue: string): Bucket | null {
  const due = parseDate(dueIso);
  const today = parseDate(todayIsoValue);

  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';

  const endOfWeek = addDays(startOfWeek(today), 7);
  if (due > endOfWeek) return null;

  const day = due.getDay();
  if (day === 0 || day === 6) return 'weekend';
  return 'week';
}

export function friendlyDate(iso: string, todayIsoValue: string): string {
  const due = parseDate(iso);
  const today = parseDate(todayIsoValue);
  const diff = daysBetween(today, due);

  if (diff === 0) return 'Today';
  if (diff < 0) {
    const n = Math.abs(diff);
    return `${n} ${n === 1 ? 'day' : 'days'} late · ${shortDate(iso)}`;
  }
  return shortDate(iso);
}

export function nextWeekendIso(todayIsoValue: string): string {
  let cursor = addDays(parseDate(todayIsoValue), 1);
  for (let i = 0; i < 8; i += 1) {
    if (cursor.getDay() === 6) return toIso(cursor);
    cursor = addDays(cursor, 1);
  }
  return toIso(cursor);
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    timeZone: HOUSEHOLD_TZ
  }).format(new Date(iso));
}
