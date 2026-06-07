import { db } from '@/db';
import { appointments, messages, automations } from '@/db/schema';
import { and, eq, ne, inArray, sql } from 'drizzle-orm';
import { getClinicSettings } from '@/db/queries/clinics';
import { addSendMessageJob } from '@/lib/queue';

/** 5–10 minutes after scheduled `endsAt`, at least 30s from now if checkout is late. */
export function computeReviewRequestDelayMs(endsAt: Date): number {
  const jitterMin = 5 + Math.floor(Math.random() * 6);
  const target = endsAt.getTime() + jitterMin * 60 * 1000;
  const delta = target - Date.now();
  return Math.max(30_000, delta);
}

/**
 * Queues a one-time `review_request` WhatsApp job after the patient’s first completed visit.
 * No-ops if URL missing, automation off, not first completion, or already queued/sent.
 */
export async function scheduleReviewRequestIfEligible(params: {
  clinicId: string;
  appointmentId: string;
}): Promise<void> {
  const { clinicId, appointmentId } = params;
  const settings = await getClinicSettings(clinicId);
  if (!settings.googleReviewUrl.trim()) return;

  const scheduled = await db.transaction(async (tx) => {
    const [apt] = await tx
      .select({
        patientId: appointments.patientId,
        endsAt: appointments.endsAt,
        status: appointments.status,
      })
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinicId)))
      .limit(1);

    if (!apt || apt.status !== 'completed') return null;

    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${apt.patientId}::text))`);

    const [aptAgain] = await tx
      .select({ status: appointments.status })
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinicId)))
      .limit(1);
    if (aptAgain?.status !== 'completed') return null;

    const [priorRow] = await tx
      .select({ c: sql<number>`cast(count(*) as int)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, apt.patientId),
          eq(appointments.clinicId, clinicId),
          eq(appointments.status, 'completed'),
          ne(appointments.id, appointmentId),
        ),
      );
    if ((priorRow?.c ?? 0) > 0) return null;

    const [dupPatient] = await tx
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.patientId, apt.patientId),
          eq(messages.type, 'review_request'),
          eq(messages.direction, 'outbound'),
          inArray(messages.status, ['queued', 'sent', 'delivered', 'read']),
        ),
      )
      .limit(1);
    if (dupPatient) return null;

    const [dupAppt] = await tx
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.appointmentId, appointmentId),
          eq(messages.type, 'review_request'),
          eq(messages.direction, 'outbound'),
          inArray(messages.status, ['queued', 'sent', 'delivered', 'read']),
        ),
      )
      .limit(1);
    if (dupAppt) return null;

    const [auto] = await tx
      .select({ isEnabled: automations.isEnabled })
      .from(automations)
      .where(and(eq(automations.clinicId, clinicId), eq(automations.type, 'review_request')))
      .limit(1);
    if (!auto?.isEnabled) return null;

    return {
      patientId: apt.patientId,
      delayMs: computeReviewRequestDelayMs(new Date(apt.endsAt)),
    };
  });

  if (!scheduled) return;

  await addSendMessageJob(
    {
      clinicId,
      patientId: scheduled.patientId,
      appointmentId,
      type: 'review_request',
    },
    { delay: scheduled.delayMs },
  );
}
