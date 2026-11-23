import { findClinicIdByVoiceNumber } from '@/db/queries/voice-numbers';

type Lookup = (e164: string) => Promise<string | null>;

/**
 * The called number decides the clinic. Outside production, browser tests and
 * unregistered test numbers fall back to DEFAULT_CLINIC_ID.
 */
export async function resolveClinicId(
  calledNumber: string | null,
  lookup: Lookup = findClinicIdByVoiceNumber,
  env: { NODE_ENV?: string; DEFAULT_CLINIC_ID?: string } = process.env,
): Promise<string | null> {
  const clinicId = calledNumber ? await lookup(calledNumber) : null;
  if (clinicId) return clinicId;
  if (env.NODE_ENV === 'production') return null;
  return env.DEFAULT_CLINIC_ID || null;
}
