import { NextRequest } from 'next/server';
import {
  checkVoiceAvailability,
  createPatientForVoiceBooking,
  findPatientByPhone,
  lookupCallerProfile,
  updatePatientNameIfPlaceholder,
  type VoiceBookingContext,
  type VoiceBookingResult,
} from '@/lib/voice/booking-service';
import type { ParsedVoiceToolRequest } from '@/lib/voice/tool-request';

export type BookingPatientResult = {
  patient: { id: string; fullName: string; phone: string | null };
  patientRegistered: boolean;
};

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function buildVoiceContext(parsed: ParsedVoiceToolRequest): VoiceBookingContext {
  return {
    clinicId: parsed.clinicId!,
    provider: parsed.provider,
    providerCallId: parsed.providerCallId,
    fromNumber: parsed.fromNumber,
    language: parsed.language,
  };
}

export function resolveCallerPhone(parsed: ParsedVoiceToolRequest): string | null {
  const explicit = readString(parsed.args.phone) ?? parsed.fromNumber;
  if (explicit) return explicit;

  // ElevenLabs web calls have no PSTN caller ID — stable per-conversation id for dev/testing.
  if (parsed.provider === 'elevenlabs' && parsed.providerCallId) {
    const slug = parsed.providerCallId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
    return slug ? `web-${slug}` : null;
  }

  return null;
}

export function isSyntheticWebPhone(phone: string): boolean {
  return phone.startsWith('web-');
}

function readToolPatientName(parsed: ParsedVoiceToolRequest): string | undefined {
  return readString(parsed.args.patient_name) ?? readString(parsed.args.fullName);
}

function resolveRegisterPhone(parsed: ParsedVoiceToolRequest): string | null {
  const candidates = [
    readString(parsed.args.phone),
    parsed.fromNumber ?? undefined,
  ].filter((value): value is string => Boolean(value));

  for (const phone of candidates) {
    if (!isSyntheticWebPhone(phone)) return phone;
  }

  return null;
}

export async function resolveToolPatientForBooking(
  parsed: ParsedVoiceToolRequest,
): Promise<VoiceBookingResult<BookingPatientResult>> {
  const lookupPhone = resolveCallerPhone(parsed);
  if (!lookupPhone) {
    return {
      ok: false,
      error: 'Nije moguce identificirati broj pozivatelja.',
      code: 'missing_patient_phone',
    };
  }

  const existing = await findPatientByPhone(parsed.clinicId!, lookupPhone);
  if (existing) {
    const providedName = readToolPatientName(parsed);
    const patient =
      existing.fullName === 'Nepoznati pacijent' && providedName
        ? (await updatePatientNameIfPlaceholder(existing.id, providedName)) ?? existing
        : existing;

    return {
      ok: true,
      data: { patient, patientRegistered: false },
    };
  }

  const fullName = readToolPatientName(parsed)?.trim();
  if (!fullName) {
    return {
      ok: false,
      error: 'Potrebno ime i prezime novog pacijenta prije zakazivanja.',
      code: 'missing_patient_name',
    };
  }

  const registerPhone = resolveRegisterPhone(parsed);
  if (!registerPhone) {
    return {
      ok: false,
      error: 'Potreban broj telefona novog pacijenta. Pitaj pozivatelja ili koristi broj s poziva.',
      code: 'missing_patient_phone',
    };
  }

  const patient = await createPatientForVoiceBooking({
    clinicId: parsed.clinicId!,
    phone: registerPhone,
    fullName,
  });

  return {
    ok: true,
    data: { patient, patientRegistered: true },
  };
}

export async function resolveToolPatient(parsed: ParsedVoiceToolRequest, options?: { allowCreate?: boolean }) {
  const phone = resolveCallerPhone(parsed);
  if (!phone) return null;

  if (options?.allowCreate) {
    const result = await resolveToolPatientForBooking(parsed);
    return result.ok ? result.data.patient : null;
  }

  return findPatientByPhone(parsed.clinicId!, phone);
}

export function readToolDate(parsed: ParsedVoiceToolRequest) {
  return readString(parsed.args.date);
}

export function readToolTime(parsed: ParsedVoiceToolRequest) {
  const raw = readString(parsed.args.time);
  if (!raw) return undefined;
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function readToolDuration(parsed: ParsedVoiceToolRequest) {
  return readNumber(parsed.args.duration_min) ?? readNumber(parsed.args.durationMin) ?? 30;
}

export function readToolDoctorId(parsed: ParsedVoiceToolRequest) {
  return readString(parsed.args.doctor_id) ?? readString(parsed.args.doctorId);
}

export function readToolLimit(parsed: ParsedVoiceToolRequest) {
  return readNumber(parsed.args.limit) ?? 5;
}

export function readToolReason(parsed: ParsedVoiceToolRequest) {
  return readString(parsed.args.reason);
}

export function readIdempotencyKey(parsed: ParsedVoiceToolRequest) {
  return readString(parsed.args.idempotency_key) ?? readString(parsed.args.idempotencyKey) ?? parsed.providerCallId;
}

export async function runCheckAvailability(parsed: ParsedVoiceToolRequest) {
  return checkVoiceAvailability({
    clinicId: parsed.clinicId!,
    date: readToolDate(parsed),
    doctorId: readToolDoctorId(parsed),
    durationMin: readToolDuration(parsed),
    limit: readToolLimit(parsed),
  });
}

export async function runIdentifyCaller(parsed: ParsedVoiceToolRequest) {
  const phone = resolveCallerPhone(parsed);
  if (!phone) {
    return {
      ok: false as const,
      error: 'Nije moguce identificirati broj pozivatelja.',
      code: 'no_caller_phone' as const,
    };
  }

  return lookupCallerProfile({
    clinicId: parsed.clinicId!,
    phone,
    language: parsed.language,
  });
}
