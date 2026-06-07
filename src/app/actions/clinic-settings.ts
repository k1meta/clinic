'use server';

import { z } from 'zod';
import { db } from '@/db';
import { clinics } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/db/queries/auth';
import { revalidatePath } from 'next/cache';

const workHoursSchema = z.object({
  start: z.number().int().min(0).max(23),
  end: z.number().int().min(0).max(23),
}).refine(d => d.end > d.start, { message: 'End hour must be after start hour' });

async function readClinicSettings(clinicId: string): Promise<Record<string, unknown>> {
  const [clinic] = await db
    .select({ settings: clinics.settings })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);
  return (clinic?.settings && typeof clinic.settings === 'object') ? clinic.settings as Record<string, unknown> : {};
}

async function writeClinicSettings(clinicId: string, patch: Record<string, unknown>) {
  const current = await readClinicSettings(clinicId);
  await db
    .update(clinics)
    .set({ settings: { ...current, ...patch }, updatedAt: new Date() })
    .where(eq(clinics.id, clinicId));
}

export async function updateWorkHours(input: { start: number; end: number }) {
  const { clinicId } = await requireAdmin();
  const parsed = workHoursSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }
  await writeClinicSettings(clinicId, { workHours: parsed.data });
  revalidatePath('/settings');
  revalidatePath('/calendar');
  revalidatePath('/');
  return { success: true };
}

const aiSettingsSchema = z.object({
  aiMessaging: z.boolean(),
  aiCalls: z.boolean(),
});

export async function updateAiSettings(input: { aiMessaging: boolean; aiCalls: boolean }) {
  const { clinicId } = await requireAdmin();
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };
  await writeClinicSettings(clinicId, { aiMessaging: parsed.data.aiMessaging, aiCalls: parsed.data.aiCalls });
  revalidatePath('/settings');
  revalidatePath('/voice-ai');
  return { success: true };
}

const phoneSchema = z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (e.g. +38761123456)');

const googleReviewUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (s) => s === '' || /^https:\/\/.+/i.test(s.trim()),
    'URL must be empty or start with https://',
  );

export async function updateGoogleReviewUrl(input: { url: string }) {
  const { clinicId } = await requireAdmin();
  const parsed = googleReviewUrlSchema.safeParse(input.url.trim());
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => e.message).join(', ') };
  }
  await writeClinicSettings(clinicId, { googleReviewUrl: parsed.data });
  revalidatePath('/settings');
  return { success: true };
}

export async function updateTestPhone(input: { phone: string }) {
  const { clinicId } = await requireAdmin();
  if (input.phone === '') {
    await writeClinicSettings(clinicId, { testPhoneNumber: '' });
    revalidatePath('/settings');
    return { success: true };
  }
  const parsed = phoneSchema.safeParse(input.phone);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await writeClinicSettings(clinicId, { testPhoneNumber: parsed.data });
  revalidatePath('/settings');
  return { success: true };
}

/**
 * Manually trigger the reminder scanners (48 h, 2 h, post-visit).
 * Useful for testing without waiting for the every-15-minute cron.
 *
 * Requires the BullMQ worker (`npm run worker`) to be running; otherwise jobs
 * sit in Redis until it comes online.
 */
export async function runReminderScanNow() {
  await requireAdmin();
  try {
    const { getSchedulerQueue } = await import('@/lib/queue');
    const queue = getSchedulerQueue();
    await queue.add('scan-48h', {});
    await queue.add('scan-2h', {});
    await queue.add('scan-post-visit', {});
    return { success: true, message: 'Reminder scan queued. Check the worker log for matches.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { error: 'Failed to enqueue scan: ' + msg };
  }
}

export async function sendTestMessage(input: { channel: 'whatsapp' | 'sms' }) {
  const { clinicId } = await requireAdmin();
  const current = await readClinicSettings(clinicId);
  const phone = current.testPhoneNumber as string | undefined;
  if (!phone) return { error: 'No test phone number saved. Please save a number first.' };

  const testContent = 'Hello from ClinicOS! This is a test message to verify your messaging setup is working correctly.';

  try {
    if (input.channel === 'whatsapp') {
      const { sendTextMessage } = await import('@/lib/channels/whatsapp');
      const result = await sendTextMessage(phone, testContent);
      return { success: true, externalId: result.externalId, message: 'WhatsApp message sent to ' + phone };
    } else {
      const { sendSms } = await import('@/lib/channels/sms');
      const result = await sendSms(phone, testContent);
      return { success: true, externalId: result.externalId, message: 'SMS sent to ' + phone };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { error: 'Send failed: ' + msg };
  }
}
