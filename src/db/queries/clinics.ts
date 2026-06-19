import { eq } from 'drizzle-orm';
import { db } from '..';
import { clinics } from '../schema';
import type { BusinessVertical } from '@/lib/verticals';
import { isBusinessVertical } from '@/lib/verticals';

export type PaymentGateway = 'none' | 'monri' | 'wspay';

export type ClinicSettings = {
  workHours: { start: number; end: number };
  aiMessaging: boolean;
  aiCalls: boolean;
  testPhoneNumber: string;
  /** Google Maps / Business Profile review link for first-visit WhatsApp prompts. */
  googleReviewUrl: string;
  vertical: BusinessVertical;
  /** Baseline no-show rate (0..1) used for the ROI "cost avoided" estimate. */
  noShowBaseline: number;
  /** Deposits are opt-in. When false, payments are tracked manually (cash). */
  depositEnabled: boolean;
  /** Suggested deposit amount in minor units (BAM*100). */
  depositAmount: number;
  /** Online card gateway; 'none' = cash / manual mark-paid (default). */
  paymentGateway: PaymentGateway;
};

const DEFAULT_SETTINGS: ClinicSettings = {
  workHours: { start: 8, end: 17 },
  aiMessaging: false,
  aiCalls: false,
  testPhoneNumber: '',
  googleReviewUrl: '',
  vertical: 'dental',
  noShowBaseline: 0.2,
  depositEnabled: false,
  depositAmount: 0,
  paymentGateway: 'none',
};

export async function getClinicBySlug(slug: string) {
  const [clinic] = await db
    .select({ id: clinics.id, name: clinics.name, slug: clinics.slug })
    .from(clinics)
    .where(eq(clinics.slug, slug))
    .limit(1);
  return clinic ?? null;
}

export async function getClinicSettings(clinicId: string): Promise<ClinicSettings> {
  const [clinic] = await db
    .select({ settings: clinics.settings })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  if (!clinic?.settings || typeof clinic.settings !== 'object') {
    return DEFAULT_SETTINGS;
  }

  const raw = clinic.settings as Record<string, unknown>;
  const wh = raw.workHours as { start?: number; end?: number } | undefined;

  return {
    workHours: {
      start: typeof wh?.start === 'number' ? wh.start : DEFAULT_SETTINGS.workHours.start,
      end: typeof wh?.end === 'number' ? wh.end : DEFAULT_SETTINGS.workHours.end,
    },
    aiMessaging: typeof raw.aiMessaging === 'boolean' ? raw.aiMessaging : DEFAULT_SETTINGS.aiMessaging,
    aiCalls: typeof raw.aiCalls === 'boolean' ? raw.aiCalls : DEFAULT_SETTINGS.aiCalls,
    testPhoneNumber: typeof raw.testPhoneNumber === 'string' ? raw.testPhoneNumber : DEFAULT_SETTINGS.testPhoneNumber,
    googleReviewUrl: typeof raw.googleReviewUrl === 'string' ? raw.googleReviewUrl : DEFAULT_SETTINGS.googleReviewUrl,
    vertical: isBusinessVertical(raw.vertical as string) ? (raw.vertical as BusinessVertical) : DEFAULT_SETTINGS.vertical,
    noShowBaseline:
      typeof raw.noShowBaseline === 'number' && raw.noShowBaseline >= 0 && raw.noShowBaseline <= 1
        ? raw.noShowBaseline
        : DEFAULT_SETTINGS.noShowBaseline,
    depositEnabled: typeof raw.depositEnabled === 'boolean' ? raw.depositEnabled : DEFAULT_SETTINGS.depositEnabled,
    depositAmount:
      typeof raw.depositAmount === 'number' && raw.depositAmount >= 0
        ? raw.depositAmount
        : DEFAULT_SETTINGS.depositAmount,
    paymentGateway:
      raw.paymentGateway === 'monri' || raw.paymentGateway === 'wspay'
        ? raw.paymentGateway
        : DEFAULT_SETTINGS.paymentGateway,
  };
}
