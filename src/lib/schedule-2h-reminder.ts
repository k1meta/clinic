import { db } from '@/db';
import { appointments, automations, messages } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { addSendMessageJob } from '@/lib/queue';

/** Milliseconds from now until exactly 2 h before `startsAt`. Null if that moment has passed. */
export function compute2hReminderDelayMs(startsAt: Date): number | null {
  const sendAt = startsAt.getTime() - 2 * 60 * 60 * 1000;
  const delay = sendAt - Date.now();
  if (delay <= 0) return null;
  return delay;
}

async function hasInboundConfirmation(appointmentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.appointmentId, appointmentId),
        eq(messages.type, 'confirmation'),
        eq(messages.direction, 'inbound'),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Queues a one-time `reminder_2h` SMS job at exactly T−2 h.
 * Skips if automation off, cancelled, patient already confirmed via WhatsApp, or nudge already sent.
 * The 15-minute scan remains a backup for missed jobs.
 */
export async function schedule2hReminderIfEligible(params: {
  clinicId: string;
  appointmentId: string;
}): Promise<void> {
  const { clinicId, appointmentId } = params;

  const [apt] = await db
    .select({
      patientId: appointments.patientId,
      startsAt: appointments.startsAt,
      status: appointments.status,
    })
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinicId)))
    .limit(1);

  if (!apt || apt.status === 'cancelled') return;

  const delayMs = compute2hReminderDelayMs(new Date(apt.startsAt));
  if (delayMs === null) return;

  const [auto] = await db
    .select({ isEnabled: automations.isEnabled })
    .from(automations)
    .where(and(eq(automations.clinicId, clinicId), eq(automations.type, 'reminder_2h')))
    .limit(1);
  if (!auto?.isEnabled) return;

  if (await hasInboundConfirmation(appointmentId)) return;

  const [existing] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.appointmentId, appointmentId),
        eq(messages.type, 'reminder_2h'),
        eq(messages.direction, 'outbound'),
        inArray(messages.status, ['queued', 'sent', 'delivered', 'read']),
      ),
    )
    .limit(1);
  if (existing) return;

  await addSendMessageJob(
    {
      clinicId,
      patientId: apt.patientId,
      appointmentId,
      type: 'reminder_2h',
    },
    { delay: delayMs },
  );
}
