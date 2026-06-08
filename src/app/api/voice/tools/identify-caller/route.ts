import { NextRequest } from 'next/server';
import { upsertCallRecord } from '@/lib/voice/booking-service';
import { buildVoiceContext, runIdentifyCaller } from '@/lib/voice/tool-actions';
import { failToolJson, okToolJson, parseAuthorizedVoiceToolRequest } from '@/lib/voice/tool-route';

export async function POST(request: NextRequest) {
  const auth = await parseAuthorizedVoiceToolRequest(request);
  if ('error' in auth) return auth.error;

  const { parsed } = auth;
  const result = await runIdentifyCaller(parsed);

  if (!result.ok) {
    return failToolJson(result.error, result.code);
  }

  if (result.data.patientId) {
    await upsertCallRecord(buildVoiceContext(parsed), {
      patientId: result.data.patientId,
      outcome: 'identified',
      summary: result.data.message,
    });
  }

  return okToolJson(result.data.message, {
    callerType: result.data.callerType,
    patientId: result.data.patientId,
    patientName: result.data.patientName,
    firstName: result.data.firstName,
    upcomingAppointment: result.data.upcomingAppointment,
    completedVisitCount: result.data.completedVisitCount,
    ambiguous: result.data.ambiguous ?? false,
    matchedNames: result.data.matchedNames,
  });
}
