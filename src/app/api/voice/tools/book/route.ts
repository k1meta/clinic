import { NextRequest } from 'next/server';
import {
  buildVoiceContext,
  readIdempotencyKey,
  readToolDate,
  readToolDoctorId,
  readToolDuration,
  readToolTime,
  resolveToolPatientForBooking,
} from '@/lib/voice/tool-actions';
import { bookVoiceAppointment } from '@/lib/voice/booking-service';
import { failToolJson, okToolJson, parseAuthorizedVoiceToolRequest } from '@/lib/voice/tool-route';

export async function POST(request: NextRequest) {
  const auth = await parseAuthorizedVoiceToolRequest(request);
  if ('error' in auth) return auth.error;

  const { parsed } = auth;
  const date = readToolDate(parsed);
  const time = readToolTime(parsed);
  if (!date || !time) {
    return failToolJson('Potrebni su datum (YYYY-MM-DD) i vrijeme (HH:MM).', 'invalid_datetime');
  }

  const patientResult = await resolveToolPatientForBooking(parsed);
  if (!patientResult.ok) {
    return failToolJson(patientResult.error, patientResult.code);
  }

  const { patient, patientRegistered } = patientResult.data;

  const result = await bookVoiceAppointment({
    ctx: buildVoiceContext(parsed),
    patientId: patient.id,
    date,
    time,
    doctorId: readToolDoctorId(parsed),
    durationMin: readToolDuration(parsed),
    idempotencyKey: readIdempotencyKey(parsed),
  });

  if (!result.ok) {
    return failToolJson(result.error, result.code);
  }

  return okToolJson(result.data.message, {
    appointmentId: result.data.appointmentId,
    date: result.data.date,
    time: result.data.time,
    doctorName: result.data.doctorName,
    patientName: patient.fullName,
    patientRegistered,
  });
}
