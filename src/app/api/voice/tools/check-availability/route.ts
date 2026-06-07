import { NextRequest } from 'next/server';
import { runCheckAvailability } from '@/lib/voice/tool-actions';
import { failToolJson, okToolJson, parseAuthorizedVoiceToolRequest } from '@/lib/voice/tool-route';

export async function POST(request: NextRequest) {
  const auth = await parseAuthorizedVoiceToolRequest(request);
  if ('error' in auth) return auth.error;

  const result = await runCheckAvailability(auth.parsed);
  if (!result.ok) {
    return failToolJson(result.error, result.code);
  }

  const slotText = result.data.slots.map((s) => `${s.date} ${s.start}-${s.end}`).join(', ');
  return okToolJson(`Slobodni termini kod ${result.data.doctorName}: ${slotText}.`, {
    slots: result.data.slots,
    doctorId: result.data.doctorId,
    doctorName: result.data.doctorName,
  });
}
