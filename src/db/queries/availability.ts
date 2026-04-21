import { db } from '..';
import { appointments } from '../schema';
import { eq, and, gte, lte, ne } from 'drizzle-orm';

export async function getAppointmentsForDoctorOnDate(
  clinicId: string,
  doctorId: string,
  date: string,
): Promise<{ startsAt: string; endsAt: string }[]> {
  const dayStart = date + 'T00:00:00';
  const dayEnd = date + 'T23:59:59';

  const rows = await db
    .select({
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        ne(appointments.status, 'cancelled'),
        gte(appointments.startsAt, new Date(dayStart)),
        lte(appointments.startsAt, new Date(dayEnd)),
      ),
    )
    .orderBy(appointments.startsAt);

  return rows.map(r => ({
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
  }));
}

export async function getAppointmentsForDoctorInRange(
  clinicId: string,
  doctorId: string,
  startDate: string,
  endDate: string,
): Promise<{ startsAt: string; endsAt: string }[]> {
  const rows = await db
    .select({
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        ne(appointments.status, 'cancelled'),
        gte(appointments.startsAt, new Date(startDate + 'T00:00:00')),
        lte(appointments.startsAt, new Date(endDate + 'T23:59:59')),
      ),
    )
    .orderBy(appointments.startsAt);

  return rows.map(r => ({
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
  }));
}
