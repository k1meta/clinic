import { and, count, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { appointments, calls, doctors, patients } from '@/db/schema';
import {
  checkNoOverlap,
  getAvailableSlots,
  getNextAvailableSlots,
  type TimeSlot,
} from '@/lib/availability';
import { normalizePhone, parseDateTime, phoneMatchVariants } from '@/lib/voice/utils';

export type VoiceBookingErrorCode =
  | 'patient_not_found'
  | 'doctor_not_found'
  | 'invalid_datetime'
  | 'slot_unavailable'
  | 'no_upcoming_appointment'
  | 'no_slots'
  | 'ai_calls_disabled'
  | 'no_caller_phone'
  | 'missing_patient_name'
  | 'missing_patient_phone';

export type VoiceBookingResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: VoiceBookingErrorCode };

export type VoiceBookingContext = {
  clinicId: string;
  provider: 'retell' | 'elevenlabs';
  providerCallId: string;
  fromNumber?: string | null;
  language?: string;
};

function msg(language: string | undefined, bs: string, en: string) {
  return language?.toLowerCase().startsWith('en') ? en : bs;
}

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

function phoneMatchCondition(clinicId: string, phone: string) {
  const variants = phoneMatchVariants(phone);
  const digits = phoneDigits(phone);
  return and(
    eq(patients.clinicId, clinicId),
    or(
      ...variants.map((v) => eq(patients.phone, v)),
      sql`regexp_replace(coalesce(${patients.phone}, ''), '[^0-9]', '', 'g') = ${digits}`,
    )!,
  );
}

export async function findPatientByPhone(clinicId: string, phone: string | null | undefined) {
  if (!phone) return null;
  const [patient] = await db
    .select({ id: patients.id, fullName: patients.fullName, phone: patients.phone })
    .from(patients)
    .where(phoneMatchCondition(clinicId, phone))
    .limit(1);
  return patient ?? null;
}

export async function findOrCreatePatientByPhone(params: {
  clinicId: string;
  phone: string;
  fullName?: string;
}) {
  const existing = await findPatientByPhone(params.clinicId, params.phone);
  if (existing) return existing;

  const name = params.fullName?.trim() || 'Nepoznati pacijent';
  const [created] = await db
    .insert(patients)
    .values({
      clinicId: params.clinicId,
      fullName: name,
      phone: normalizePhone(params.phone),
      status: 'new',
    })
    .returning({ id: patients.id, fullName: patients.fullName, phone: patients.phone });

  return created;
}

const PLACEHOLDER_PATIENT_NAME = 'Nepoznati pacijent';

export async function createPatientForVoiceBooking(params: {
  clinicId: string;
  phone: string;
  fullName: string;
}) {
  const name = params.fullName.trim();
  if (!name) {
    throw new Error('fullName is required for voice booking registration');
  }

  const [created] = await db
    .insert(patients)
    .values({
      clinicId: params.clinicId,
      fullName: name,
      phone: normalizePhone(params.phone),
      status: 'new',
    })
    .returning({ id: patients.id, fullName: patients.fullName, phone: patients.phone });

  return created;
}

export async function updatePatientNameIfPlaceholder(patientId: string, fullName: string) {
  const name = fullName.trim();
  if (!name) return null;

  const [updated] = await db
    .update(patients)
    .set({ fullName: name, updatedAt: new Date() })
    .where(and(eq(patients.id, patientId), eq(patients.fullName, PLACEHOLDER_PATIENT_NAME)))
    .returning({ id: patients.id, fullName: patients.fullName, phone: patients.phone });

  if (updated) return updated;

  const [existing] = await db
    .select({ id: patients.id, fullName: patients.fullName, phone: patients.phone })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  return existing ?? null;
}

export type CallerType = 'unknown' | 'new' | 'returning';

export type CallerProfile = {
  callerType: CallerType;
  patientId?: string;
  patientName?: string;
  firstName?: string;
  upcomingAppointment?: { date: string; time: string; doctorName: string };
  completedVisitCount: number;
  ambiguous?: boolean;
  matchedNames?: string[];
  message: string;
};

function parseFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

async function findPatientsByPhone(clinicId: string, phone: string) {
  return db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      phone: patients.phone,
      status: patients.status,
    })
    .from(patients)
    .where(phoneMatchCondition(clinicId, phone));
}

async function countCompletedVisits(clinicId: string, patientId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.patientId, patientId),
        eq(appointments.status, 'completed'),
      ),
    );
  return row?.total ?? 0;
}

async function getUpcomingAppointmentWithDoctor(clinicId: string, patientId: string) {
  const upcoming = await getUpcomingAppointment(clinicId, patientId);
  if (!upcoming) return null;

  const [doctor] = await db
    .select({ fullName: doctors.fullName })
    .from(doctors)
    .where(eq(doctors.id, upcoming.doctorId))
    .limit(1);

  const date = new Date(upcoming.startsAt).toISOString().slice(0, 10);
  const time = new Date(upcoming.startsAt).toTimeString().slice(0, 5);
  return {
    date,
    time,
    doctorName: doctor?.fullName ?? 'Doktor',
  };
}

function buildCallerMessage(
  profile: Omit<CallerProfile, 'message'>,
  language?: string,
): string {
  const en = language?.toLowerCase().startsWith('en');

  if (profile.ambiguous && profile.matchedNames?.length) {
    const names = profile.matchedNames.join(', ');
    return en
      ? `Multiple patients share this phone number: ${names}. Ask who is calling.`
      : `Na ovom broju telefona vise pacijenata: ${names}. Pitaj ko telefonira.`;
  }

  if (profile.callerType === 'unknown') {
    return en
      ? 'New caller - not in the system. Ask for full name before booking.'
      : 'Novi pozivatelj - nije u bazi. Pitaj ime i prezime prije zakazivanja.';
  }

  const name = profile.patientName ?? '';
  const first = profile.firstName ?? name;

  if (profile.callerType === 'new') {
    return en
      ? `Patient ${name} is on file but has no prior visits. Confirm their identity briefly.`
      : `Pacijent ${name} je u bazi ali nema prethodnih posjeta. Kratko potvrdi identitet.`;
  }

  const upcoming = profile.upcomingAppointment;
  if (upcoming) {
    return en
      ? `Returning patient: ${name}. Next appointment ${upcoming.date} at ${upcoming.time} with ${upcoming.doctorName}. Greet ${first} by name and confirm identity once.`
      : `Poznat pacijent: ${name}. Sljedeci termin ${upcoming.date} u ${upcoming.time} kod ${upcoming.doctorName}. Pozdravi ${first} po imenu i kratko potvrdi identitet.`;
  }

  return en
    ? `Returning patient: ${name}. No upcoming appointment. Greet ${first} by name and confirm identity once.`
    : `Poznat pacijent: ${name}. Nema zakazanog termina. Pozdravi ${first} po imenu i kratko potvrdi identitet.`;
}

export async function lookupCallerProfile(params: {
  clinicId: string;
  phone: string;
  language?: string;
}): Promise<VoiceBookingResult<CallerProfile>> {
  const matches = await findPatientsByPhone(params.clinicId, params.phone);

  if (matches.length === 0) {
    const profile: CallerProfile = {
      callerType: 'unknown',
      completedVisitCount: 0,
      message: '',
    };
    profile.message = buildCallerMessage(profile, params.language);
    return { ok: true, data: profile };
  }

  if (matches.length > 1) {
    const names = matches.map((p) => p.fullName);
    const primary = matches[0];
    const completedVisitCount = await countCompletedVisits(params.clinicId, primary.id);
    const upcomingAppointment = await getUpcomingAppointmentWithDoctor(params.clinicId, primary.id);
    const callerType: CallerType =
      completedVisitCount > 0 || primary.status === 'active' ? 'returning' : 'new';

    const profile: CallerProfile = {
      callerType,
      patientId: primary.id,
      patientName: primary.fullName,
      firstName: parseFirstName(primary.fullName),
      upcomingAppointment: upcomingAppointment ?? undefined,
      completedVisitCount,
      ambiguous: true,
      matchedNames: names,
      message: '',
    };
    profile.message = buildCallerMessage(profile, params.language);
    return { ok: true, data: profile };
  }

  const patient = matches[0];
  const completedVisitCount = await countCompletedVisits(params.clinicId, patient.id);
  const callerType: CallerType =
    completedVisitCount > 0 || patient.status === 'active' ? 'returning' : 'new';
  const upcomingAppointment = await getUpcomingAppointmentWithDoctor(params.clinicId, patient.id);

  const profile: CallerProfile = {
    callerType,
    patientId: patient.id,
    patientName: patient.fullName,
    firstName: parseFirstName(patient.fullName),
    upcomingAppointment: upcomingAppointment ?? undefined,
    completedVisitCount,
    message: '',
  };
  profile.message = buildCallerMessage(profile, params.language);
  return { ok: true, data: profile };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function resolveDoctor(clinicId: string, doctorId?: string) {
  if (doctorId) {
    if (isUuid(doctorId)) {
      const [doctor] = await db
        .select({ id: doctors.id, fullName: doctors.fullName })
        .from(doctors)
        .where(and(eq(doctors.clinicId, clinicId), eq(doctors.id, doctorId), eq(doctors.isActive, true)))
        .limit(1);
      if (doctor) return doctor;
    } else {
      const [doctor] = await db
        .select({ id: doctors.id, fullName: doctors.fullName })
        .from(doctors)
        .where(
          and(
            eq(doctors.clinicId, clinicId),
            ilike(doctors.fullName, `%${doctorId}%`),
            eq(doctors.isActive, true),
          ),
        )
        .limit(1);
      if (doctor) return doctor;
    }
  }

  const [doctor] = await db
    .select({ id: doctors.id, fullName: doctors.fullName })
    .from(doctors)
    .where(and(eq(doctors.clinicId, clinicId), eq(doctors.isActive, true)))
    .orderBy(doctors.fullName)
    .limit(1);

  return doctor ?? null;
}

async function getUpcomingAppointment(clinicId: string, patientId: string) {
  const [upcoming] = await db
    .select({
      id: appointments.id,
      doctorId: appointments.doctorId,
      startsAt: appointments.startsAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.patientId, patientId),
        gte(appointments.startsAt, new Date()),
        inArray(appointments.status, ['confirmed', 'arrived']),
      ),
    )
    .orderBy(appointments.startsAt)
    .limit(1);

  return upcoming ?? null;
}

async function withOptionalCallRecord<T>(operation: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[voice] call record skipped (${operation}):`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function upsertCallRecord(ctx: VoiceBookingContext, patch: {
  patientId?: string | null;
  outcome?: string;
  summary?: string;
  appointmentId?: string | null;
  status?: 'in_progress' | 'completed';
}) {
  await withOptionalCallRecord('upsert', async () => {
    const now = new Date();
    const [existing] = await db
      .select({ id: calls.id })
      .from(calls)
      .where(eq(calls.providerCallId, ctx.providerCallId))
      .limit(1);

    if (!existing) {
      await db.insert(calls).values({
        clinicId: ctx.clinicId,
        patientId: patch.patientId ?? null,
        appointmentId: patch.appointmentId ?? null,
        provider: ctx.provider,
        providerCallId: ctx.providerCallId,
        direction: 'inbound',
        status: patch.status ?? 'in_progress',
        fromNumber: ctx.fromNumber ?? null,
        language: ctx.language ?? 'bs-BA',
        outcome: patch.outcome ?? null,
        summary: patch.summary ?? null,
        startedAt: now,
        endedAt: patch.status === 'completed' ? now : null,
      });
      return;
    }

    await db
      .update(calls)
      .set({
        patientId: patch.patientId ?? undefined,
        appointmentId: patch.appointmentId ?? undefined,
        outcome: patch.outcome ?? undefined,
        summary: patch.summary ?? undefined,
        status: patch.status ?? undefined,
        updatedAt: now,
        ...(patch.status === 'completed' ? { endedAt: now } : {}),
      })
      .where(eq(calls.id, existing.id));
  });
}

export async function checkVoiceAvailability(params: {
  clinicId: string;
  date?: string;
  doctorId?: string;
  durationMin?: number;
  limit?: number;
}): Promise<VoiceBookingResult<{ slots: TimeSlot[]; doctorId: string; doctorName: string }>> {
  const doctor = await resolveDoctor(params.clinicId, params.doctorId);
  if (!doctor) {
    return { ok: false, error: 'Nema dostupnog doktora u klinici.', code: 'doctor_not_found' };
  }

  const durationMin = params.durationMin ?? 30;
  const limit = params.limit ?? 5;
  const fromDate = params.date ?? new Date().toISOString().slice(0, 10);

  const slots = params.date
    ? (await getAvailableSlots(params.clinicId, doctor.id, params.date, durationMin)).slice(0, limit)
    : await getNextAvailableSlots(params.clinicId, doctor.id, fromDate, durationMin, limit);

  if (slots.length === 0) {
    return {
      ok: false,
      error: 'Nema slobodnih termina u trazenom periodu.',
      code: 'no_slots',
    };
  }

  return {
    ok: true,
    data: { slots, doctorId: doctor.id, doctorName: doctor.fullName },
  };
}

export async function bookVoiceAppointment(params: {
  ctx: VoiceBookingContext;
  patientId: string;
  date: string;
  time: string;
  doctorId?: string;
  durationMin?: number;
  notes?: string;
  idempotencyKey?: string;
}): Promise<
  VoiceBookingResult<{
    appointmentId: string;
    date: string;
    time: string;
    doctorName: string;
    message: string;
  }>
> {
  if (params.idempotencyKey) {
    const existingCall = await withOptionalCallRecord('idempotency', async () => {
      const [row] = await db
        .select({ appointmentId: calls.appointmentId, outcome: calls.outcome })
        .from(calls)
        .where(
          and(
            eq(calls.providerCallId, params.ctx.providerCallId),
            eq(calls.outcome, 'booked'),
          ),
        )
        .limit(1);
      return row ?? null;
    });

    if (existingCall?.appointmentId) {
      const [appt] = await db
        .select({
          id: appointments.id,
          startsAt: appointments.startsAt,
          doctorId: appointments.doctorId,
        })
        .from(appointments)
        .where(eq(appointments.id, existingCall.appointmentId))
        .limit(1);

      if (appt) {
        const [doctor] = await db
          .select({ fullName: doctors.fullName })
          .from(doctors)
          .where(eq(doctors.id, appt.doctorId))
          .limit(1);

        const date = new Date(appt.startsAt).toISOString().slice(0, 10);
        const time = new Date(appt.startsAt).toTimeString().slice(0, 5);
        return {
          ok: true,
          data: {
            appointmentId: appt.id,
            date,
            time,
            doctorName: doctor?.fullName ?? 'Doktor',
            message: `Termin je vec potvrden: ${date} u ${time}.`,
          },
        };
      }
    }
  }

  const doctor = await resolveDoctor(params.ctx.clinicId, params.doctorId);
  if (!doctor) {
    return { ok: false, error: 'Nema dostupnog doktora u klinici.', code: 'doctor_not_found' };
  }

  const durationMin = params.durationMin ?? 30;
  const startsAt = parseDateTime(params.date, params.time);
  if (!startsAt) {
    return { ok: false, error: 'Neispravan datum ili vrijeme.', code: 'invalid_datetime' };
  }

  const endsAt = new Date(startsAt.getTime() + durationMin * 60000);
  const overlap = await checkNoOverlap(params.ctx.clinicId, doctor.id, startsAt, endsAt);

  if (overlap.hasOverlap) {
    const alternatives = await getNextAvailableSlots(
      params.ctx.clinicId,
      doctor.id,
      params.date,
      durationMin,
      3,
    );
    const altText =
      alternatives.length > 0
        ? ` Predlozeni termini: ${alternatives.map((s) => `${s.date} ${s.start}`).join(', ')}.`
        : '';
    await upsertCallRecord(params.ctx, {
      patientId: params.patientId,
      outcome: 'book_conflict',
      summary: `Trazeni termin zauzet.${altText}`,
    });
    return {
      ok: false,
      error: `Trazeni termin ${params.date} ${params.time} je zauzet.${altText}`,
      code: 'slot_unavailable',
    };
  }

  const [created] = await db
    .insert(appointments)
    .values({
      clinicId: params.ctx.clinicId,
      patientId: params.patientId,
      doctorId: doctor.id,
      startsAt,
      endsAt,
      status: 'confirmed',
      source: 'voice_ai',
      amountPaid: 0,
      paymentStatus: 'pending',
      notes: params.notes ?? 'Kreirano putem AI telefonskog poziva',
    })
    .returning({ id: appointments.id });

  const message = `Termin potvrden za ${params.date} u ${params.time} kod ${doctor.fullName}.`;
  await upsertCallRecord(params.ctx, {
    patientId: params.patientId,
    appointmentId: created.id,
    outcome: 'booked',
    summary: message,
  });

  return {
    ok: true,
    data: {
      appointmentId: created.id,
      date: params.date,
      time: params.time,
      doctorName: doctor.fullName,
      message,
    },
  };
}

export async function cancelVoiceAppointment(params: {
  ctx: VoiceBookingContext;
  patientId: string;
  reason?: string;
}): Promise<VoiceBookingResult<{ appointmentId: string; message: string }>> {
  const upcoming = await getUpcomingAppointment(params.ctx.clinicId, params.patientId);
  if (!upcoming) {
    return {
      ok: false,
      error: 'Pacijent nema nadolazeceg termina za otkazivanje.',
      code: 'no_upcoming_appointment',
    };
  }

  await db
    .update(appointments)
    .set({
      status: 'cancelled',
      cancelledReason: params.reason ?? 'Otkazano telefonski',
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, upcoming.id));

  const message = 'Termin je uspjesno otkazan.';
  await upsertCallRecord(params.ctx, {
    patientId: params.patientId,
    appointmentId: upcoming.id,
    outcome: 'cancelled',
    summary: message,
  });

  return { ok: true, data: { appointmentId: upcoming.id, message } };
}

export async function rescheduleVoiceAppointment(params: {
  ctx: VoiceBookingContext;
  patientId: string;
  date?: string;
  time?: string;
  durationMin?: number;
}): Promise<
  VoiceBookingResult<{
    appointmentId: string;
    date: string;
    time: string;
    message: string;
  }>
> {
  const upcoming = await getUpcomingAppointment(params.ctx.clinicId, params.patientId);
  if (!upcoming) {
    return {
      ok: false,
      error: 'Pacijent nema nadolazeceg termina za pomjeranje.',
      code: 'no_upcoming_appointment',
    };
  }

  const durationMin = params.durationMin ?? 30;

  if (params.date && params.time) {
    const startsAt = parseDateTime(params.date, params.time);
    if (!startsAt) {
      return { ok: false, error: 'Neispravan datum ili vrijeme.', code: 'invalid_datetime' };
    }
    const endsAt = new Date(startsAt.getTime() + durationMin * 60000);
    const overlap = await checkNoOverlap(
      params.ctx.clinicId,
      upcoming.doctorId,
      startsAt,
      endsAt,
      upcoming.id,
    );
    if (overlap.hasOverlap) {
      const alternatives = await getNextAvailableSlots(
        params.ctx.clinicId,
        upcoming.doctorId,
        params.date,
        durationMin,
        3,
      );
      const altText =
        alternatives.length > 0
          ? ` Predlozi: ${alternatives.map((s) => `${s.date} ${s.start}`).join(', ')}.`
          : '';
      return {
        ok: false,
        error: `Termin ${params.date} ${params.time} je zauzet.${altText}`,
        code: 'slot_unavailable',
      };
    }

    await db
      .update(appointments)
      .set({ startsAt, endsAt, status: 'confirmed', updatedAt: new Date() })
      .where(eq(appointments.id, upcoming.id));

    const message = `Termin pomjeren na ${params.date} u ${params.time}.`;
    await upsertCallRecord(params.ctx, {
      patientId: params.patientId,
      appointmentId: upcoming.id,
      outcome: 'rescheduled',
      summary: message,
    });

    return {
      ok: true,
      data: { appointmentId: upcoming.id, date: params.date, time: params.time, message },
    };
  }

  const fromDate = params.date ?? new Date().toISOString().slice(0, 10);
  const slots = await getNextAvailableSlots(
    params.ctx.clinicId,
    upcoming.doctorId,
    fromDate,
    durationMin,
    1,
  );
  const next = slots[0];
  if (!next) {
    return { ok: false, error: 'Nema slobodnih termina za pomjeranje.', code: 'no_slots' };
  }

  const startsAt = parseDateTime(next.date, next.start);
  const endsAt = parseDateTime(next.date, next.end);
  if (!startsAt || !endsAt) {
    return { ok: false, error: 'Neispravan predlozeni termin.', code: 'invalid_datetime' };
  }

  await db
    .update(appointments)
    .set({ startsAt, endsAt, status: 'confirmed', updatedAt: new Date() })
    .where(eq(appointments.id, upcoming.id));

  const message = `Termin pomjeren na ${next.date} u ${next.start}.`;
  await upsertCallRecord(params.ctx, {
    patientId: params.patientId,
    appointmentId: upcoming.id,
    outcome: 'rescheduled',
    summary: message,
  });

  return {
    ok: true,
    data: { appointmentId: upcoming.id, date: next.date, time: next.start, message },
  };
}
