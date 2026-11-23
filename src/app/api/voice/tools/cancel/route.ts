import { cancelAppointment } from '@/lib/voice/booking-service';
import { readText } from '@/lib/voice/tool-request';
import { voiceTool } from '@/lib/voice/tool-route';

export const POST = voiceTool(async (ctx, args) => {
  const result = await cancelAppointment({
    ctx,
    patientName: readText(args.patient_name, 120),
    appointmentDate: readText(args.appointment_date, 10),
    reason: readText(args.reason, 300),
  });
  if (!result.ok) return { ok: false, code: result.code, error: result.error };
  return { ok: true, message: result.data.message };
});
