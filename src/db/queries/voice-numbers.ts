import { and, eq } from 'drizzle-orm';
import { db } from '..';
import { voiceNumbers } from '../schema';

export async function findClinicIdByVoiceNumber(e164: string): Promise<string | null> {
  const [row] = await db
    .select({ clinicId: voiceNumbers.clinicId })
    .from(voiceNumbers)
    .where(and(eq(voiceNumbers.e164, e164), eq(voiceNumbers.isActive, true)))
    .limit(1);
  return row?.clinicId ?? null;
}

export async function getVoiceNumbersByClinic(clinicId: string) {
  return db
    .select({ id: voiceNumbers.id, e164: voiceNumbers.e164, provider: voiceNumbers.provider, isActive: voiceNumbers.isActive })
    .from(voiceNumbers)
    .where(eq(voiceNumbers.clinicId, clinicId))
    .orderBy(voiceNumbers.createdAt);
}
