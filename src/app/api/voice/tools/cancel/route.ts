import { NextRequest } from 'next/server';
import {
  buildVoiceContext,
  readToolReason,
  resolveToolPatient,
} from '@/lib/voice/tool-actions';
import { cancelVoiceAppointment } from '@/lib/voice/booking-service';
import { failToolJson, okToolJson, parseAuthorizedVoiceToolRequest } from '@/lib/voice/tool-route';

export async function POST(request: NextRequest) {
  const auth = await parseAuthorizedVoiceToolRequest(request);
  if ('error' in auth) return auth.error;

  const patient = await resolveToolPatient(auth.parsed);
  if (!patient) {
    return failToolJson('Pacijent nije pronadjen po broju telefona.', 'patient_not_found');
  }

  const result = await cancelVoiceAppointment({
    ctx: buildVoiceContext(auth.parsed),
    patientId: patient.id,
    reason: readToolReason(auth.parsed),
  });

  if (!result.ok) {
    return failToolJson(result.error, result.code);
  }

  return okToolJson(result.data.message, {
    appointmentId: result.data.appointmentId,
    patientName: patient.fullName,
  });
}
