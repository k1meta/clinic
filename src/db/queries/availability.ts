import { db } from '..';
import { appointments } from '../schema';
import { and, eq, gt, lt, notInArray } from 'drizzle-orm';

/** Active appointments of one doctor that overlap [from, to). */
export async function getBusyIntervals(
  clinicId: string,
  doctorId: string,
  from: Date,
  to: Date,
): Promise<{ startsAt: Date; endsAt: Date }[]> {
  return db
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        notInArray(appointments.status, ['cancelled', 'no_show']),
        lt(appointments.startsAt, to),
        gt(appointments.endsAt, from),
      ),
    )
    .orderBy(appointments.startsAt);
}
