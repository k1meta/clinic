import { db } from '@/db';
import { appointments, treatmentTypes, calls } from '@/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { getClinicSettings } from './clinics';

/**
 * Appointment sources that ClinicOS automation created without staff phone time.
 * Revenue from these is directly attributable to the product.
 */
const AI_SOURCES_SQL = sql`('voice_ai', 'whatsapp_ai', 'instagram_ai', 'messenger_ai', 'online')`;

/** Revenue per appointment: explicit charge, else the treatment's list price. (minor units / BAM*100) */
const REVENUE_EXPR = sql`coalesce(${appointments.amountCharged}, ${treatmentTypes.price}, 0)`;

export type RoiMetrics = {
  /** Appointments booked by AI / online this month (non-cancelled). */
  aiBookedCount: number;
  /** Realized revenue (minor units) from completed AI/online appointments this month. */
  aiBookedRevenue: number;
  /** Completed appointments this month for patients who received a re-engagement message. */
  reEngagementCount: number;
  /** Revenue (minor units) from those re-engagement-driven completed appointments. */
  reEngagementRevenue: number;
  /** Current no-show rate this month (0..1). */
  noShowRateCurrent: number;
  /** Baseline no-show rate from clinic settings (0..1). */
  noShowBaseline: number;
  /** Estimated revenue (minor units) protected vs the baseline no-show rate. */
  noShowAvoidedEstimate: number;
  /** Inbound calls received outside working hours this month. */
  afterHoursCalls: number;
  /** Average completed-appointment ticket this month (minor units). */
  avgTicket: number;
};

function monthWindow(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export async function getRoiMetrics(clinicId: string): Promise<RoiMetrics> {
  const { start, end } = monthWindow();
  const settings = await getClinicSettings(clinicId);
  const workStart = settings.workHours.start;
  const workEnd = settings.workHours.end;
  const noShowBaseline = settings.noShowBaseline;

  const [aiAgg] = await db
    .select({
      bookedCount: sql<number>`cast(count(*) filter (where ${appointments.status} <> 'cancelled') as int)`,
      completedRevenue: sql<number>`cast(coalesce(sum(${REVENUE_EXPR}) filter (where ${appointments.status} = 'completed'), 0) as int)`,
    })
    .from(appointments)
    .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        sql`${appointments.source} in ${AI_SOURCES_SQL}`,
        gte(appointments.startsAt, start),
        lte(appointments.startsAt, end),
      ),
    );

  const [reAgg] = await db
    .select({
      count: sql<number>`cast(count(*) as int)`,
      revenue: sql<number>`cast(coalesce(sum(${REVENUE_EXPR}), 0) as int)`,
    })
    .from(appointments)
    .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.status, 'completed'),
        gte(appointments.startsAt, start),
        lte(appointments.startsAt, end),
        sql`${appointments.patientId} in (select m.patient_id from messages m where m.clinic_id = ${clinicId} and m.type = 're_engagement' and m.direction = 'outbound')`,
      ),
    );

  const [apptAgg] = await db
    .select({
      occurred: sql<number>`cast(count(*) filter (where ${appointments.status} in ('completed','no_show')) as int)`,
      noShows: sql<number>`cast(count(*) filter (where ${appointments.status} = 'no_show') as int)`,
      completed: sql<number>`cast(count(*) filter (where ${appointments.status} = 'completed') as int)`,
      completedRevenue: sql<number>`cast(coalesce(sum(${REVENUE_EXPR}) filter (where ${appointments.status} = 'completed'), 0) as int)`,
    })
    .from(appointments)
    .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        gte(appointments.startsAt, start),
        lte(appointments.startsAt, end),
      ),
    );

  const [callAgg] = await db
    .select({
      afterHours: sql<number>`cast(count(*) filter (where extract(hour from coalesce(${calls.startedAt}, ${calls.createdAt})) < ${workStart} or extract(hour from coalesce(${calls.startedAt}, ${calls.createdAt})) >= ${workEnd}) as int)`,
    })
    .from(calls)
    .where(
      and(
        eq(calls.clinicId, clinicId),
        eq(calls.direction, 'inbound'),
        gte(calls.createdAt, start),
        lte(calls.createdAt, end),
      ),
    );

  const occurred = apptAgg?.occurred ?? 0;
  const noShows = apptAgg?.noShows ?? 0;
  const completed = apptAgg?.completed ?? 0;
  const completedRevenue = apptAgg?.completedRevenue ?? 0;

  const noShowRateCurrent = occurred > 0 ? noShows / occurred : 0;
  const avgTicket = completed > 0 ? Math.round(completedRevenue / completed) : 0;
  const noShowAvoidedEstimate = Math.max(
    0,
    Math.round((noShowBaseline - noShowRateCurrent) * completed * avgTicket),
  );

  return {
    aiBookedCount: aiAgg?.bookedCount ?? 0,
    aiBookedRevenue: aiAgg?.completedRevenue ?? 0,
    reEngagementCount: reAgg?.count ?? 0,
    reEngagementRevenue: reAgg?.revenue ?? 0,
    noShowRateCurrent: Math.round(noShowRateCurrent * 1000) / 10,
    noShowBaseline: Math.round(noShowBaseline * 1000) / 10,
    noShowAvoidedEstimate,
    afterHoursCalls: callAgg?.afterHours ?? 0,
    avgTicket,
  };
}
