import { toE164 } from '@/lib/phone';
import { recordCallback } from '@/lib/voice/call-log';
import { readText } from '@/lib/voice/tool-request';
import { voiceTool } from '@/lib/voice/tool-route';

export const POST = voiceTool(async (ctx, args) => {
  const name = readText(args.patient_name, 120);
  const message = readText(args.message, 1000);
  if (!name || !message) {
    return { ok: false, code: 'missing_details', error: 'Potrebni su ime pozivaoca i kratka poruka.' };
  }
  const phone = toE164(readText(args.phone, 40)) ?? ctx.callerNumber;
  if (!phone) {
    return { ok: false, code: 'missing_patient_phone', error: 'Pitaj na koji broj da osoblje nazove.' };
  }
  await recordCallback(ctx, { name, phone, message, requestedAt: new Date().toISOString() });
  return { ok: true, message: 'Poruka je zabilježena. Reci pozivaocu da će ga osoblje nazvati.' };
});
