import { db } from '@/db';
import { appointments, messages, patients, doctors } from '@/db/schema';
import { eq, and, gte, lte, ne, notExists, sql } from 'drizzle-orm';
import { addSendMessageJob } from '@/lib/queue';

/**
 * Backup scan for missed 48 h reminders only.
 * Primary path: `schedule48hReminderIfEligible` fires at exactly T−48 h on booking.
 * This catches appointments whose send time passed (within a 2 h grace) but no message went out.
 */
export async function scan48hReminders() {
  const now = new Date();
  // Send time = startsAt − 48 h has passed when startsAt <= now + 48 h
  const sendTimePassedBefore = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  // Grace: only appts still within 46–48 h window (avoid firing day-before reminders early)
  const graceFloor = new Date(now.getTime() + 46 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: appointments.id,
      clinicId: appointments.clinicId,
      patientId: appointments.patientId,
    })
    .from(appointments)
    .where(
      and(
        ne(appointments.status, 'cancelled'),
        gte(appointments.startsAt, now),
        gte(appointments.startsAt, graceFloor),
        lte(appointments.startsAt, sendTimePassedBefore),
        notExists(
          db.select({ x: sql`1` })
            .from(messages)
            .where(
              and(
                eq(messages.appointmentId, appointments.id),
                eq(messages.type, 'reminder_48h'),
                eq(messages.direction, 'outbound'),
              ),
            ),
        ),
      ),
    );

  for (const row of rows) {
    await addSendMessageJob({
      clinicId: row.clinicId,
      patientId: row.patientId,
      appointmentId: row.id,
      type: 'reminder_48h',
    });
  }

  return rows.length;
}

/**
 * Backup scan for missed 2 h SMS nudges only.
 * Primary path: `schedule2hReminderIfEligible` fires at exactly T−2 h on booking.
 * Catches appointments whose send time passed but no SMS went out (and no WhatsApp confirm).
 */
export async function scan2hReminders() {
  const now = new Date();
  const sendTimePassedBefore = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: appointments.id,
      clinicId: appointments.clinicId,
      patientId: appointments.patientId,
    })
    .from(appointments)
    .where(
      and(
        ne(appointments.status, 'cancelled'),
        gte(appointments.startsAt, now),
        lte(appointments.startsAt, sendTimePassedBefore),
        // No confirmation received
        notExists(
          db.select({ x: sql`1` })
            .from(messages)
            .where(
              and(
                eq(messages.appointmentId, appointments.id),
                eq(messages.type, 'confirmation'),
                eq(messages.direction, 'inbound'),
              ),
            ),
        ),
        // No 2h nudge already sent
        notExists(
          db.select({ x: sql`1` })
            .from(messages)
            .where(
              and(
                eq(messages.appointmentId, appointments.id),
                eq(messages.type, 'reminder_2h'),
                eq(messages.direction, 'outbound'),
              ),
            ),
        ),
      ),
    );

  for (const row of rows) {
    await addSendMessageJob({
      clinicId: row.clinicId,
      patientId: row.patientId,
      appointmentId: row.id,
      type: 'reminder_2h',
    });
  }

  return rows.length;
}

/** Scan for completed appointments needing post-visit follow-up. */
export async function scanPostVisit() {
  const now = new Date();
  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const rows = await db
    .select({
      id: appointments.id,
      clinicId: appointments.clinicId,
      patientId: appointments.patientId,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.status, 'completed'),
        gte(appointments.startsAt, yesterdayStart),
        lte(appointments.startsAt, yesterdayEnd),
        notExists(
          db.select({ x: sql`1` })
            .from(messages)
            .where(
              and(
                eq(messages.appointmentId, appointments.id),
                eq(messages.type, 'post_visit'),
                eq(messages.direction, 'outbound'),
              ),
            ),
        ),
      ),
    );

  for (const row of rows) {
    await addSendMessageJob({
      clinicId: row.clinicId,
      patientId: row.patientId,
      appointmentId: row.id,
      type: 'post_visit',
    });
  }

  return rows.length;
}

/** Scan for patients inactive 6+ months for re-engagement. */
export async function scanReEngagement() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Find patients whose last appointment was before 6 months ago
  const rows = await db
    .select({
      patientId: patients.id,
      clinicId: patients.clinicId,
    })
    .from(patients)
    .where(
      and(
        ne(patients.status, 'inactive'),
        sql`${patients.optOutAt} IS NULL`,
        notExists(
          db.select({ x: sql`1` })
            .from(appointments)
            .where(
              and(
                eq(appointments.patientId, patients.id),
                gte(appointments.startsAt, sixMonthsAgo),
              ),
            ),
        ),
        // No re-engagement sent in last 30 days
        notExists(
          db.select({ x: sql`1` })
            .from(messages)
            .where(
              and(
                eq(messages.patientId, patients.id),
                eq(messages.type, 're_engagement'),
                gte(messages.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
              ),
            ),
        ),
      ),
    );

  for (const row of rows) {
    await addSendMessageJob({
      clinicId: row.clinicId,
      patientId: row.patientId,
      type: 're_engagement',
    });
  }

  return rows.length;
}
