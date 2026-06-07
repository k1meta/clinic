'use server';

import { z } from 'zod';
import { db } from '@/db';
import { appointments, treatmentTypes } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { checkNoOverlap } from '@/lib/availability';
import { getClinicId } from '@/db/queries/auth';
import { revalidatePath } from 'next/cache';

const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  treatmentTypeId: z.string().uuid().optional(),
  date: z.string().min(1),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  durationMin: z.number().min(5).max(480),
  notes: z.string().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export async function createAppointment(input: CreateAppointmentInput) {
  const clinicId = await getClinicId();

  const parsed = createAppointmentSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
  }

  const { patientId, doctorId, treatmentTypeId, date, time, durationMin, notes } = parsed.data;

  const startsAt = new Date(`${date}T${time}`);
  if (isNaN(startsAt.getTime())) {
    return { error: 'Invalid date or time' };
  }
  const endsAt = new Date(startsAt.getTime() + durationMin * 60000);

  const overlap = await checkNoOverlap(clinicId, doctorId, startsAt, endsAt);
  if (overlap.hasOverlap) {
    return { error: `Termin nije slobodan — postoji preklapanje od ${overlap.conflictStart} do ${overlap.conflictEnd}.` };
  }

  let amountCharged: number | null = null;
  if (treatmentTypeId) {
    const [tt] = await db
      .select({ price: treatmentTypes.price })
      .from(treatmentTypes)
      .where(eq(treatmentTypes.id, treatmentTypeId))
      .limit(1);
    if (tt?.price != null) {
      amountCharged = tt.price;
    }
  }

  try {
    await db.insert(appointments).values({
      clinicId,
      patientId,
      doctorId,
      treatmentTypeId: treatmentTypeId || null,
      startsAt,
      endsAt,
      status: 'confirmed',
      source: 'manual',
      amountCharged,
      amountPaid: 0,
      paymentStatus: 'pending',
      notes: notes || null,
    });
  } catch (e) {
    return { error: 'Failed to create appointment. Please try again.' };
  }

  revalidatePath('/');
  revalidatePath('/calendar');
  return { success: true };
}

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['confirmed', 'arrived', 'completed', 'no_show', 'cancelled']),
  cancelledReason: z.string().optional(),
});

export async function updateAppointmentStatus(id: string, status: string, cancelledReason?: string) {
  const clinicId = await getClinicId();

  const parsed = updateStatusSchema.safeParse({ id, status, cancelledReason });
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  await db
    .update(appointments)
    .set({
      status: parsed.data.status,
      cancelledReason: parsed.data.cancelledReason || null,
      updatedAt: new Date(),
    })
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)));

  if (parsed.data.status === 'completed') {
    try {
      const { scheduleReviewRequestIfEligible } = await import('@/lib/schedule-review-request');
      await scheduleReviewRequestIfEligible({ clinicId, appointmentId: id });
    } catch (e) {
      console.error('[updateAppointmentStatus] scheduleReviewRequestIfEligible:', e);
    }
  }

  revalidatePath('/');
  revalidatePath('/calendar');
  revalidatePath('/patients');
  return { success: true };
}

function derivePaymentStatus(amountCharged: number, amountPaid: number): 'pending' | 'partial' | 'paid' {
  if (amountPaid >= amountCharged) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'pending';
}

export async function recordPayment(appointmentId: string, amount: number) {
  const clinicId = await getClinicId();

  const parsed = z.object({
    appointmentId: z.string().uuid(),
    amount: z.number().int().positive(),
  }).safeParse({ appointmentId, amount });

  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  const [appt] = await db
    .select({
      amountCharged: appointments.amountCharged,
      amountPaid: appointments.amountPaid,
      paymentStatus: appointments.paymentStatus,
    })
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinicId)))
    .limit(1);

  if (!appt || appt.amountCharged == null) {
    return { error: 'Appointment not found or has no charge' };
  }
  if (appt.paymentStatus === 'waived') {
    return { error: 'Cannot record payment on a waived appointment' };
  }

  const remaining = appt.amountCharged - appt.amountPaid;
  if (amount > remaining) {
    return { error: `Amount exceeds remaining balance of ${(remaining / 100).toFixed(2)} BAM` };
  }

  const newAmountPaid = appt.amountPaid + amount;
  const newStatus = derivePaymentStatus(appt.amountCharged, newAmountPaid);

  await db
    .update(appointments)
    .set({
      amountPaid: newAmountPaid,
      paymentStatus: newStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinicId)));

  revalidatePath('/');
  revalidatePath('/calendar');
  revalidatePath('/patients');
  return { success: true };
}

export async function bulkPayBalance(patientId: string, amount: number) {
  const clinicId = await getClinicId();

  const parsed = z.object({
    patientId: z.string().uuid(),
    amount: z.number().int().positive(),
  }).safeParse({ patientId, amount });

  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  const unpaidAppts = await db
    .select({
      id: appointments.id,
      amountCharged: appointments.amountCharged,
      amountPaid: appointments.amountPaid,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.patientId, patientId),
        sql`${appointments.paymentStatus} IN ('pending', 'partial')`,
        sql`${appointments.amountCharged} IS NOT NULL`
      )
    )
    .orderBy(appointments.startsAt);

  if (unpaidAppts.length === 0) {
    return { error: 'No unpaid appointments found' };
  }

  let remaining = amount;

  for (const appt of unpaidAppts) {
    if (remaining <= 0) break;
    const owed = (appt.amountCharged ?? 0) - appt.amountPaid;
    if (owed <= 0) continue;

    const payment = Math.min(remaining, owed);
    const newAmountPaid = appt.amountPaid + payment;
    const newStatus = derivePaymentStatus(appt.amountCharged!, newAmountPaid);

    await db
      .update(appointments)
      .set({
        amountPaid: newAmountPaid,
        paymentStatus: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appt.id));

    remaining -= payment;
  }

  revalidatePath('/');
  revalidatePath('/calendar');
  revalidatePath('/patients');
  return { success: true };
}

export async function waivePayment(appointmentId: string) {
  const clinicId = await getClinicId();

  const parsed = z.object({ appointmentId: z.string().uuid() }).safeParse({ appointmentId });
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  await db
    .update(appointments)
    .set({
      paymentStatus: 'waived',
      updatedAt: new Date(),
    })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinicId)));

  revalidatePath('/');
  revalidatePath('/calendar');
  revalidatePath('/patients');
  return { success: true };
}