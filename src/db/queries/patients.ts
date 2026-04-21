import { eq, and, or, ilike, count, gte, sql } from 'drizzle-orm';
import { db } from '..';
import { patients } from '../schema';

export async function getPatientsByClinic(
  clinicId: string,
  opts: { search?: string; status?: string; page?: number; limit?: number } = {}
) {
  const { search, status, page = 1, limit = 20 } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(patients.clinicId, clinicId)];

  if (status && ['new', 'active', 'inactive'].includes(status)) {
    conditions.push(eq(patients.status, status as 'new' | 'active' | 'inactive'));
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(patients.fullName, pattern),
        ilike(patients.phone, pattern),
        ilike(patients.email, pattern)
      )!
    );
  }

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(patients).where(where).orderBy(patients.fullName).limit(limit).offset(offset),
    db.select({ total: count() }).from(patients).where(where),
  ]);

  return { patients: rows, total, page, limit };
}

export async function getPatientCount(clinicId: string) {
  const [{ total }] = await db.select({ total: count() }).from(patients).where(eq(patients.clinicId, clinicId));
  return total;
}

export async function getNewPatientCountThisMonth(clinicId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ total }] = await db
    .select({ total: count() })
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, clinicId),
        eq(patients.status, 'new'),
        gte(patients.createdAt, startOfMonth)
      )
    );
  return total;
}

export async function getAllPatients(clinicId: string) {
  return db
    .select({ id: patients.id, fullName: patients.fullName })
    .from(patients)
    .where(eq(patients.clinicId, clinicId))
    .orderBy(patients.fullName);
}

export async function getPatientById(id: string) {
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id))
    .limit(1);
  return patient ?? null;
}