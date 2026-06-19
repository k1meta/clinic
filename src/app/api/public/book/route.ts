import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { appointments, doctors, treatmentTypes } from '@/db/schema';
import { getClinicBySlug } from '@/db/queries/clinics';
import { checkNoOverlap } from '@/lib/availability';
import { findOrCreatePatientByPhone } from '@/lib/voice/booking-service';
import { rateLimit } from '@/lib/rate-limit';

const bodySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(2).max(120),
  phone: z.string().min(6).max(30),
  treatmentTypeId: z.string().uuid().optional().or(z.literal('')),
  doctorId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  ref: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(', ') }, { status: 400 });
  }
  const d = parsed.data;

  const clinic = await getClinicBySlug(d.slug);
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const rl = await rateLimit('book:' + clinic.id + ':' + ip, 8, 600);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please call the clinic.' }, { status: 429 });
  }

  const [doctor] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(and(eq(doctors.id, d.doctorId), eq(doctors.clinicId, clinic.id), eq(doctors.isActive, true)))
    .limit(1);
  if (!doctor) return NextResponse.json({ error: 'Invalid doctor' }, { status: 400 });

  let durationMin = 30;
  let amountCharged: number | null = null;
  let treatmentTypeId: string | null = null;
  if (d.treatmentTypeId) {
    const [t] = await db
      .select({ id: treatmentTypes.id, dur: treatmentTypes.defaultDurationMin, price: treatmentTypes.price })
      .from(treatmentTypes)
      .where(and(eq(treatmentTypes.id, d.treatmentTypeId), eq(treatmentTypes.clinicId, clinic.id)))
      .limit(1);
    if (t) {
      durationMin = t.dur ?? 30;
      amountCharged = t.price ?? null;
      treatmentTypeId = t.id;
    }
  }

  const startsAt = new Date(d.date + 'T' + d.time);
  if (isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: 'Invalid date/time' }, { status: 400 });
  }
  if (startsAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'That time has already passed.' }, { status: 400 });
  }
  const endsAt = new Date(startsAt.getTime() + durationMin * 60000);

  const overlap = await checkNoOverlap(clinic.id, d.doctorId, startsAt, endsAt);
  if (overlap.hasOverlap) {
    return NextResponse.json({ error: 'That slot was just taken. Please pick another time.' }, { status: 409 });
  }

  const patient = await findOrCreatePatientByPhone({ clinicId: clinic.id, phone: d.phone, fullName: d.name });

  const [created] = await db
    .insert(appointments)
    .values({
      clinicId: clinic.id,
      patientId: patient.id,
      doctorId: d.doctorId,
      treatmentTypeId,
      startsAt,
      endsAt,
      status: 'confirmed',
      source: 'online',
      amountCharged,
      amountPaid: 0,
      paymentStatus: 'pending',
      notes: 'Online booking',
    })
    .returning({ id: appointments.id });

  try {
    const { schedule48hReminderIfEligible } = await import('@/lib/schedule-48h-reminder');
    const { schedule2hReminderIfEligible } = await import('@/lib/schedule-2h-reminder');
    await Promise.all([
      schedule48hReminderIfEligible({ clinicId: clinic.id, appointmentId: created.id }),
      schedule2hReminderIfEligible({ clinicId: clinic.id, appointmentId: created.id }),
    ]);
  } catch (e) {
    console.error('[public/book] reminders:', e);
  }

  if (d.ref) {
    try {
      const { claimReferral } = await import('@/lib/referrals/claim');
      await claimReferral({ clinicId: clinic.id, code: d.ref, referredPatientId: patient.id });
    } catch (e) {
      console.error('[public/book] referral:', e);
    }
  }

  return NextResponse.json({ success: true, date: d.date, time: d.time });
}
