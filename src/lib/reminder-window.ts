/**
 * A reminder belongs to one appointment time. When an appointment moves, the job queued
 * for the old time must not send, and a reminder already sent for the old time must not
 * suppress the new one.
 */

const HOUR_MS = 60 * 60 * 1000;
/** Delayed jobs may start slightly early relative to the database clock. */
const EARLY_TOLERANCE_MS = 5 * 60 * 1000;

export const REMINDER_HOURS = { reminder_48h: 48, reminder_2h: 2 } as const;
export type TimedReminder = keyof typeof REMINDER_HOURS;

/** Reminders created before this instant were for an earlier appointment time. */
export function reminderWindowStart(startsAt: Date, type: TimedReminder): Date {
  return new Date(startsAt.getTime() - REMINDER_HOURS[type] * HOUR_MS - EARLY_TOLERANCE_MS);
}

/** Whether a reminder may be sent now for an appointment in this state. */
export function isReminderDue(
  appointment: { startsAt: Date; status: string },
  type: TimedReminder,
  now: Date = new Date(),
): boolean {
  if (appointment.status !== 'confirmed') return false;
  return now >= reminderWindowStart(appointment.startsAt, type) && now < appointment.startsAt;
}
