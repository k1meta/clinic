import { after } from 'next/server';
import { scheduleAppointmentReminders } from '@/lib/schedule-reminders';
import { rescheduleAppointment } from '@/lib/voice/booking-service';
import { readText, readTime } from '@/lib/voice/tool-request';
import { voiceTool } from '@/lib/voice/tool-route';

export const POST = voiceTool(async (ctx, args) => {
  const result = await rescheduleAppointment({
    ctx,
    date: readText(args.date, 10) ?? '',
    time: readTime(args.time) ?? '',
    patientName: readText(args.patient_name, 120),
    appointmentDate: readText(args.appointment_date, 10),
  });
  if (!result.ok) {
    return { ok: false, code: result.code, error: result.error, data: { alternatives: result.alternatives ?? [] } };
  }

  const { appointmentId, date, time, message } = result.data;
  after(() => scheduleAppointmentReminders(ctx.clinicId, appointmentId));
  return { ok: true, message, data: { date, time } };
});
