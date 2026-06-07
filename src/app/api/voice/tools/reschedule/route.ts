import { NextRequest } from 'next/server';
import {
  buildVoiceContext,
  readToolDate,
  readToolDuration,
  readToolTime,
  resolveToolPatient,
} from '@/lib/voice/tool-actions';
import { rescheduleVoiceAppointment } from '@/lib/voice/booking-service';
import { failToolJson, okToolJson, parseAuthorizedVoiceToolRequest } from '@/lib/voice/tool-route';

export async function POST(request: NextRequest) {
  const auth = await parseAuthorizedVoiceToolRequest(request);
  if ('error' in auth) return auth.error;

  const patient = await resolveToolPatient(auth.parsed);
  if (!patient) {
    return failToolJson('Pacijent nije pronadjen po broju telefona.', 'patient_not_found');
  }

  const result = await rescheduleVoiceAppointment({
    ctx: buildVoiceContext(auth.parsed),
    patientId: patient.id,
    date: readToolDate(auth.parsed),
    time: readToolTime(auth.parsed),
    durationMin: readToolDuration(auth.parsed),
  });

  if (!result.ok) {
    return failToolJson(result.error, result.code);
  }

  return okToolJson(result.data.message, {
    appointmentId: result.data.appointmentId,
    date: result.data.date,
    time: result.data.time,
    patientName: patient.fullName,
  });
}
