import { eq } from 'drizzle-orm';
import { db } from '..';
import { clinics } from '../schema';
import type { BusinessVertical } from '@/lib/verticals';
import { isBusinessVertical } from '@/lib/verticals';
import { DEFAULT_TIMEZONE, safeTimezone } from '@/lib/timezone';
import { resolveWeekHours, weekEnvelope, type WeekHours } from '@/lib/work-week';

export type ClinicSettings = {
  /** Opening hours per weekday; the source of truth for bookings. */
  weekHours: WeekHours;
  /** Earliest opening and latest closing of the week, for the calendar grid. */
  workHours: { start: number; end: number };
  aiMessaging: boolean;
  aiCalls: boolean;
  testPhoneNumber: string;
  /** Google Maps / Business Profile review link for first-visit WhatsApp prompts. */
  googleReviewUrl: string;
  vertical: BusinessVertical;
  /** IANA timezone from `clinics.timezone`; every appointment time is shown in it. */
  timezone: string;
};

const DEFAULT_HOURS = { start: 8, end: 17 };

const DEFAULT_SETTINGS: ClinicSettings = {
  weekHours: resolveWeekHours(undefined, DEFAULT_HOURS),
  workHours: DEFAULT_HOURS,
  aiMessaging: false,
  aiCalls: false,
  testPhoneNumber: '',
  googleReviewUrl: '',
  vertical: 'dental',
  timezone: DEFAULT_TIMEZONE,
};

export async function getClinicSettings(clinicId: string): Promise<ClinicSettings> {
  const [clinic] = await db
    .select({ settings: clinics.settings, timezone: clinics.timezone })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  const timezone = safeTimezone(clinic?.timezone);
  if (!clinic?.settings || typeof clinic.settings !== 'object') {
    return { ...DEFAULT_SETTINGS, timezone };
  }

  const raw = clinic.settings as Record<string, unknown>;
  const wh = raw.workHours as { start?: number; end?: number } | undefined;
  const legacyHours = {
    start: typeof wh?.start === 'number' ? wh.start : DEFAULT_HOURS.start,
    end: typeof wh?.end === 'number' ? wh.end : DEFAULT_HOURS.end,
  };
  const weekHours = resolveWeekHours(raw.weekHours, legacyHours);

  return {
    weekHours,
    workHours: weekEnvelope(weekHours, legacyHours),
    aiMessaging: typeof raw.aiMessaging === 'boolean' ? raw.aiMessaging : DEFAULT_SETTINGS.aiMessaging,
    aiCalls: typeof raw.aiCalls === 'boolean' ? raw.aiCalls : DEFAULT_SETTINGS.aiCalls,
    testPhoneNumber: typeof raw.testPhoneNumber === 'string' ? raw.testPhoneNumber : DEFAULT_SETTINGS.testPhoneNumber,
    googleReviewUrl: typeof raw.googleReviewUrl === 'string' ? raw.googleReviewUrl : DEFAULT_SETTINGS.googleReviewUrl,
    vertical: isBusinessVertical(raw.vertical as string) ? (raw.vertical as BusinessVertical) : DEFAULT_SETTINGS.vertical,
    timezone,
  };
}
