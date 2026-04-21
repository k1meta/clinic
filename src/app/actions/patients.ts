'use server';

import { z } from 'zod';
import { db } from '@/db';
import { patients } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getClinicId } from '@/db/queries/auth';
import { revalidatePath } from 'next/cache';

const createPatientSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(200),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  dob: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  notes: z.string().optional(),
});

export async function createPatient(formData: FormData) {
  const clinicId = await getClinicId();

  const parsed = createPatientSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    dob: formData.get('dob') || undefined,
    gender: formData.get('gender') || undefined,
    address: formData.get('address') || undefined,
    emergencyContact: formData.get('emergencyContact') || undefined,
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  const data = parsed.data;

  await db.insert(patients).values({
    clinicId,
    fullName: data.fullName,
    phone: data.phone || null,
    email: data.email || null,
    dob: data.dob || null,
    gender: data.gender || null,
    address: data.address || null,
    emergencyContact: data.emergencyContact || null,
    notes: data.notes || null,
    status: 'new',
  });

  revalidatePath('/patients');
  revalidatePath('/');
  return { success: true };
}

const updatePatientSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1).max(200),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  dob: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['new', 'active', 'inactive']).optional(),
});

export async function updatePatient(id: string, formData: FormData) {
  const clinicId = await getClinicId();

  const parsed = updatePatientSchema.safeParse({
    id,
    fullName: formData.get('fullName'),
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    dob: formData.get('dob') || undefined,
    gender: formData.get('gender') || undefined,
    address: formData.get('address') || undefined,
    emergencyContact: formData.get('emergencyContact') || undefined,
    notes: formData.get('notes') || undefined,
    status: formData.get('status') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }

  const { id: patientId, ...data } = parsed.data;

  await db
    .update(patients)
    .set({
      ...data,
      phone: data.phone || null,
      email: data.email || null,
      dob: data.dob || null,
      gender: data.gender || null,
      address: data.address || null,
      emergencyContact: data.emergencyContact || null,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)));

  revalidatePath('/patients');
  return { success: true };
}