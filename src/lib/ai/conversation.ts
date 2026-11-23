import { db } from '@/db';
import { messages, doctors, treatmentTypes, appointments } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { generateResponse } from './llm';
import { getAvailableSlots, getNextAvailableSlots } from '@/lib/availability';
import { addDays, toZonedParts, todayInZone, zonedToUtc } from '@/lib/timezone';
import { describeWeekBs } from '@/lib/work-week';

export type ConvChannel = 'whatsapp' | 'instagram' | 'messenger';
export type ConvIntent = 'book' | 'cancel' | 'reschedule' | 'availability' | 'identify' | 'other';
export type ConvStep =
  | 'awaiting_identification'
  | 'awaiting_treatment'
  | 'awaiting_doctor'
  | 'awaiting_time'
  | 'awaiting_slot_choice'
  | 'done'
  | null;

export interface ConvState {
  intent: ConvIntent | null;
  step: ConvStep;
  treatmentName?: string;
  treatmentTypeId?: string;
  durationMin?: number;
  doctorId?: string;
  doctorName?: string;
  requestedDate?: string;
  requestedTime?: string;
  offeredSlots?: Array<{ start: string; end: string; date: string; doctorId: string; doctorName: string }>;
  targetAppointmentId?: string;
}

export interface HandleResult {
  response: string | null;
  nextState: ConvState;
  appointmentCreated?: boolean;
  slotOptions?: Array<{ id: string; title: string; description: string; payload: string }>;
}

interface ClinicContext {
  clinicId: string;
  clinicName: string;
  timezone: string;
  workingHours: string;
  doctors: Array<{ id: string; fullName: string; specialty: string }>;
  treatments: Array<{ id: string; name: string; durationMin: number }>;
}

interface IntentResult {
  intent: ConvIntent;
  extractedDate: string | null;
  extractedTime: string | null;
  extractedDoctorName: string | null;
  extractedTreatmentName: string | null;
  extractedPhone: string | null;
  extractedFullName: string | null;
  slotChoiceIndex: number | null;
}

const SYSTEM_PROMPT_BASE = [
  'Ti si profesionalni medicinski recepcioner klinike.',
  'Komuniciras na bosanskom/srpskom/hrvatskom jeziku, ili engleskom ako ti pacijent pise na engleskom.',
  'Budi kratak, jasan i ljubazan. Ne koristi emojije.',
  'Koristi formalno obracanje (Vi).',
].join(' ');

async function loadClinicContext(clinicId: string): Promise<ClinicContext> {
  const { getClinicSettings } = await import('@/db/queries/clinics');
  const settings = await getClinicSettings(clinicId);
  const { clinics } = await import('@/db/schema');
  const [clinic] = await db.select({ name: clinics.name }).from(clinics).where(eq(clinics.id, clinicId)).limit(1);

  const doctorRows = await db
    .select({ id: doctors.id, fullName: doctors.fullName, specialty: doctors.specialty })
    .from(doctors)
    .where(and(eq(doctors.clinicId, clinicId), eq(doctors.isActive, true)));

  const treatmentRows = await db
    .select({ id: treatmentTypes.id, name: treatmentTypes.name, durationMin: treatmentTypes.defaultDurationMin })
    .from(treatmentTypes)
    .where(eq(treatmentTypes.clinicId, clinicId));

  return {
    clinicId,
    clinicName: clinic?.name ?? 'Klinika',
    timezone: settings.timezone,
    workingHours: describeWeekBs(settings.weekHours),
    doctors: doctorRows,
    treatments: treatmentRows,
  };
}

async function classifyIntent(
  patientMessage: string,
  patientName: string,
  currentState: ConvState | null,
  ctx: ClinicContext,
  today: string,
): Promise<IntentResult> {
  const doctorList = ctx.doctors.map(d => d.fullName + ' (' + d.specialty + ')').join(', ');
  const treatmentList = ctx.treatments.map(t => t.name).join(', ');
  const stateStr = currentState ? JSON.stringify(currentState) : 'null';

  const systemPrompt = [
    'You are a JSON-only API for a medical clinic reservation system.',
    'Return ONLY a valid JSON object. No other text.',
    'Clinic: ' + ctx.clinicName,
    'Working hours: ' + ctx.workingHours,
    'Doctors: ' + doctorList,
    'Treatments: ' + treatmentList,
    'Today: ' + today,
    'Patient: ' + patientName,
    'Current conversation state: ' + stateStr,
    'Schema: {"intent":"book"|"cancel"|"reschedule"|"availability"|"identify"|"other","extractedDate":"YYYY-MM-DD"|null,"extractedTime":"HH:MM"|null,"extractedDoctorName":string|null,"extractedTreatmentName":string|null,"extractedPhone":string|null,"extractedFullName":string|null,"slotChoiceIndex":number|null}',
    'slotChoiceIndex: if patient is picking from a numbered list of offered slots (1-based), set this. Otherwise null.',
    'For relative dates like "sutra/tomorrow" use today as reference.',
  ].join(' ');

  // Gemini's responseMimeType: 'application/json' guarantees a clean JSON body,
  // so we can JSON.parse(raw) directly without the legacy regex scrub.
  const raw = await generateResponse(systemPrompt, 'Patient message: "' + patientMessage + '"', 300, { json: true });
  try {
    return JSON.parse(raw) as IntentResult;
  } catch {
    return { intent: 'other', extractedDate: null, extractedTime: null, extractedDoctorName: null, extractedTreatmentName: null, extractedPhone: null, extractedFullName: null, slotChoiceIndex: null };
  }
}

function findDoctor(ctx: ClinicContext, name: string | null): typeof ctx.doctors[0] | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  return ctx.doctors.find(d => d.fullName.toLowerCase().includes(lower)) ?? null;
}

function findTreatment(ctx: ClinicContext, name: string | null): typeof ctx.treatments[0] | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  return ctx.treatments.find(t => t.name.toLowerCase().includes(lower)) ?? null;
}

async function generateAIResponse(prompt: string): Promise<string> {
  return generateResponse(SYSTEM_PROMPT_BASE, prompt, 200);
}

export async function handleInboundMessage(params: {
  channel: ConvChannel;
  senderId: string;
  senderName: string | null;
  text: string;
  clinicId: string;
  patientId: string | null;
  patientName: string | null;
  currentState: ConvState | null;
  aiEnabled: boolean;
}): Promise<HandleResult> {
  const { channel, text, clinicId, patientId, patientName, currentState, aiEnabled } = params;
  const emptyState: ConvState = { intent: null, step: null };

  if (!aiEnabled) {
    return { response: null, nextState: emptyState };
  }

  const ctx = await loadClinicContext(clinicId);
  const today = todayInZone(ctx.timezone);
  const displayName = patientName ?? 'Pacijent';

  // If patient is unknown, ask them to identify
  if (!patientId) {
    if (currentState?.step === 'awaiting_identification') {
      // Try to match from the message (extract phone)
      const intent = await classifyIntent(text, displayName, currentState, ctx, today);
      if (intent.extractedPhone) {
        const { matchPatientByPhone, linkSocialId } = await import('./patient-matcher');
        const found = await matchPatientByPhone(clinicId, intent.extractedPhone);
        if (found) {
          await linkSocialId(found.id, channel, params.senderId);
          const reply = await generateAIResponse(
            'Pacijent ' + found.fullName + ' se identifikovao. Pozdravi ih i pitaj sta trebaju.'
          );
          return { response: reply, nextState: { intent: 'book', step: 'awaiting_treatment' } };
        }
      }
      const reply = await generateAIResponse(
        'Pacijent nije pronadjen u sistemu po datom broju. Zamoli ih da nazovu kliniku ili daju puno ime i broj telefona.'
      );
      return { response: reply, nextState: emptyState };
    }

    const reply = await generateAIResponse(
      'Novi pacijent je kontaktirao kliniku. Pozdravi ih i zamoli da se identifikuju (ime i prezime te broj telefona) kako bi mogli provjeriti njihov karton.'
    );
    return { response: reply, nextState: { intent: null, step: 'awaiting_identification' } };
  }

  // Patient is known ? classify intent
  const intent = await classifyIntent(text, displayName, currentState, ctx, today);

  // ?? SLOT CHOICE ??????????????????????????????????????????????????????????
  if (currentState?.step === 'awaiting_slot_choice' && intent.slotChoiceIndex != null) {
    const offered = currentState.offeredSlots ?? [];
    const idx = intent.slotChoiceIndex - 1;
    const chosen = offered[idx];
    if (!chosen) {
      return { response: 'Molimo odaberite broj termina sa liste.', nextState: currentState };
    }
    const result = await bookAppointment({
      clinicId, patientId, doctorId: chosen.doctorId,
      treatmentTypeId: currentState.treatmentTypeId,
      durationMin: currentState.durationMin ?? 30,
      date: chosen.date, time: chosen.start,
    });
    if (result.error) {
      return { response: 'Doslo je do greske: ' + result.error + '. Pokusajte ponovo.', nextState: emptyState };
    }
    const reply = await generateAIResponse(
      'Pacijent ' + displayName + ' je potvrdio termin za ' + chosen.date + ' u ' + chosen.start + ' kod dr. ' + chosen.doctorName + '. Napisi kratku potvrdu rezervacije.'
    );
    return { response: reply, nextState: { intent: 'other', step: 'done' }, appointmentCreated: true };
  }

  // ?? CANCELLATION ??????????????????????????????????????????????????????????
  if (intent.intent === 'cancel') {
    const upcoming = await getUpcomingAppointment(clinicId, patientId);
    if (!upcoming) {
      return { response: 'Nismo pronasli aktivne termine za Vas. Ako trebate pomoc, javite nam se.', nextState: emptyState };
    }
    await db.update(appointments)
      .set({ status: 'cancelled', cancelledReason: 'Patient cancelled via ' + channel, updatedAt: new Date() })
      .where(eq(appointments.id, upcoming.id));
    const reply = await generateAIResponse(
      'Pacijent ' + displayName + ' je otkazao termin za ' + upcoming.date + ' u ' + upcoming.time + '. Potvrdi otkazivanje i pozovi ih da zakazu novi termin kada im odgovara.'
    );
    return { response: reply, nextState: emptyState };
  }

  // ?? AVAILABILITY INQUIRY ??????????????????????????????????????????????????
  if (intent.intent === 'availability') {
    const doctor = findDoctor(ctx, intent.extractedDoctorName) ?? ctx.doctors[0];
    if (!doctor) return { response: 'Trenutno nema dostupnih ljekara. Kontaktirajte nas telefonom.', nextState: emptyState };
    const fromDate = intent.extractedDate ?? today;
    const slots = await getNextAvailableSlots(clinicId, doctor.id, fromDate, 30, 5);
    if (slots.length === 0) {
      return { response: 'Nema slobodnih termina kod dr. ' + doctor.fullName + ' u narednih 14 dana.', nextState: emptyState };
    }
    const slotText = slots.map((s, i) => (i + 1) + '. ' + formatSlotTitle(s)).join('\n');
    const reply = await generateAIResponse(
      'Pacijent pita za slobodne termine kod dr. ' + doctor.fullName + '. Slobodni termini:\n' + slotText + '\nNapisi kratku poruku sa terminima i pitaj da li zele zakazati.'
    );
    return { response: reply, nextState: { intent: 'book', step: 'awaiting_time', doctorId: doctor.id, doctorName: doctor.fullName } };
  }

  // ?? BOOKING FLOW ??????????????????????????????????????????????????????????
  // Step: awaiting treatment
  if (currentState?.step === 'awaiting_treatment' || intent.intent === 'book') {
    const treatment = findTreatment(ctx, intent.extractedTreatmentName ?? currentState?.treatmentName ?? null);
    const doctor = findDoctor(ctx, intent.extractedDoctorName ?? currentState?.doctorName ?? null);

    const updatedState: ConvState = {
      intent: 'book',
      step: currentState?.step ?? 'awaiting_treatment',
      treatmentTypeId: treatment?.id ?? currentState?.treatmentTypeId,
      treatmentName: treatment?.name ?? currentState?.treatmentName,
      durationMin: treatment?.durationMin ?? currentState?.durationMin ?? 30,
      doctorId: doctor?.id ?? currentState?.doctorId,
      doctorName: doctor?.fullName ?? currentState?.doctorName,
      requestedDate: intent.extractedDate ?? currentState?.requestedDate,
      requestedTime: intent.extractedTime ?? currentState?.requestedTime,
    };

    // If no treatment yet
    if (!updatedState.treatmentName && currentState?.step !== 'awaiting_doctor' && currentState?.step !== 'awaiting_time') {
      const treatmentList = ctx.treatments.map(t => t.name).join(', ');
      const reply = await generateAIResponse(
        'Pitaj pacijenta ' + displayName + ' za kakav pregled ili tretman dolaze. Dostupni tretmani: ' + treatmentList
      );
      return { response: reply, nextState: { ...updatedState, step: 'awaiting_treatment' } };
    }

    // If no doctor yet
    if (!updatedState.doctorId && currentState?.step !== 'awaiting_time') {
      const docList = ctx.doctors.map(d => d.fullName).join(', ');
      const reply = await generateAIResponse(
        'Pitaj pacijenta ' + displayName + ' kod kojeg ljekara zele doci. Dostupni ljekari: ' + docList + '. Ako nemaju preferenciju, recimo im da cemo dodijeliti prvog slobodnog ljekara.'
      );
      return { response: reply, nextState: { ...updatedState, step: 'awaiting_doctor' } };
    }

    // If doctor preference "any" or auto-assign
    const targetDoctorId = updatedState.doctorId ?? ctx.doctors[0]?.id;
    const targetDoctorName = updatedState.doctorName ?? ctx.doctors[0]?.fullName ?? 'prvog dostupnog ljekara';

    // If we have a requested time, check availability
    if (updatedState.requestedDate && updatedState.requestedTime) {
      return await checkAndBook({ ctx, updatedState, clinicId, patientId, displayName, targetDoctorId: targetDoctorId!, targetDoctorName, today });
    }

    // Ask for preferred time
    const reply = await generateAIResponse(
      'Pitaj pacijenta ' + displayName + ' kada bi mogli doci ? koji dan i u koje vrijeme im odgovara.'
    );
    return { response: reply, nextState: { ...updatedState, step: 'awaiting_time', doctorId: targetDoctorId, doctorName: targetDoctorName } };
  }

  // Awaiting time input
  if (currentState?.step === 'awaiting_time' || currentState?.step === 'awaiting_doctor') {
    const doctor = findDoctor(ctx, intent.extractedDoctorName ?? currentState?.doctorName ?? null);
    const targetDoctorId = doctor?.id ?? currentState?.doctorId ?? ctx.doctors[0]?.id;
    const targetDoctorName = doctor?.fullName ?? currentState?.doctorName ?? ctx.doctors[0]?.fullName ?? 'ljekar';

    const updatedState: ConvState = {
      ...currentState,
      doctorId: targetDoctorId,
      doctorName: targetDoctorName,
      requestedDate: intent.extractedDate ?? currentState?.requestedDate,
      requestedTime: intent.extractedTime ?? currentState?.requestedTime,
    };

    if (updatedState.requestedDate && updatedState.requestedTime) {
      return await checkAndBook({ ctx, updatedState, clinicId, patientId, displayName, targetDoctorId: targetDoctorId!, targetDoctorName, today });
    }

    const reply = await generateAIResponse('Pitaj pacijenta ' + displayName + ' koji datum i vrijeme im odgovara za termin.');
    return { response: reply, nextState: { ...updatedState, step: 'awaiting_time' } };
  }

  // ?? RESCHEDULE FLOW ???????????????????????????????????????????????????????
  if (intent.intent === 'reschedule') {
    const upcoming = await getUpcomingAppointment(clinicId, patientId);
    if (!upcoming) {
      return { response: 'Nismo pronasli aktivne termine za Vas.', nextState: emptyState };
    }
    await db.update(appointments)
      .set({ status: 'cancelled', cancelledReason: 'Reschedule via ' + channel, updatedAt: new Date() })
      .where(eq(appointments.id, upcoming.id));

    const state: ConvState = {
      intent: 'reschedule', step: 'awaiting_time',
      doctorId: upcoming.doctorId, doctorName: upcoming.doctorName,
      treatmentTypeId: upcoming.treatmentTypeId ?? undefined,
      durationMin: 30,
    };
    const reply = await generateAIResponse(
      'Pacijent ' + displayName + ' zeli pomjeriti termin koji je bio ' + upcoming.date + ' u ' + upcoming.time + '. Otkazali smo stari termin. Pitaj kada im odgovara novi termin.'
    );
    return { response: reply, nextState: state };
  }

  // ?? OTHER / FALLBACK ??????????????????????????????????????????????????????
  const reply = await generateAIResponse(
    'Pacijent ' + displayName + ' je poslao poruku: "' + text + '". Odgovori ljubazno i usmjeri ih da zakazu termin ako je relevantno, ili reci im da ce nasze osoblje odgovoriti uskoro za specificna pitanja.'
  );
  return { response: reply, nextState: emptyState };
}

async function checkAndBook(params: {
  ctx: ClinicContext;
  updatedState: ConvState;
  clinicId: string;
  patientId: string;
  displayName: string;
  targetDoctorId: string;
  targetDoctorName: string;
  today: string;
}): Promise<HandleResult> {
  const { ctx, updatedState, clinicId, patientId, displayName, targetDoctorId, targetDoctorName, today } = params;
  const durationMin = updatedState.durationMin ?? 30;
  const requestedDate = updatedState.requestedDate!;
  const requestedTime = updatedState.requestedTime!;

  const daySlots = await getAvailableSlots(clinicId, targetDoctorId, requestedDate, durationMin);
  const isExactAvailable = daySlots.some(s => s.start === requestedTime);

  if (isExactAvailable) {
    const result = await bookAppointment({
      clinicId, patientId, doctorId: targetDoctorId,
      treatmentTypeId: updatedState.treatmentTypeId,
      durationMin, date: requestedDate, time: requestedTime,
    });
    if (result.error) {
      return { response: 'Doslo je do greske. Molimo pokusajte ponovo.', nextState: updatedState };
    }
    const reply = await generateAIResponse(
      'Pacijent ' + displayName + ' je zakazao termin za ' + requestedDate + ' u ' + requestedTime + ' kod dr. ' + targetDoctorName + '. Napisi kratku potvrdu sa svim detaljima.'
    );
    return { response: reply, nextState: { intent: 'other', step: 'done' }, appointmentCreated: true };
  }

  // Not available ? find nearby slots + next available
  const requestedMinutes = parseInt(requestedTime.split(':')[0]) * 60 + parseInt(requestedTime.split(':')[1]);
  const nearbySlots = daySlots
    .map(s => ({ ...s, diff: Math.abs(parseInt(s.start.split(':')[0]) * 60 + parseInt(s.start.split(':')[1]) - requestedMinutes) }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 3);

  const nextDaySlots = await getNextAvailableSlots(clinicId, targetDoctorId, addDays(requestedDate, 1), durationMin, 3);

  const allSlots: Array<{ start: string; end: string; date: string }> = [
    ...nearbySlots.map(s => ({ start: s.start, end: s.end, date: requestedDate })),
    ...nextDaySlots,
  ].slice(0, 5);

  if (allSlots.length === 0) {
    return { response: 'Nema slobodnih termina kod dr. ' + targetDoctorName + ' u narednih 14 dana. Kontaktirajte nas telefonom.', nextState: { ...updatedState, step: null } };
  }

  const offeredSlots = allSlots.map(s => ({ ...s, doctorId: targetDoctorId, doctorName: targetDoctorName }));
  const slotOptions = offeredSlots.map((s, i) => ({
    id: 'slot_' + i,
    title: formatSlotTitle(s),
    description: 'Dr. ' + targetDoctorName,
    payload: 'slot:' + (i + 1),
  }));

  const slotText = offeredSlots.map((s, i) => (i + 1) + '. ' + formatSlotTitle(s)).join('\n');
  const reply = await generateAIResponse(
    'Termin ' + requestedDate + ' u ' + requestedTime + ' nije slobodan. Ponudi pacijentu ' + displayName + ' ove slobodne termine:\n' + slotText + '\nZamoli ih da odaberu broj termina.'
  );
  return {
    response: reply,
    nextState: { ...updatedState, step: 'awaiting_slot_choice', offeredSlots, doctorId: targetDoctorId, doctorName: targetDoctorName },
    slotOptions,
  };
}

async function bookAppointment(params: {
  clinicId: string; patientId: string; doctorId: string;
  treatmentTypeId?: string; durationMin: number; date: string; time: string;
}): Promise<{ error?: string }> {
  try {
    const { getClinicSettings } = await import('@/db/queries/clinics');
    const { timezone } = await getClinicSettings(params.clinicId);
    const startsAt = zonedToUtc(params.date, params.time, timezone);
    if (!startsAt) return { error: 'Invalid date/time' };
    const endsAt = new Date(startsAt.getTime() + params.durationMin * 60000);
    const { checkNoOverlap } = await import('@/lib/availability');
    const overlap = await checkNoOverlap(params.clinicId, params.doctorId, startsAt, endsAt);
    if (overlap.hasOverlap) return { error: 'overlap' };

    await db.insert(appointments).values({
      clinicId: params.clinicId,
      patientId: params.patientId,
      doctorId: params.doctorId,
      treatmentTypeId: params.treatmentTypeId ?? null,
      startsAt, endsAt,
      status: 'confirmed',
      source: 'whatsapp_ai',
      amountPaid: 0,
      paymentStatus: 'pending',
    });
    return {};
  } catch (e) {
    return { error: String(e) };
  }
}

async function getUpcomingAppointment(clinicId: string, patientId: string) {
  const now = new Date();
  const { doctors: doctorsSchema } = await import('@/db/schema');
  const [appt] = await db
    .select({
      id: appointments.id,
      doctorId: appointments.doctorId,
      doctorName: doctorsSchema.fullName,
      treatmentTypeId: appointments.treatmentTypeId,
      date: appointments.startsAt,
    })
    .from(appointments)
    .leftJoin(doctorsSchema, eq(appointments.doctorId, doctorsSchema.id))
    .where(and(
      eq(appointments.clinicId, clinicId),
      eq(appointments.patientId, patientId),
      eq(appointments.status, 'confirmed'),
      gte(appointments.startsAt, now),
    ))
    .orderBy(appointments.startsAt)
    .limit(1);

  if (!appt) return null;
  const { getClinicSettings } = await import('@/db/queries/clinics');
  const { timezone } = await getClinicSettings(clinicId);
  const local = toZonedParts(appt.date, timezone);
  return {
    id: appt.id,
    doctorId: appt.doctorId,
    doctorName: appt.doctorName ?? 'ljekar',
    treatmentTypeId: appt.treatmentTypeId,
    date: local.date,
    time: local.time,
  };
}

function formatSlotTitle(slot: { start: string; end: string; date: string }): string {
  const d = new Date(slot.date + 'T12:00:00');
  const weekdays = ['Ned', 'Pon', 'Uto', 'Sri', 'Cet', 'Pet', 'Sub'];
  return weekdays[d.getDay()] + ' ' + slot.date.slice(8) + '.' + slot.date.slice(5,7) + '. u ' + slot.start;
}
