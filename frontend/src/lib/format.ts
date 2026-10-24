/**
 * Display formatting. Instants arrive from the API in UTC and are always shown in UK time,
 * whatever the viewer's own timezone. Calendar dates (YYYY-MM-DD) are never shifted.
 */

export const UK_TZ = 'Europe/London';
const MINUS = '−';
const DASH = '—';

export type Instant = string | number | Date;

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const dayMonthFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  day: 'numeric',
  month: 'short',
});
const calendarLong = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const calendarShort = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** "07:30", UK time. */
export function ukTime(instant: Instant): string {
  return clockFormat.format(new Date(instant));
}

/** "15 Jan", UK date of an instant. */
export function ukDayMonth(instant: Instant): string {
  return dayMonthFormat.format(new Date(instant));
}

/** "15 Jan 07:30", UK time. */
export function ukDateTime(instant: Instant): string {
  return `${ukDayMonth(instant)} ${ukTime(instant)}`;
}

/** Minutes since midnight in UK time. */
export function ukMinutesOfDay(instant: Instant): number {
  const [hours = '0', minutes = '0'] = ukTime(instant).split(':');
  return Number(hours) * 60 + Number(minutes);
}

/** "Wed 14 Jan 2026" for a calendar date string, identical in every browser. */
export function calendarDate(date: string, withYear = true): string {
  const parts = (withYear ? calendarLong : calendarShort).formatToParts(
    new Date(`${date}T12:00:00Z`),
  );
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return [part('weekday'), part('day'), part('month'), withYear ? part('year') : '']
    .filter(Boolean)
    .join(' ');
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Signed number with a true minus sign; zero carries no sign. */
export function signed(value: number, digits: number): string {
  const magnitude = Math.abs(value).toFixed(digits);
  if (Number(magnitude) === 0) return magnitude;
  return `${value < 0 ? MINUS : '+'}${magnitude}`;
}

const missing = (value: number | null | undefined): value is null | undefined =>
  value === null || value === undefined || Number.isNaN(value);

export function gw(megawatts: number | null | undefined, digits = 1): string {
  return missing(megawatts) ? DASH : `${(megawatts / 1000).toFixed(digits)} GW`;
}

export function signedGw(megawatts: number | null | undefined, digits = 1): string {
  return missing(megawatts) ? DASH : `${signed(megawatts / 1000, digits)} GW`;
}

/** Plain MW figure for tables (the unit lives in the column header). */
export function mw(megawatts: number | null | undefined): string {
  return missing(megawatts) ? DASH : Math.round(megawatts).toLocaleString('en-GB');
}

export function signedMw(megawatts: number | null | undefined): string {
  if (missing(megawatts)) return DASH;
  const rounded = Math.round(megawatts);
  if (rounded === 0) return '0';
  return `${rounded < 0 ? MINUS : '+'}${Math.abs(rounded).toLocaleString('en-GB')}`;
}

export function gwh(value: number | null | undefined, digits = 0): string {
  if (missing(value)) return DASH;
  const text = value.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${text} GWh`;
}

export function signedGwh(value: number | null | undefined, digits = 0): string {
  return missing(value) ? DASH : `${signed(value, digits)} GWh`;
}

export function pct(fraction: number | null | undefined, digits = 0): string {
  return missing(fraction) ? DASH : `${(fraction * 100).toFixed(digits)}%`;
}

export function hoursLabel(value: number | null | undefined, digits = 1): string {
  if (missing(value)) return DASH;
  return `${Number(value.toFixed(digits)).toString()} h`;
}

/** "1 h 50 min". */
export function duration(minutes: number): string {
  const total = Math.round(Math.abs(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Axis tick in GW without trailing zeros: 2000 → "2 GW", 2500 → "2.5 GW". */
export function axisGw(megawatts: number): string {
  return `${Number((megawatts / 1000).toFixed(1)).toString()} GW`;
}
