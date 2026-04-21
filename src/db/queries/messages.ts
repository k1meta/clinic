import { db } from '..';
import { messages, patients } from '../schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';

export async function getConversationList(clinicId: string) {
  const rows = await db
    .select({
      patientId: messages.patientId,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      lastContent: sql<string>`(
        SELECT content FROM messages m2
        WHERE m2.patient_id = ${messages.patientId}
          AND m2.clinic_id = ${clinicId}
        ORDER BY m2.created_at DESC LIMIT 1
      )`,
      lastChannel: sql<string>`(
        SELECT channel FROM messages m2
        WHERE m2.patient_id = ${messages.patientId}
          AND m2.clinic_id = ${clinicId}
        ORDER BY m2.created_at DESC LIMIT 1
      )`,
      lastAt: sql<string>`(
        SELECT created_at FROM messages m2
        WHERE m2.patient_id = ${messages.patientId}
          AND m2.clinic_id = ${clinicId}
        ORDER BY m2.created_at DESC LIMIT 1
      )`,
      unreadCount: sql<number>`(
        SELECT COUNT(*)::int FROM messages m2
        WHERE m2.patient_id = ${messages.patientId}
          AND m2.clinic_id = ${clinicId}
          AND m2.direction = 'inbound'
          AND m2.read_by_staff = false
      )`,
    })
    .from(messages)
    .innerJoin(patients, eq(messages.patientId, patients.id))
    .where(eq(messages.clinicId, clinicId))
    .groupBy(messages.patientId, patients.fullName, patients.phone)
    .orderBy(desc(sql`MAX(${messages.createdAt})`));

  return rows;
}

export async function getPatientMessages(
  clinicId: string,
  patientId: string,
  limit: number = 50,
  offset: number = 0,
) {
  return db
    .select({
      id: messages.id,
      channel: messages.channel,
      direction: messages.direction,
      type: messages.type,
      status: messages.status,
      content: messages.content,
      readByStaff: messages.readByStaff,
      createdAt: sql<string>`${messages.createdAt}::text`,
    })
    .from(messages)
    .where(and(eq(messages.clinicId, clinicId), eq(messages.patientId, patientId)))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getUnreadCount(clinicId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.clinicId, clinicId),
        eq(messages.direction, 'inbound'),
        eq(messages.readByStaff, false),
      ),
    );
  return row?.count ?? 0;
}

export async function markThreadRead(clinicId: string, patientId: string) {
  await db
    .update(messages)
    .set({ readByStaff: true, updatedAt: new Date() })
    .where(
      and(
        eq(messages.clinicId, clinicId),
        eq(messages.patientId, patientId),
        eq(messages.direction, 'inbound'),
        eq(messages.readByStaff, false),
      ),
    );
}
