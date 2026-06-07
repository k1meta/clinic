import { and, desc, eq, gte, inArray, or } from 'drizzle-orm';
import { db } from '@/db';
import { appointments, calls, doctors, patients } from '@/db/schema';
import type { VoiceEventJobData } from '@/lib/queue';
import { checkNoOverlap, getNextAvailableSlots } from '@/lib/availability';
import { generateResponse } from '@/lib/ai/llm';
import { getClinicSettings } from '@/db/queries/clinics';

function normalizePhone(input: string): string {
  return input.replace(/[^\d+]/g, '');
}

function parseDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const dt = new Date(`${date}T${time}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

type VoiceIntent = {
  intent: 'book' | 'reschedule' | 'cancel' | 'availability' | 'other';
  date?: string;
  time?: string;
  durationMin?: number;
  reason?: string;
};

async function classifyIntentBosnian(transcript: string, nowIso: string): Promise<VoiceIntent> {
  const systemPrompt = [
    'Ti si klasifikator za telefonske razgovore klinike.',
    'Vrati STROGI JSON sa poljima: intent, date, time, durationMin, reason.',
    'Intent mora biti jedno od: book,reschedule,cancel,availability,other.',
    'Ako korisnik navodi datum/vrijeme, normalizuj u YYYY-MM-DD i HH:MM (24h).',
    'Ako nije jasno, intent=other.',
    `Trenutno vrijeme (referenca): ${nowIso}.`,
    'Odgovori samo JSON.',
  ].join(' ');
  const raw = await generateResponse(systemPrompt, transcript, 220, { json: true });
  try {
    const parsed = JSON.parse(raw) as VoiceIntent;
    if (!parsed.intent) return { intent: 'other' };
    return parsed;
  } catch {
    return { intent: 'other' };
  }
}

export async function processVoiceEvent(data: VoiceEventJobData) {
  const settings = await getClinicSettings(data.clinicId);
  if (!settings.aiCalls) {
    return;
  }

  const now = new Date();
  const phone = data.fromNumber ? normalizePhone(data.fromNumber) : null;
  const [patient] = phone
    ? await db
        .select({ id: patients.id, fullName: patients.fullName })
        .from(patients)
        .where(
          and(
            eq(patients.clinicId, data.clinicId),
            or(
              eq(patients.phone, phone),
              eq(patients.phone, phone.replace(/^\+/, '')),
              eq(patients.phone, '+' + phone.replace(/^\+/, '')),
            )!,
          ),
        )
        .limit(1)
    : [];

  const [existingCall] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(eq(calls.providerCallId, data.providerCallId))
    .limit(1);

  if (!existingCall) {
    await db.insert(calls).values({
      clinicId: data.clinicId,
      patientId: patient?.id ?? null,
      provider: data.provider,
      providerCallId: data.providerCallId,
      direction: data.direction ?? 'inbound',
      status: data.eventType.includes('end') ? 'completed' : 'in_progress',
      fromNumber: data.fromNumber ?? null,
      toNumber: data.toNumber ?? null,
      transcript: data.transcript ?? null,
      language: 'bs-BA',
      metadata: data.payload,
      startedAt: now,
      endedAt: data.eventType.includes('end') ? now : null,
    });
  } else {
    await db
      .update(calls)
      .set({
        patientId: patient?.id ?? null,
        transcript: data.transcript || undefined,
        status: data.eventType.includes('end') ? 'completed' : 'in_progress',
        metadata: data.payload,
        updatedAt: now,
        ...(data.eventType.includes('end') ? { endedAt: now } : {}),
      })
      .where(eq(calls.id, existingCall.id));
  }

  if (!patient || !data.transcript || data.transcript.trim().length < 6) {
    return;
  }

  const intent = await classifyIntentBosnian(data.transcript, now.toISOString());

  if (intent.intent === 'availability') {
    const [doctor] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(and(eq(doctors.clinicId, data.clinicId), eq(doctors.isActive, true)))
      .orderBy(doctors.fullName)
      .limit(1);
    if (!doctor) return;
    const fromDate = intent.date ?? new Date().toISOString().slice(0, 10);
    const slots = await getNextAvailableSlots(data.clinicId, doctor.id, fromDate, intent.durationMin ?? 30, 5);
    await db
      .update(calls)
      .set({
        outcome: slots.length > 0 ? 'availability_shared' : 'availability_none',
        summary:
          slots.length > 0
            ? 'Predlozeni termini: ' + slots.map((s) => `${s.date} ${s.start}`).join(', ')
            : 'Nema slobodnih termina u narednim danima.',
        updatedAt: new Date(),
      })
      .where(eq(calls.providerCallId, data.providerCallId));
    return;
  }

  if (intent.intent === 'cancel') {
    const [upcoming] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, data.clinicId),
          eq(appointments.patientId, patient.id),
          gte(appointments.startsAt, new Date()),
          inArray(appointments.status, ['confirmed', 'arrived']),
        ),
      )
      .orderBy(appointments.startsAt)
      .limit(1);
    if (!upcoming) return;
    await db
      .update(appointments)
      .set({ status: 'cancelled', cancelledReason: intent.reason ?? 'Otkano telefonski', updatedAt: new Date() })
      .where(eq(appointments.id, upcoming.id));
    await db
      .update(calls)
      .set({ appointmentId: upcoming.id, outcome: 'cancelled', summary: 'Termin otkazan putem AI poziva.', updatedAt: new Date() })
      .where(eq(calls.providerCallId, data.providerCallId));
    return;
  }

  if (intent.intent === 'reschedule') {
    const [upcoming] = await db
      .select({ id: appointments.id, doctorId: appointments.doctorId })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, data.clinicId),
          eq(appointments.patientId, patient.id),
          gte(appointments.startsAt, new Date()),
          inArray(appointments.status, ['confirmed', 'arrived']),
        ),
      )
      .orderBy(appointments.startsAt)
      .limit(1);
    if (!upcoming) return;
    const fromDate = intent.date ?? new Date().toISOString().slice(0, 10);
    const slots = await getNextAvailableSlots(data.clinicId, upcoming.doctorId, fromDate, intent.durationMin ?? 30, 1);
    const next = slots[0];
    if (!next) return;
    const startsAt = parseDateTime(next.date, next.start);
    const endsAt = parseDateTime(next.date, next.end);
    if (!startsAt || !endsAt) return;
    await db
      .update(appointments)
      .set({ startsAt, endsAt, status: 'confirmed', updatedAt: new Date() })
      .where(eq(appointments.id, upcoming.id));
    await db
      .update(calls)
      .set({
        appointmentId: upcoming.id,
        outcome: 'rescheduled',
        summary: `Termin pomjeren na ${next.date} ${next.start}.`,
        updatedAt: new Date(),
      })
      .where(eq(calls.providerCallId, data.providerCallId));
    return;
  }

  if (intent.intent === 'book' && intent.date && intent.time) {
    const [doctor] = await db
      .select({ id: doctors.id, fullName: doctors.fullName })
      .from(doctors)
      .where(and(eq(doctors.clinicId, data.clinicId), eq(doctors.isActive, true)))
      .orderBy(doctors.fullName)
      .limit(1);
    if (!doctor) return;
    const durationMin = intent.durationMin ?? 30;
    const startsAt = parseDateTime(intent.date, intent.time);
    if (!startsAt) return;
    const endsAt = new Date(startsAt.getTime() + durationMin * 60000);
    const overlap = await checkNoOverlap(data.clinicId, doctor.id, startsAt, endsAt);
    if (overlap.hasOverlap) {
      const slots = await getNextAvailableSlots(data.clinicId, doctor.id, intent.date, durationMin, 1);
      const slot = slots[0];
      await db
        .update(calls)
        .set({
          outcome: 'book_conflict',
          summary: slot
            ? `Trazeni termin zauzet. Predlog: ${slot.date} ${slot.start}.`
            : 'Trazeni termin zauzet i nema brzog alternativnog termina.',
          updatedAt: new Date(),
        })
        .where(eq(calls.providerCallId, data.providerCallId));
      return;
    }
    const [created] = await db
      .insert(appointments)
      .values({
        clinicId: data.clinicId,
        patientId: patient.id,
        doctorId: doctor.id,
        startsAt,
        endsAt,
        status: 'confirmed',
        source: 'voice_ai',
        amountPaid: 0,
        paymentStatus: 'pending',
        notes: 'Kreirano putem AI telefonskog poziva',
      })
      .returning({ id: appointments.id });
    await db
      .update(calls)
      .set({
        appointmentId: created.id,
        outcome: 'booked',
        summary: `Novi termin zakazan: ${intent.date} ${intent.time}.`,
        updatedAt: new Date(),
      })
      .where(eq(calls.providerCallId, data.providerCallId));
    return;
  }

  const [last] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(eq(calls.providerCallId, data.providerCallId))
    .orderBy(desc(calls.updatedAt))
    .limit(1);
  if (!last) return;
  await db.update(calls).set({ outcome: 'other', updatedAt: new Date() }).where(eq(calls.id, last.id));
}
