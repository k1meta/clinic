import { and, count, eq, gt, gte, inArray, lt, ne, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { appointments, doctors, patients, treatmentTypes } from '@/db/schema';
import { getClinicSettings, type ClinicSettings } from '@/db/queries/clinics';
import {
  findSlotProblem,
  getAvailableSlots,
  getNextAvailableSlots,
  type SlotProblem,
  type TimeSlot,
} from '@/lib/availability';
import { isValidDate, speakDateBs, todayInZone, toZonedParts, zonedToUtc } from '@/lib/timezone';
import { tryRecordCall, type VoiceContext } from '@/lib/voice/call-log';
import { nameMatches } from '@/lib/voice/names';
import { findPatientsByPhone, resolveBookingPatient, resolveVerifiedPatient } from '@/lib/voice/patients';

const DEFAULT_DURATION_MIN = 30;

export type VoiceErrorCode =
  | 'doctor_not_found'
  | 'treatment_not_found'
  | 'invalid_datetime'
  | 'slot_unavailable'
  | 'no_slots'
  | 'no_upcoming_appointment'
  | 'multiple_appointments'
  | 'missing_patient_name'
  | 'missing_patient_phone'
  | 'ambiguous_patient'
  | 'caller_not_verified'
  | SlotProblem;

export type VoiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: VoiceErrorCode; alternatives?: OfferedSlot[] };

export type OfferedSlot = TimeSlot & { doctor: string; spoken: string };

type Doctor = { id: string; fullName: string; specialty: string };
type Treatment = { id: string; name: string; durationMin: number; price: number | null };
type Failure = { ok: false; error: string; code: VoiceErrorCode };

function speakSlot(date: string, time: string): string {
  return `${speakDateBs(date)} u ${time}`;
}

async function getActiveDoctors(clinicId: string): Promise<Doctor[]> {
  return db
    .select({ id: doctors.id, fullName: doctors.fullName, specialty: doctors.specialty })
    .from(doctors)
    .where(and(eq(doctors.clinicId, clinicId), eq(doctors.isActive, true)))
    .orderBy(doctors.fullName);
}

/** No name → every active doctor. An unknown name is an error, never someone else. */
async function pickDoctors(
  clinicId: string,
  spokenDoctor?: string,
): Promise<{ ok: true; doctors: Doctor[] } | Failure> {
  const all = await getActiveDoctors(clinicId);
  if (all.length === 0) {
    return { ok: false, code: 'doctor_not_found', error: 'Trenutno nema dostupnih doktora.' };
  }
  if (!spokenDoctor) return { ok: true, doctors: all };
  const matches = all.filter((d) => nameMatches(spokenDoctor, d.fullName));
  if (matches.length > 0) return { ok: true, doctors: matches };
  return {
    ok: false,
    code: 'doctor_not_found',
    error: `Nema doktora "${spokenDoctor}". Dostupni su: ${all.map((d) => d.fullName).join(', ')}.`,
  };
}

async function pickTreatment(
  clinicId: string,
  spokenTreatment?: string,
): Promise<{ ok: true; treatment: Treatment | null } | Failure> {
  if (!spokenTreatment) return { ok: true, treatment: null };
  const all = await db
    .select({
      id: treatmentTypes.id,
      name: treatmentTypes.name,
      durationMin: treatmentTypes.defaultDurationMin,
      price: treatmentTypes.price,
    })
    .from(treatmentTypes)
    .where(eq(treatmentTypes.clinicId, clinicId))
    .orderBy(treatmentTypes.name);

  const wanted = spokenTreatment.toLowerCase();
  const treatment =
    all.find((t) => t.name.toLowerCase() === wanted) ?? all.find((t) => nameMatches(spokenTreatment, t.name));
  if (treatment) return { ok: true, treatment };
  return {
    ok: false,
    code: 'treatment_not_found',
    error: `Nema usluge "${spokenTreatment}". Dostupne usluge: ${all.map((t) => t.name).join(', ')}. Ako pacijent nije siguran, izostavi uslugu.`,
  };
}

async function findSlots(params: {
  clinicId: string;
  doctors: Doctor[];
  durationMin: number;
  fromDate: string;
  onlyThatDay: boolean;
  nearTime?: string;
  limit: number;
}): Promise<OfferedSlot[]> {
  const perDoctor = await Promise.all(
    params.doctors.map(async (doctor) => {
      const slots = params.onlyThatDay
        ? await getAvailableSlots(params.clinicId, doctor.id, params.fromDate, params.durationMin)
        : await getNextAvailableSlots(params.clinicId, doctor.id, params.fromDate, params.durationMin, 40);
      return slots.map((slot) => ({ ...slot, doctor: doctor.fullName, spoken: speakSlot(slot.date, slot.start) }));
    }),
  );

  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const target = params.nearTime ? toMinutes(params.nearTime) : null;

  const seen = new Set<string>();
  return perDoctor
    .flat()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (target !== null) {
        const diff = Math.abs(toMinutes(a.start) - target) - Math.abs(toMinutes(b.start) - target);
        if (diff !== 0) return diff;
      }
      return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
    })
    .filter((slot) => {
      const key = `${slot.date} ${slot.start}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, params.limit);
}

export async function checkAvailability(params: {
  clinicId: string;
  date?: string;
  time?: string;
  doctor?: string;
  treatment?: string;
}): Promise<VoiceResult<{ slots: OfferedSlot[]; message: string }>> {
  const settings = await getClinicSettings(params.clinicId);
  const today = todayInZone(settings.timezone);

  if (params.date && !isValidDate(params.date)) {
    return { ok: false, code: 'invalid_datetime', error: 'Datum mora biti u formatu YYYY-MM-DD.' };
  }
  if (params.date && params.date < today) {
    return { ok: false, code: 'in_past', error: `Taj datum je prošao. Danas je ${speakDateBs(today)} (${today}).` };
  }

  const [doctorPick, treatmentPick] = await Promise.all([
    pickDoctors(params.clinicId, params.doctor),
    pickTreatment(params.clinicId, params.treatment),
  ]);
  if (!doctorPick.ok) return doctorPick;
  if (!treatmentPick.ok) return treatmentPick;

  const search = {
    clinicId: params.clinicId,
    doctors: doctorPick.doctors,
    durationMin: treatmentPick.treatment?.durationMin ?? DEFAULT_DURATION_MIN,
    nearTime: params.time,
    limit: 3,
  };
  let slots = await findSlots({ ...search, fromDate: params.date ?? today, onlyThatDay: Boolean(params.date) });
  let prefix = 'Slobodno: ';
  if (slots.length === 0 && params.date) {
    slots = await findSlots({ ...search, fromDate: params.date, onlyThatDay: false });
    prefix = `${speakDateBs(params.date)} nema slobodnih termina. Najbliže slobodno: `;
  }
  if (slots.length === 0) {
    return { ok: false, code: 'no_slots', error: 'Nema slobodnih termina u naredne dvije sedmice. Ponudi take_message.' };
  }
  return {
    ok: true,
    data: { slots, message: prefix + slots.map((s) => `${s.spoken} (${s.doctor})`).join('; ') + '.' },
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Serializes bookings per doctor, so two callers cannot take the same slot. */
async function lockDoctorAndCheckFree(
  tx: Tx,
  params: { doctorId: string; startsAt: Date; endsAt: Date; excludeId?: string },
): Promise<boolean> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${params.doctorId}::text, 0))`);
  const [conflict] = await tx
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, params.doctorId),
        notInArray(appointments.status, ['cancelled', 'no_show']),
        lt(appointments.startsAt, params.endsAt),
        gt(appointments.endsAt, params.startsAt),
        ...(params.excludeId ? [ne(appointments.id, params.excludeId)] : []),
      ),
    )
    .limit(1);
  return !conflict;
}

/** True for the `no_doctor_overlap` exclusion constraint (23P01), however it is wrapped. */
export function isOverlapViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth++) {
    if ((current as { code?: unknown }).code === '23P01') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function freeSlotOrNull<T>(attempt: () => Promise<T | null>): Promise<T | null> {
  try {
    return await attempt();
  } catch (error) {
    if (isOverlapViolation(error)) return null;
    throw error;
  }
}

const SLOT_PROBLEM_TEXT: Record<SlotProblem, string> = {
  in_past: 'To vrijeme je već prošlo.',
  closed_day: 'Tog dana ne radimo.',
  outside_hours: 'Taj termin je van radnog vremena.',
};

async function slotFailure(params: {
  code: VoiceErrorCode;
  text: string;
  clinicId: string;
  doctors: Doctor[];
  durationMin: number;
  date: string;
  time: string;
  settings: ClinicSettings;
}): Promise<VoiceResult<never>> {
  const today = todayInZone(params.settings.timezone);
  const alternatives = await findSlots({
    clinicId: params.clinicId,
    doctors: params.doctors,
    durationMin: params.durationMin,
    fromDate: params.date > today ? params.date : today,
    onlyThatDay: false,
    nearTime: params.time,
    limit: 3,
  });
  const offer =
    alternatives.length > 0
      ? ` Ponudi: ${alternatives.map((s) => `${s.spoken} (${s.doctor})`).join('; ')}.`
      : ' Nema drugih slobodnih termina u naredne dvije sedmice. Ponudi take_message.';
  return { ok: false, code: params.code, error: params.text + offer, alternatives };
}

export type BookedAppointment = {
  appointmentId: string;
  date: string;
  time: string;
  doctorName: string;
  patientName: string;
  patientRegistered: boolean;
  alreadyBooked: boolean;
  message: string;
};

export async function bookAppointment(params: {
  ctx: VoiceContext;
  date: string;
  time: string;
  doctor?: string;
  treatment?: string;
  patientName?: string;
  spokenPhone?: string;
}): Promise<VoiceResult<BookedAppointment>> {
  const { ctx, date, time } = params;
  const settings = await getClinicSettings(ctx.clinicId);
  const startsAt = zonedToUtc(date, time, settings.timezone);
  if (!startsAt) {
    return { ok: false, code: 'invalid_datetime', error: 'Neispravan datum (YYYY-MM-DD) ili vrijeme (HH:MM).' };
  }

  const [doctorPick, treatmentPick, patientPick] = await Promise.all([
    pickDoctors(ctx.clinicId, params.doctor),
    pickTreatment(ctx.clinicId, params.treatment),
    resolveBookingPatient({
      clinicId: ctx.clinicId,
      callerNumber: ctx.callerNumber,
      spokenName: params.patientName,
      spokenPhone: params.spokenPhone,
    }),
  ]);
  if (!doctorPick.ok) return doctorPick;
  if (!treatmentPick.ok) return treatmentPick;
  if (!patientPick.ok) return patientPick;

  const { treatment } = treatmentPick;
  const who = patientPick.value;
  const durationMin = treatment?.durationMin ?? DEFAULT_DURATION_MIN;
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  const failure = { clinicId: ctx.clinicId, doctors: doctorPick.doctors, durationMin, date, time, settings };

  const problem = findSlotProblem({ startsAt, endsAt, weekHours: settings.weekHours, timeZone: settings.timezone });
  if (problem) return slotFailure({ ...failure, code: problem, text: SLOT_PROBLEM_TEXT[problem] });

  // A retried tool call must confirm the first booking, not create a second one.
  if (who.kind === 'existing') {
    const [same] = await db
      .select({ id: appointments.id, doctorName: doctors.fullName })
      .from(appointments)
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(
        and(
          eq(appointments.clinicId, ctx.clinicId),
          eq(appointments.patientId, who.patient.id),
          eq(appointments.startsAt, startsAt),
          inArray(appointments.status, ['confirmed', 'arrived']),
        ),
      )
      .limit(1);
    if (same) {
      const message = `Termin je već potvrđen: ${speakSlot(date, time)}, ${same.doctorName}.`;
      return {
        ok: true,
        data: {
          appointmentId: same.id,
          date,
          time,
          doctorName: same.doctorName,
          patientName: who.patient.fullName,
          patientRegistered: false,
          alreadyBooked: true,
          message,
        },
      };
    }
  }

  for (const doctor of doctorPick.doctors) {
    const created = await freeSlotOrNull(() =>
      db.transaction(async (tx) => {
        if (!(await lockDoctorAndCheckFree(tx, { doctorId: doctor.id, startsAt, endsAt }))) return null;

        let patientId: string;
        if (who.kind === 'new') {
          const [row] = await tx
            .insert(patients)
            .values({ clinicId: ctx.clinicId, fullName: who.fullName, phone: who.phone, status: 'new' })
            .returning({ id: patients.id });
          patientId = row.id;
        } else {
          patientId = who.patient.id;
          if (who.renameTo) {
            await tx
              .update(patients)
              .set({ fullName: who.renameTo, updatedAt: new Date() })
              .where(eq(patients.id, patientId));
          }
        }

        const [row] = await tx
          .insert(appointments)
          .values({
            clinicId: ctx.clinicId,
            patientId,
            doctorId: doctor.id,
            treatmentTypeId: treatment?.id ?? null,
            startsAt,
            endsAt,
            status: 'confirmed',
            source: 'voice_ai',
            amountCharged: treatment?.price ?? null,
            amountPaid: 0,
            paymentStatus: 'pending',
            notes: 'Kreirano putem AI telefonskog poziva',
          })
          .returning({ id: appointments.id });
        return { appointmentId: row.id, patientId };
      }),
    );
    if (!created) continue;

    const patientName = who.kind === 'new' ? who.fullName : (who.renameTo ?? who.patient.fullName);
    const message = `Termin je potvrđen: ${speakSlot(date, time)}, ${doctor.fullName}, pacijent ${patientName}.`;
    await tryRecordCall(ctx, {
      patientId: created.patientId,
      appointmentId: created.appointmentId,
      outcome: 'booked',
      summary: message,
    });
    return {
      ok: true,
      data: {
        appointmentId: created.appointmentId,
        date,
        time,
        doctorName: doctor.fullName,
        patientName,
        patientRegistered: who.kind === 'new',
        alreadyBooked: false,
        message,
      },
    };
  }

  return slotFailure({ ...failure, code: 'slot_unavailable', text: `Termin ${speakSlot(date, time)} je zauzet.` });
}

type UpcomingAppointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
};

async function getUpcoming(clinicId: string, patientId: string): Promise<UpcomingAppointment[]> {
  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      doctorId: appointments.doctorId,
      doctorName: doctors.fullName,
      doctorSpecialty: doctors.specialty,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.patientId, patientId),
        gte(appointments.startsAt, new Date()),
        inArray(appointments.status, ['confirmed', 'arrived']),
      ),
    )
    .orderBy(appointments.startsAt)
    .limit(10);
}

/** The caller's appointment, asking for the date when there is more than one. */
async function pickUpcoming(
  ctx: VoiceContext,
  patientId: string,
  timeZone: string,
  appointmentDate?: string,
): Promise<{ ok: true; appointment: UpcomingAppointment } | Failure> {
  const all = await getUpcoming(ctx.clinicId, patientId);
  const matching = appointmentDate
    ? all.filter((a) => toZonedParts(a.startsAt, timeZone).date === appointmentDate)
    : all;
  if (matching.length === 1) return { ok: true, appointment: matching[0] };
  if (all.length === 0) {
    return { ok: false, code: 'no_upcoming_appointment', error: 'Pacijent nema zakazanih termina.' };
  }
  const listed = all.map((a) => {
    const parts = toZonedParts(a.startsAt, timeZone);
    return `${speakSlot(parts.date, parts.time)} (${parts.date})`;
  });
  return {
    ok: false,
    code: 'multiple_appointments',
    error: `Pitaj na koji termin misli: ${listed.join('; ')}. Zatim pošalji appointment_date. Ako ih je više istog dana, ponudi take_message.`,
  };
}

export async function cancelAppointment(params: {
  ctx: VoiceContext;
  patientName?: string;
  appointmentDate?: string;
  reason?: string;
}): Promise<VoiceResult<{ appointmentId: string; message: string }>> {
  const { ctx } = params;
  const verified = await resolveVerifiedPatient(ctx.clinicId, ctx.callerNumber, params.patientName);
  if (!verified.ok) return verified;

  const { timezone } = await getClinicSettings(ctx.clinicId);
  const picked = await pickUpcoming(ctx, verified.patient.id, timezone, params.appointmentDate);
  if (!picked.ok) return picked;

  await db
    .update(appointments)
    .set({ status: 'cancelled', cancelledReason: params.reason ?? 'Otkazano telefonski (AI)', updatedAt: new Date() })
    .where(and(eq(appointments.id, picked.appointment.id), eq(appointments.clinicId, ctx.clinicId)));

  const parts = toZonedParts(picked.appointment.startsAt, timezone);
  const message = `Otkazan je termin: ${speakSlot(parts.date, parts.time)}.`;
  await tryRecordCall(ctx, {
    patientId: verified.patient.id,
    appointmentId: picked.appointment.id,
    outcome: 'cancelled',
    summary: message,
  });
  return { ok: true, data: { appointmentId: picked.appointment.id, message } };
}

export async function rescheduleAppointment(params: {
  ctx: VoiceContext;
  date: string;
  time: string;
  patientName?: string;
  appointmentDate?: string;
}): Promise<VoiceResult<{ appointmentId: string; date: string; time: string; message: string }>> {
  const { ctx, date, time } = params;
  const verified = await resolveVerifiedPatient(ctx.clinicId, ctx.callerNumber, params.patientName);
  if (!verified.ok) return verified;

  const settings = await getClinicSettings(ctx.clinicId);
  const startsAt = zonedToUtc(date, time, settings.timezone);
  if (!startsAt) {
    return { ok: false, code: 'invalid_datetime', error: 'Neispravan datum (YYYY-MM-DD) ili vrijeme (HH:MM).' };
  }

  const picked = await pickUpcoming(ctx, verified.patient.id, settings.timezone, params.appointmentDate);
  if (!picked.ok) return picked;
  const { appointment } = picked;

  const durationMs = appointment.endsAt.getTime() - appointment.startsAt.getTime();
  const endsAt = new Date(startsAt.getTime() + durationMs);
  const failure = {
    clinicId: ctx.clinicId,
    doctors: [{ id: appointment.doctorId, fullName: appointment.doctorName, specialty: appointment.doctorSpecialty }],
    durationMin: Math.max(5, Math.round(durationMs / 60_000)),
    date,
    time,
    settings,
  };

  const problem = findSlotProblem({ startsAt, endsAt, weekHours: settings.weekHours, timeZone: settings.timezone });
  if (problem) return slotFailure({ ...failure, code: problem, text: SLOT_PROBLEM_TEXT[problem] });

  const moved = await freeSlotOrNull(() =>
    db.transaction(async (tx) => {
      const free = await lockDoctorAndCheckFree(tx, {
        doctorId: appointment.doctorId,
        startsAt,
        endsAt,
        excludeId: appointment.id,
      });
      if (!free) return null;
      const [row] = await tx
        .update(appointments)
        .set({ startsAt, endsAt, status: 'confirmed', updatedAt: new Date() })
        .where(and(eq(appointments.id, appointment.id), eq(appointments.clinicId, ctx.clinicId)))
        .returning({ id: appointments.id });
      return row ?? null;
    }),
  );
  if (!moved) {
    return slotFailure({ ...failure, code: 'slot_unavailable', text: `Termin ${speakSlot(date, time)} je zauzet.` });
  }

  const message = `Termin je pomjeren: ${speakSlot(date, time)}, ${appointment.doctorName}.`;
  await tryRecordCall(ctx, {
    patientId: verified.patient.id,
    appointmentId: appointment.id,
    outcome: 'rescheduled',
    summary: message,
  });
  return { ok: true, data: { appointmentId: appointment.id, date, time, message } };
}

export type CallerProfile = {
  callerType: 'unknown' | 'new' | 'returning' | 'shared_number';
  firstName: string;
  message: string;
};

/** Reveals details only for a caller ID that belongs to exactly one patient. */
export async function identifyCaller(ctx: VoiceContext): Promise<CallerProfile> {
  const matches = await findPatientsByPhone(ctx.clinicId, ctx.callerNumber);

  if (matches.length === 0) {
    return {
      callerType: 'unknown',
      firstName: '',
      message: ctx.callerNumber
        ? 'Novi pozivalac. Prije zakazivanja pitaj ime i prezime.'
        : 'Broj pozivaoca nije vidljiv. Prije zakazivanja pitaj ime, prezime i broj telefona.',
    };
  }
  if (matches.length > 1) {
    return {
      callerType: 'shared_number',
      firstName: '',
      message: 'Više pacijenata koristi ovaj broj. Pitaj za koga se zove (ime i prezime).',
    };
  }

  const [patient] = matches;
  const firstName = patient.fullName.trim().split(/\s+/)[0] ?? '';
  const { timezone } = await getClinicSettings(ctx.clinicId);
  const [upcoming, visits] = await Promise.all([
    getUpcoming(ctx.clinicId, patient.id),
    db
      .select({ total: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, ctx.clinicId),
          eq(appointments.patientId, patient.id),
          eq(appointments.status, 'completed'),
        ),
      ),
  ]);
  const returning = (visits[0]?.total ?? 0) > 0 || patient.status === 'active';
  const next = upcoming[0] ? toZonedParts(upcoming[0].startsAt, timezone) : null;

  await tryRecordCall(ctx, { patientId: patient.id });

  return {
    callerType: returning ? 'returning' : 'new',
    firstName,
    message:
      `Pacijent u bazi: ${patient.fullName}. Potvrdi da razgovaraš s tom osobom. ` +
      (next
        ? `Sljedeći termin: ${speakSlot(next.date, next.time)}, ${upcoming[0].doctorName}.`
        : 'Nema zakazanih termina.'),
  };
}
