import { db } from '@/db';
import { waitingList, patients, treatmentTypes, doctors } from '@/db/schema';
import { and, eq, sql, desc } from 'drizzle-orm';

export type WaitlistEntry = {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  treatmentTypeId: string | null;
  treatmentName: string | null;
  doctorId: string | null;
  doctorName: string | null;
  preferredFrom: string | null;
  preferredTo: string | null;
  note: string | null;
  status: string;
  createdAt: Date;
};

/** Active + already-notified entries, newest first, for the calendar sidebar. */
export async function getActiveWaitlist(clinicId: string): Promise<WaitlistEntry[]> {
  const rows = await db
    .select({
      id: waitingList.id,
      patientId: waitingList.patientId,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      treatmentTypeId: waitingList.treatmentTypeId,
      treatmentName: treatmentTypes.name,
      doctorId: waitingList.doctorId,
      doctorName: doctors.fullName,
      preferredFrom: waitingList.preferredFrom,
      preferredTo: waitingList.preferredTo,
      note: waitingList.note,
      status: waitingList.status,
      createdAt: waitingList.createdAt,
    })
    .from(waitingList)
    .innerJoin(patients, eq(waitingList.patientId, patients.id))
    .leftJoin(treatmentTypes, eq(waitingList.treatmentTypeId, treatmentTypes.id))
    .leftJoin(doctors, eq(waitingList.doctorId, doctors.id))
    .where(and(eq(waitingList.clinicId, clinicId), sql`${waitingList.status} in ('active','notified')`))
    .orderBy(desc(waitingList.createdAt));

  return rows as WaitlistEntry[];
}

/** Active entries whose preferences match a freed slot (treatment + date window). */
export async function getMatchingWaitlist(
  clinicId: string,
  treatmentTypeId: string | null,
  dateStr: string,
): Promise<{ id: string; patientId: string }[]> {
  const conditions = [
    eq(waitingList.clinicId, clinicId),
    eq(waitingList.status, 'active'),
    sql`(${waitingList.preferredFrom} is null or ${waitingList.preferredFrom} <= ${dateStr})`,
    sql`(${waitingList.preferredTo} is null or ${waitingList.preferredTo} >= ${dateStr})`,
  ];

  if (treatmentTypeId) {
    conditions.push(
      sql`(${waitingList.treatmentTypeId} is null or ${waitingList.treatmentTypeId} = ${treatmentTypeId})`,
    );
  }

  return db
    .select({ id: waitingList.id, patientId: waitingList.patientId })
    .from(waitingList)
    .where(and(...conditions))
    .orderBy(waitingList.createdAt);
}
