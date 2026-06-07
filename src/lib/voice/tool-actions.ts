import { NextRequest } from 'next/server';
import {
  checkVoiceAvailability,
  findOrCreatePatientByPhone,
  findPatientByPhone,
  type VoiceBookingContext,
} from '@/lib/voice/booking-service';
import type { ParsedVoiceToolRequest } from '@/lib/voice/tool-request';

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

export async function resolveToolPatient(parsed: ParsedVoiceToolRequest, options?: { allowCreate?: boolean }) {
  const phone = readString(parsed.args.phone) ?? parsed.fromNumber;
  if (!phone) return null;

  if (options?.allowCreate) {
    return findOrCreatePatientByPhone({
      clinicId: parsed.clinicId!,
      phone,
      fullName: readString(parsed.args.patient_name) ?? readString(parsed.args.fullName),
    });
  }

  return findPatientByPhone(parsed.clinicId!, phone);
}

export function readToolDate(parsed: ParsedVoiceToolRequest) {
  return readString(parsed.args.date);
}

export function readToolTime(parsed: ParsedVoiceToolRequest) {
  return readString(parsed.args.time);
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
