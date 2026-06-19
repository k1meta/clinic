'use server';

import { z } from 'zod';
import { db } from '@/db';
import { waitingList } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/db/queries/auth';
import { revalidatePath } from 'next/cache';

const optionalUuid = z.string().uuid().optional().or(z.literal(''));
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional()
  .or(z.literal(''));

const addSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  treatmentTypeId: optionalUuid,
  doctorId: optionalUuid,
  preferredFrom: optionalDate,
  preferredTo: optionalDate,
  note: z.string().max(500).optional(),
});

export type AddWaitlistInput = z.infer<typeof addSchema>;

export async function addToWaitlist(input: AddWaitlistInput) {
  const { clinicId } = await requireAuth();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(', ') };
  }
  const d = parsed.data;

  await db.insert(waitingList).values({
    clinicId,
    patientId: d.patientId,
    treatmentTypeId: d.treatmentTypeId ? d.treatmentTypeId : null,
    doctorId: d.doctorId ? d.doctorId : null,
    preferredFrom: d.preferredFrom ? d.preferredFrom : null,
    preferredTo: d.preferredTo ? d.preferredTo : null,
    note: d.note?.trim() || null,
  });

  revalidatePath('/calendar');
  return { success: true };
}

export async function removeFromWaitlist(id: string) {
  const { clinicId } = await requireAuth();
  if (!z.string().uuid().safeParse(id).success) {
    return { error: 'Invalid id' };
  }

  await db
    .update(waitingList)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(eq(waitingList.id, id), eq(waitingList.clinicId, clinicId)));

  revalidatePath('/calendar');
  return { success: true };
}
