import { eq, and, gte, lt, lte, ne, count, sql, sum } from 'drizzle-orm';
import { db } from '..';
import { appointments, patients, doctors, treatmentTypes } from '../schema';
import { todayInZone, zonedDayRange } from '@/lib/timezone';

/** `date` is a clinic-local YYYY-MM-DD. */
export async function getAppointmentsByDate(clinicId: string, date: string, timeZone: string) {
  const { start, end } = zonedDayRange(date, timeZone);

  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      source: appointments.source,
      notes: appointments.notes,
      amountCharged: appointments.amountCharged,
      amountPaid: appointments.amountPaid,
      paymentStatus: appointments.paymentStatus,
      patient: {
        id: patients.id,
        fullName: patients.fullName,
        phone: patients.phone,
      },
      doctor: {
        id: doctors.id,
        fullName: doctors.fullName,
        specialty: doctors.specialty,
      },
      treatmentType: {
        id: treatmentTypes.id,
        name: treatmentTypes.name,
        defaultDurationMin: treatmentTypes.defaultDurationMin,
      },
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
        ne(appointments.status, 'cancelled'),
      )
    )
    .orderBy(appointments.startsAt);
}

export async function getTodayAppointmentCount(clinicId: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [{ total }] = await db
    .select({ total: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        gte(appointments.startsAt, startOfDay),
        lte(appointments.startsAt, endOfDay)
      )
    );
  return total;
}

export async function getUpcomingAppointments(clinicId: string, timeZone: string, limit = 5) {
  const now = new Date();
  // Only show today's remaining appointments on the overview page; tomorrow's
  // and beyond live in /calendar. Also drop cancelled rows.
  const endOfDay = zonedDayRange(todayInZone(timeZone, now), timeZone).end;

  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      amountCharged: appointments.amountCharged,
      amountPaid: appointments.amountPaid,
      paymentStatus: appointments.paymentStatus,
      patient: {
        id: patients.id,
        fullName: patients.fullName,
      },
      treatmentType: {
        name: treatmentTypes.name,
      },
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        gte(appointments.startsAt, now),
        lt(appointments.startsAt, endOfDay),
        ne(appointments.status, 'cancelled'),
      )
    )
    .orderBy(appointments.startsAt)
    .limit(limit);
}

export async function getNoShowRate(clinicId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [result] = await db
    .select({
      total: count(),
      noShows: count(
        sql`CASE WHEN ${appointments.status} = 'no_show' THEN 1 END`
      ),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        gte(appointments.startsAt, thirtyDaysAgo)
      )
    );

  if (!result || result.total === 0) return 0;
  return Math.round((result.noShows / result.total) * 1000) / 10;
}

export async function getWeeklyOccupancy(clinicId: string) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();
  const startOfWeek = new Date(now);
  const dayOfWeek = now.getDay();
  startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const result = await db
    .select({
      dayOfWeek: sql<number>`EXTRACT(ISODOW FROM ${appointments.startsAt})`.as('dow'),
      count: count(),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        gte(appointments.startsAt, startOfWeek),
        lte(appointments.startsAt, endOfWeek)
      )
    )
    .groupBy(sql`EXTRACT(ISODOW FROM ${appointments.startsAt})`);

  const maxSlots = 20;
  return days.map((day, i) => {
    const row = result.find((r) => Number(r.dayOfWeek) === i + 1);
    const c = Number(row?.count ?? 0);
    const pct = Math.min(Math.round((c / maxSlots) * 100), 100);
    return { day, count: c, pct };
  });
}

export async function getAppointmentById(id: string) {
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  return appointment ?? null;
}

export async function getAppointmentsByPatientIds(patientIds: string[], clinicId: string) {
  if (patientIds.length === 0) return [];

  return db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      notes: appointments.notes,
      amountCharged: appointments.amountCharged,
      amountPaid: appointments.amountPaid,
      paymentStatus: appointments.paymentStatus,
      doctor: {
        fullName: doctors.fullName,
      },
      treatmentType: {
        name: treatmentTypes.name,
      },
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        sql`${appointments.patientId} IN (${sql.join(patientIds.map(id => sql`${id}`), sql`, `)})`
      )
    )
    .orderBy(sql`${appointments.startsAt} DESC`);
}

export async function getMonthlyRevenue(clinicId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [result] = await db
    .select({
      paid: sum(sql`CASE WHEN ${appointments.paymentStatus} IN ('paid', 'partial') THEN ${appointments.amountPaid} ELSE 0 END`),
      pending: sum(sql`CASE WHEN ${appointments.paymentStatus} IN ('pending', 'partial') AND ${appointments.amountCharged} IS NOT NULL THEN (${appointments.amountCharged} - ${appointments.amountPaid}) ELSE 0 END`),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        gte(appointments.startsAt, startOfMonth),
        lte(appointments.startsAt, endOfMonth)
      )
    );

  return {
    paid: Number(result?.paid ?? 0),
    pending: Number(result?.pending ?? 0),
  };
}