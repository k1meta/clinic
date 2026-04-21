import { eq, and } from 'drizzle-orm';
import { db } from '..';
import { doctors } from '../schema';

export async function getDoctorsByClinic(clinicId: string) {
  return db
    .select({ id: doctors.id, fullName: doctors.fullName, specialty: doctors.specialty })
    .from(doctors)
    .where(and(eq(doctors.clinicId, clinicId), eq(doctors.isActive, true)))
    .orderBy(doctors.fullName);
}

export async function getAllDoctorsByClinic(clinicId: string) {
  return db
    .select({
      id: doctors.id,
      fullName: doctors.fullName,
      specialty: doctors.specialty,
      isActive: doctors.isActive,
    })
    .from(doctors)
    .where(eq(doctors.clinicId, clinicId))
    .orderBy(doctors.fullName);
}

export async function getDoctorById(id: string) {
  const [doctor] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
  return doctor ?? null;
}