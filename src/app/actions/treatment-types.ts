'use server';

import { z } from 'zod';
import { db } from '@/db';
import { treatmentTypes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getClinicId } from '@/db/queries/auth';
import { revalidatePath } from 'next/cache';

const addTreatmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  defaultDurationMin: z.number().min(5, 'Duration must be at least 5 minutes').max(480),
  price: z.number().min(0, 'Price must be 0 or greater').optional(),
});

export type AddTreatmentInput = z.infer<typeof addTreatmentSchema>;

export async function addTreatmentType(input: AddTreatmentInput) {
  const clinicId = await getClinicId();
  const parsed = addTreatmentSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  try {
    await db.insert(treatmentTypes).values({
      clinicId,
      name: parsed.data.name,
      defaultDurationMin: parsed.data.defaultDurationMin,
      price: parsed.data.price != null ? parsed.data.price : null,
    });
  } catch {
    return { error: 'Failed to add treatment. Please try again.' };
  }

  revalidatePath('/settings');
  revalidatePath('/');
  revalidatePath('/calendar');
  return { success: true };
}

export async function deleteTreatmentType(id: string) {
  const clinicId = await getClinicId();

  try {
    await db
      .delete(treatmentTypes)
      .where(and(eq(treatmentTypes.id, id), eq(treatmentTypes.clinicId, clinicId)));
  } catch {
    return { error: 'Failed to delete treatment. It may be referenced by existing appointments.' };
  }

  revalidatePath('/settings');
  revalidatePath('/');
  revalidatePath('/calendar');
  return { success: true };
}

const updatePriceSchema = z.object({
  id: z.string().uuid(),
  price: z.number().min(0).nullable(),
});

export async function updateTreatmentPrice(id: string, price: number | null) {
  const clinicId = await getClinicId();
  const parsed = updatePriceSchema.safeParse({ id, price });

  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  await db
    .update(treatmentTypes)
    .set({ price: parsed.data.price, updatedAt: new Date() })
    .where(and(eq(treatmentTypes.id, id), eq(treatmentTypes.clinicId, clinicId)));

  revalidatePath('/settings');
  revalidatePath('/');
  revalidatePath('/calendar');
  return { success: true };
}