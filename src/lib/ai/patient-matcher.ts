import { db } from '@/db';
import { patients } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

export interface MatchedPatient {
  id: string;
  clinicId: string;
  fullName: string;
  phone: string | null;
}

/** Find patient in clinic by their social media sender ID. */
export async function matchPatientBySocialId(
  clinicId: string,
  channel: 'whatsapp' | 'instagram' | 'messenger',
  senderId: string,
): Promise<MatchedPatient | null> {
  const col = channel === 'instagram' ? patients.instagramId
            : channel === 'messenger' ? patients.messengerId
            : patients.whatsappId;

  const [p] = await db
    .select({ id: patients.id, clinicId: patients.clinicId, fullName: patients.fullName, phone: patients.phone })
    .from(patients)
    .where(and(eq(patients.clinicId, clinicId), eq(col, senderId)))
    .limit(1);

  return p ?? null;
}

/** Find patient by phone number (normalized to E.164-ish). */
export async function matchPatientByPhone(
  clinicId: string,
  rawPhone: string,
): Promise<MatchedPatient | null> {
  const normalized = rawPhone.replace(/[\s\-\(\)]/g, '');
  const withPlus = normalized.startsWith('+') ? normalized : '+' + normalized;
  const withoutPlus = normalized.startsWith('+') ? normalized.slice(1) : normalized;
  const [p] = await db
    .select({ id: patients.id, clinicId: patients.clinicId, fullName: patients.fullName, phone: patients.phone })
    .from(patients)
    .where(and(eq(patients.clinicId, clinicId), or(eq(patients.phone, withPlus), eq(patients.phone, withoutPlus))))
    .limit(1);
  return p ?? null;
}

/** For WhatsApp: match by phone directly (the 'from' field IS the phone number). */
export async function matchWhatsAppPatient(
  clinicId: string,
  phone: string,
): Promise<MatchedPatient | null> {
  // Meta sends phone without '+' (e.g. "38761809331"), DB stores with '+' ("+38761809331")
  const withPlus = phone.startsWith('+') ? phone : '+' + phone;
  const withoutPlus = phone.startsWith('+') ? phone.slice(1) : phone;
  const [p] = await db
    .select({ id: patients.id, clinicId: patients.clinicId, fullName: patients.fullName, phone: patients.phone })
    .from(patients)
    .where(and(eq(patients.clinicId, clinicId), or(eq(patients.phone, withPlus), eq(patients.phone, withoutPlus))))
    .limit(1);
  return p ?? null;
}

/** Link a social sender ID to a patient record. */
export async function linkSocialId(
  patientId: string,
  channel: 'whatsapp' | 'instagram' | 'messenger',
  senderId: string,
): Promise<void> {
  const update = channel === 'instagram' ? { instagramId: senderId }
               : channel === 'messenger' ? { messengerId: senderId }
               : { whatsappId: senderId };
  await db.update(patients).set({ ...update, updatedAt: new Date() }).where(eq(patients.id, patientId));
}
