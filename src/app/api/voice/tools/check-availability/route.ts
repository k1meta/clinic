import { checkAvailability } from '@/lib/voice/booking-service';
import { readText, readTime } from '@/lib/voice/tool-request';
import { voiceTool } from '@/lib/voice/tool-route';

export const POST = voiceTool(async (ctx, args) => {
  const result = await checkAvailability({
    clinicId: ctx.clinicId,
    date: readText(args.date, 10),
    time: readTime(args.time),
    doctor: readText(args.doctor),
    treatment: readText(args.treatment),
  });
  if (!result.ok) return { ok: false, code: result.code, error: result.error };
  return { ok: true, message: result.data.message, data: { slots: result.data.slots } };
});
