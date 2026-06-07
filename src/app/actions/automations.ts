'use server';

import { db } from '@/db';
import { automations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '@/db/queries/auth';
import { revalidatePath } from 'next/cache';

export async function getAutomations() {
  const { clinicId } = await requireAdmin();
  return db
    .select({
      id: automations.id,
      type: automations.type,
      isEnabled: automations.isEnabled,
      channel: automations.channel,
      templateContent: automations.templateContent,
      quietHoursStart: automations.quietHoursStart,
      quietHoursEnd: automations.quietHoursEnd,
    })
    .from(automations)
    .where(eq(automations.clinicId, clinicId));
}

export async function toggleAutomation(automationId: string) {
  const { clinicId } = await requireAdmin();

  const [auto] = await db
    .select({ isEnabled: automations.isEnabled })
    .from(automations)
    .where(and(eq(automations.id, automationId), eq(automations.clinicId, clinicId)))
    .limit(1);

  if (!auto) return { error: 'Not found' };

  await db
    .update(automations)
    .set({ isEnabled: !auto.isEnabled, updatedAt: new Date() })
    .where(and(eq(automations.id, automationId), eq(automations.clinicId, clinicId)));

  revalidatePath('/voice-ai');
  revalidatePath('/settings');
  return { success: true };
}

export async function updateAutomationTemplate(automationId: string, templateContent: string) {
  const { clinicId } = await requireAdmin();

  await db
    .update(automations)
    .set({ templateContent, updatedAt: new Date() })
    .where(and(eq(automations.id, automationId), eq(automations.clinicId, clinicId)));

  revalidatePath('/voice-ai');
  return { success: true };
}

export async function updateQuietHours(automationId: string, start: number, end: number) {
  const { clinicId } = await requireAdmin();

  await db
    .update(automations)
    .set({ quietHoursStart: start, quietHoursEnd: end, updatedAt: new Date() })
    .where(and(eq(automations.id, automationId), eq(automations.clinicId, clinicId)));

  revalidatePath('/voice-ai');
  return { success: true };
}
