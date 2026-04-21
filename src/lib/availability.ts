import { getAppointmentsForDoctorOnDate, getAppointmentsForDoctorInRange } from '@/db/queries/availability';
import { getClinicSettings } from '@/db/queries/clinics';
import { db } from '@/db';
import { appointments } from '@/db/schema';
import { and, eq, lt, gt, ne, notInArray } from 'drizzle-orm';

export interface TimeSlot {
  start: string; // HH:MM
  end: string;   // HH:MM
  date: string;  // YYYY-MM-DD
}

export async function getAvailableSlots(
  clinicId: string,
  doctorId: string,
  date: string,
  durationMin: number = 30,
): Promise<TimeSlot[]> {
  const settings = await getClinicSettings(clinicId);
  const { start: workStart, end: workEnd } = settings.workHours;

  const existing = await getAppointmentsForDoctorOnDate(clinicId, doctorId, date);

  // Build busy intervals in minutes from midnight
  const busy = existing.map(a => {
    const s = new Date(a.startsAt);
    const e = new Date(a.endsAt);
    return {
      start: s.getHours() * 60 + s.getMinutes(),
      end: e.getHours() * 60 + e.getMinutes(),
    };
  }).sort((a, b) => a.start - b.start);

  const slots: TimeSlot[] = [];
  let cursor = workStart * 60;
  const endMin = workEnd * 60;

  for (const b of busy) {
    while (cursor + durationMin <= b.start) {
      slots.push({
        start: pad(cursor),
        end: pad(cursor + durationMin),
        date,
      });
      cursor += durationMin;
    }
    cursor = Math.max(cursor, b.end);
  }

  while (cursor + durationMin <= endMin) {
    slots.push({
      start: pad(cursor),
      end: pad(cursor + durationMin),
      date,
    });
    cursor += durationMin;
  }

  return slots;
}

export async function getNextAvailableSlots(
  clinicId: string,
  doctorId: string,
  fromDate: string,
  durationMin: number = 30,
  count: number = 5,
): Promise<TimeSlot[]> {
  const results: TimeSlot[] = [];
  const start = new Date(fromDate);

  for (let i = 0; i < 14 && results.length < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const day = d.getDay();
    if (day === 0 || day === 6) continue; // skip weekends

    const dateStr = d.toISOString().slice(0, 10);
    const daySlots = await getAvailableSlots(clinicId, doctorId, dateStr, durationMin);
    for (const s of daySlots) {
      if (results.length >= count) break;
      results.push(s);
    }
  }

  return results;
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
  return {
    hasOverlap: true,
    conflictStart: new Date(conflict.startsAt).toTimeString().slice(0, 5),
    conflictEnd: new Date(conflict.endsAt).toTimeString().slice(0, 5),
  };
}
function pad(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
