import { getBusyIntervals } from '@/db/queries/availability';
import { getClinicSettings } from '@/db/queries/clinics';
import { db } from '@/db';
import { appointments } from '@/db/schema';
import { and, eq, gt, lt, ne, notInArray } from 'drizzle-orm';
import { addDays, toZonedParts, weekdayOf, zonedDayRange } from '@/lib/timezone';
import type { DayHours, WeekHours } from '@/lib/work-week';

export interface TimeSlot {
  start: string; // HH:MM, clinic-local
  end: string;   // HH:MM, clinic-local
  date: string;  // YYYY-MM-DD, clinic-local
}

export interface Interval {
  start: number; // minutes since clinic-local midnight
  end: number;
}

const SEARCH_DAYS = 14;

/** Free slots of one working day, stepping by the appointment duration. */
export function computeFreeSlots(params: {
  date: string;
  workHours: DayHours;
  durationMin: number;
  busy: Interval[];
  /** Slots starting at or before this minute are dropped (used for today). */
  notBefore?: number;
}): TimeSlot[] {
  const { date, workHours, durationMin, notBefore } = params;
  const slots: TimeSlot[] = [];
  const busy = [...params.busy].sort((a, b) => a.start - b.start);
  const endMin = workHours.end * 60;
  let cursor = workHours.start * 60;

  const fillUntil = (limit: number) => {
    while (cursor + durationMin <= limit) {
      if (notBefore === undefined || cursor > notBefore) {
        slots.push({ date, start: pad(cursor), end: pad(cursor + durationMin) });
      }
      cursor += durationMin;
    }
  };

  for (const interval of busy) {
    fillUntil(Math.min(interval.start, endMin));
    cursor = Math.max(cursor, interval.end);
  }
  fillUntil(endMin);
  return slots;
}

export type SlotProblem = 'in_past' | 'closed_day' | 'outside_hours';

/** Business rules for AI bookings. Overlap is checked separately. */
export function findSlotProblem(params: {
  startsAt: Date;
  endsAt: Date;
  weekHours: WeekHours;
  timeZone: string;
  now?: Date;
}): SlotProblem | null {
  const { startsAt, endsAt, weekHours, timeZone, now = new Date() } = params;
  if (startsAt.getTime() <= now.getTime()) return 'in_past';
  const start = toZonedParts(startsAt, timeZone);
  const end = toZonedParts(endsAt, timeZone);
  const workHours = weekHours[weekdayOf(start.date)];
  if (!workHours) return 'closed_day';
  if (end.date !== start.date || start.minutes < workHours.start * 60 || end.minutes > workHours.end * 60) {
    return 'outside_hours';
  }
  return null;
}

async function loadSlots(
  clinicId: string,
  doctorId: string,
  dates: string[],
  durationMin: number,
): Promise<TimeSlot[]> {
  const { weekHours, timezone } = await getClinicSettings(clinicId);
  const today = toZonedParts(new Date(), timezone);
  const openDates = dates.filter((date) => weekHours[weekdayOf(date)] && date >= today.date);
  if (openDates.length === 0) return [];

  const from = zonedDayRange(openDates[0], timezone).start;
  const to = zonedDayRange(openDates[openDates.length - 1], timezone).end;
  const rows = await getBusyIntervals(clinicId, doctorId, from, to);
  const intervals = rows.map((row) => ({
    start: toZonedParts(row.startsAt, timezone),
    end: toZonedParts(row.endsAt, timezone),
  }));

  return openDates.flatMap((date) => {
    const workHours = weekHours[weekdayOf(date)];
    if (!workHours) return [];
    return computeFreeSlots({
      date,
      workHours,
      durationMin,
      busy: intervals
        .filter(({ start, end }) => start.date <= date && end.date >= date)
        .map(({ start, end }) => ({
          start: start.date < date ? 0 : start.minutes,
          end: end.date > date ? 24 * 60 : end.minutes,
        })),
      notBefore: date === today.date ? today.minutes : undefined,
    });
  });
}

export async function getAvailableSlots(
  clinicId: string,
  doctorId: string,
  date: string,
  durationMin: number = 30,
): Promise<TimeSlot[]> {
  return loadSlots(clinicId, doctorId, [date], durationMin);
}

export async function getNextAvailableSlots(
  clinicId: string,
  doctorId: string,
  fromDate: string,
  durationMin: number = 30,
  count: number = 5,
): Promise<TimeSlot[]> {
  const dates = Array.from({ length: SEARCH_DAYS }, (_, i) => addDays(fromDate, i));
  return (await loadSlots(clinicId, doctorId, dates, durationMin)).slice(0, count);
}

export interface OverlapResult {
  hasOverlap: boolean;
  conflictStart?: string;
  conflictEnd?: string;
}

/**
 * Check whether a proposed appointment time conflicts with any existing active
 * appointment for the same doctor. Uses a closed-open interval [startsAt, endsAt)
 * so back-to-back appointments are allowed.
 *
 * @param excludeId - optional appointment ID to ignore (for rescheduling)
 */
export async function checkNoOverlap(
  clinicId: string,
  doctorId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
): Promise<OverlapResult> {
  const conditions = [
    eq(appointments.clinicId, clinicId),
    eq(appointments.doctorId, doctorId),
    notInArray(appointments.status, ['cancelled', 'no_show']),
    lt(appointments.startsAt, endsAt),   // existing starts before new ends
    gt(appointments.endsAt, startsAt),   // existing ends after new starts
  ];
  if (excludeId) conditions.push(ne(appointments.id, excludeId));

  const [conflict] = await db
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
    .from(appointments)
    .where(and(...conditions))
    .limit(1);

  if (!conflict) return { hasOverlap: false };
  const { timezone } = await getClinicSettings(clinicId);
  return {
    hasOverlap: true,
    conflictStart: toZonedParts(conflict.startsAt, timezone).time,
    conflictEnd: toZonedParts(conflict.endsAt, timezone).time,
  };
}

function pad(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
