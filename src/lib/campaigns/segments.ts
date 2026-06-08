import { db } from '@/db';
import { patients, appointments } from '@/db/schema';
import { and, eq, isNull, sql, inArray } from 'drizzle-orm';

export type SegmentFilter = {
  /** inactive_days: no completed appointment in N days */
  inactiveDays?: number;
  /** status: patient status filter */
  status?: 'new' | 'active' | 'inactive';
  /** has_email: only patients with email */
  hasEmail?: boolean;
  /** has_phone: only patients with phone */
  hasPhone?: boolean;
  /** birthday_month: 1-12 */
  birthdayMonth?: number;
};

export async function resolveSegmentPatients(
  clinicId: string,
  filter: SegmentFilter,
): Promise<{ id: string; fullName: string; phone: string | null; email: string | null }[]> {
  const conditions = [
    eq(patients.clinicId, clinicId),
    isNull(patients.optOutAt),
  ];

  if (filter.status) {
    conditions.push(eq(patients.status, filter.status));
  }
  if (filter.hasEmail) {
    conditions.push(sql`${patients.email} IS NOT NULL AND ${patients.email} != ''`);
  }
  if (filter.hasPhone) {
    conditions.push(sql`${patients.phone} IS NOT NULL AND ${patients.phone} != ''`);
  }
  if (filter.birthdayMonth && filter.birthdayMonth >= 1 && filter.birthdayMonth <= 12) {
    conditions.push(sql`EXTRACT(MONTH FROM ${patients.dob}) = ${filter.birthdayMonth}`);
  }

  let rows = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      phone: patients.phone,
      email: patients.email,
    })
    .from(patients)
    .where(and(...conditions));

  if (filter.inactiveDays && filter.inactiveDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filter.inactiveDays);

    const activePatientIds = await db
      .select({ patientId: appointments.patientId })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.status, 'completed'),
          sql`${appointments.endsAt} >= ${cutoff.toISOString()}`,
        ),
      );

    const activeSet = new Set(activePatientIds.map((r) => r.patientId));
    rows = rows.filter((r) => !activeSet.has(r.id));
  }

  return rows;
}

export function parseSegmentFilter(raw: unknown): SegmentFilter {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    inactiveDays: typeof o.inactiveDays === 'number' ? o.inactiveDays : undefined,
    status: o.status === 'new' || o.status === 'active' || o.status === 'inactive' ? o.status : undefined,
    hasEmail: o.hasEmail === true,
    hasPhone: o.hasPhone === true,
    birthdayMonth: typeof o.birthdayMonth === 'number' ? o.birthdayMonth : undefined,
  };
}
