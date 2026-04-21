import { eq } from 'drizzle-orm';
import { db } from '..';
import { treatmentTypes } from '../schema';

export async function getTreatmentTypesByClinic(clinicId: string) {
  return db
    .select({ id: treatmentTypes.id, name: treatmentTypes.name, defaultDurationMin: treatmentTypes.defaultDurationMin, price: treatmentTypes.price })
    .from(treatmentTypes)
    .where(eq(treatmentTypes.clinicId, clinicId))
    .orderBy(treatmentTypes.name);
}

export async function getAllTreatmentTypesByClinic(clinicId: string) {
  return db
    .select({
      id: treatmentTypes.id,
      name: treatmentTypes.name,
      defaultDurationMin: treatmentTypes.defaultDurationMin,
      price: treatmentTypes.price,
    })
    .from(treatmentTypes)
    .where(eq(treatmentTypes.clinicId, clinicId))
    .orderBy(treatmentTypes.name);
}