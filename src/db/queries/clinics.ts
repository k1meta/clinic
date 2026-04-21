import { eq } from 'drizzle-orm';
import { db } from '..';
import { clinics } from '../schema';

export type ClinicSettings = {
  workHours: { start: number; end: number };
  aiMessaging: boolean;
  aiCalls: boolean;
  testPhoneNumber: string;
};

const DEFAULT_SETTINGS: ClinicSettings = {
  workHours: { start: 8, end: 17 },
  aiMessaging: false,
  aiCalls: false,
  testPhoneNumber: '',
};

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
  };
}
