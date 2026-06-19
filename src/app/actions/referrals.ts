'use server';

import { db } from '@/db';
import { patients, clinics } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/db/queries/auth';

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Get (or lazily create) a patient's referral share link. */
export async function getReferralLink(patientId: string) {
  const { clinicId } = await requireAuth();

  const [p] = await db
    .select({ id: patients.id, referralCode: patients.referralCode })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))
    .limit(1);

  if (!p) return { error: 'Patient not found' };

  let code = p.referralCode;
  if (!code) {
    for (let i = 0; i < 5 && !code; i++) {
      const candidate = genCode();
      try {
        await db
          .update(patients)
          .set({ referralCode: candidate, updatedAt: new Date() })
          .where(eq(patients.id, patientId));
        code = candidate;
      } catch {
        // unique collision — retry with a new candidate
      }
    }
  }

  if (!code) return { error: 'Could not generate code' };

  const [clinic] = await db
    .select({ slug: clinics.slug })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const url = `${base}/book/${clinic?.slug ?? ''}?ref=${code}`;
  return { success: true as const, url, code };
}
