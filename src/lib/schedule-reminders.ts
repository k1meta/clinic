import { describeError } from '@/lib/voice/log';
import { schedule2hReminderIfEligible } from '@/lib/schedule-2h-reminder';
import { schedule48hReminderIfEligible } from '@/lib/schedule-48h-reminder';

/** Queue both reminders for a new or moved appointment. Never throws. */
export async function scheduleAppointmentReminders(clinicId: string, appointmentId: string): Promise<void> {
  const results = await Promise.allSettled([
    schedule48hReminderIfEligible({ clinicId, appointmentId }),
    schedule2hReminderIfEligible({ clinicId, appointmentId }),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') console.error('[reminders] scheduling failed:', describeError(result.reason));
  }
}
