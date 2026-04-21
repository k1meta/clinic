'use server';

import { z } from 'zod';
import { db } from '@/db';
import { doctors } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getClinicId } from '@/db/queries/auth';
import { revalidatePath } from 'next/cache';

const addDoctorSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  specialty: z.string().min(2, 'Specialty must be at least 2 characters'),
});

export type AddDoctorInput = z.infer<typeof addDoctorSchema>;

export async function addDoctor(input: AddDoctorInput) {
  const clinicId = await getClinicId();
  const parsed = addDoctorSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  try {
    await db.insert(doctors).values({
      clinicId,
      fullName: parsed.data.fullName,
      specialty: parsed.data.specialty,
    });
  } catch {
    return { error: 'Failed to add doctor. Please try again.' };
  }

  revalidatePath('/settings');
  revalidatePath('/');
  revalidatePath('/calendar');
  return { success: true };
}

export async function deleteDoctor(id: string) {
  const clinicId = await getClinicId();

  try {
    await db
      .update(doctors)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(doctors.id, id), eq(doctors.clinicId, clinicId)));
  } catch {
    return { error: 'Failed to remove doctor.' };
  }

  revalidatePath('/settings');
  revalidatePath('/');
  revalidatePath('/calendar');
  return { success: true };
}

export async function restoreDoctor(id: string) {
  const clinicId = await getClinicId();

  try {
    await db
      .update(doctors)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(doctors.id, id), eq(doctors.clinicId, clinicId)));
  } catch {
    return { error: 'Failed to restore doctor.' };
  }

  revalidatePath('/settings');
  revalidatePath('/');
  revalidatePath('/calendar');
  return { success: true };
}