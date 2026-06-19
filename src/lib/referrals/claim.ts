import { db } from '@/db';
import { patients, referrals } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Record a successful referral when a new patient books with a referrer's code.
 * Idempotent per referred patient; ignores self-referral or unknown codes.
 */
export async function claimReferral(params: {
  clinicId: string;
  code: string;
  referredPatientId: string;
}): Promise<void> {
  const code = params.code.trim().toUpperCase();
  if (!code) return;

  const [referrer] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.clinicId, params.clinicId), eq(patients.referralCode, code)))
    .limit(1);

  if (!referrer || referrer.id === params.referredPatientId) return;

  const [existing] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(and(eq(referrals.clinicId, params.clinicId), eq(referrals.referredPatientId, params.referredPatientId)))
    .limit(1);

  if (existing) return;

  await db.insert(referrals).values({
    clinicId: params.clinicId,
    referrerPatientId: referrer.id,
    referredPatientId: params.referredPatientId,
    code,
    status: 'completed',
  });
}
