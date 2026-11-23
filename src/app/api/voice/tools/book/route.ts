import { after } from 'next/server';
import { scheduleAppointmentReminders } from '@/lib/schedule-reminders';
import { bookAppointment } from '@/lib/voice/booking-service';
import { readText, readTime } from '@/lib/voice/tool-request';
import { voiceTool } from '@/lib/voice/tool-route';

export const POST = voiceTool(async (ctx, args) => {
  const result = await bookAppointment({
    ctx,
    date: readText(args.date, 10) ?? '',
    time: readTime(args.time) ?? '',
    doctor: readText(args.doctor),
    treatment: readText(args.treatment),
    patientName: readText(args.patient_name, 120),
    spokenPhone: readText(args.phone, 40),
  });
  if (!result.ok) {
    return { ok: false, code: result.code, error: result.error, data: { alternatives: result.alternatives ?? [] } };
  }

  const { appointmentId, alreadyBooked, date, time, doctorName, patientName, message } = result.data;
  if (!alreadyBooked) after(() => scheduleAppointmentReminders(ctx.clinicId, appointmentId));
  return { ok: true, message, data: { date, time, doctorName, patientName } };
});
