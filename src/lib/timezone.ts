/**
 * Clinic-local time helpers.
 *
 * Appointments are stored as UTC instants, but people say "sutra u deset" in the
 * clinic's timezone. Never use Date#getHours / new Date('YYYY-MM-DDTHH:MM') for
 * clinic times: those use the server's timezone.
 */

export const DEFAULT_TIMEZONE = 'Europe/Sarajevo';

export interface ZonedParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  hour: number;
  minute: number;
  minutes: number; // minutes since local midnight
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Returns the timezone if valid, otherwise the default. */
export function safeTimezone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIMEZONE;
  try {
    formatterFor(timeZone);
    return timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function isValidDate(date: string): boolean {
  const match = DATE_RE.exec(date);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

export function toZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) parts[part.type] = part.value;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
}

function offsetMs(instantMs: number, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Clinic-local wall time → UTC instant. Returns null for malformed input and for
 * times skipped by the spring DST change. A repeated autumn time resolves to the
 * first occurrence.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): Date | null {
  if (!isValidDate(date) || !isValidTime(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);

  const dayMs = 24 * 60 * 60 * 1000;
  const candidates = [offsetMs(wall - dayMs, timeZone), offsetMs(wall + dayMs, timeZone)]
    .map((offset) => wall - offset)
    .sort((a, b) => a - b);

  for (const candidate of candidates) {
    const parts = toZonedParts(new Date(candidate), timeZone);
    if (parts.date === date && parts.time === time) return new Date(candidate);
  }
  return null;
}

/** Calendar arithmetic on a YYYY-MM-DD string. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return toZonedParts(now, timeZone).date;
}

/** UTC bounds [start, end) of one clinic-local day. */
export function zonedDayRange(date: string, timeZone: string): { start: Date; end: Date } {
  const start = zonedToUtc(date, '00:00', timeZone);
  const end = zonedToUtc(addDays(date, 1), '00:00', timeZone);
  if (!start || !end) throw new Error(`Cannot resolve day range for ${date} in ${timeZone}`);
  return { start, end };
}

const WEEKDAYS_BS = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];
const MONTHS_BS_GENITIVE = [
  'januara', 'februara', 'marta', 'aprila', 'maja', 'juna',
  'jula', 'augusta', 'septembra', 'oktobra', 'novembra', 'decembra',
];

/** "utorak, 24. novembra" — phrased for text-to-speech. */
export function speakDateBs(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${WEEKDAYS_BS[weekdayOf(date)]}, ${day}. ${MONTHS_BS_GENITIVE[month - 1]}`;
}
