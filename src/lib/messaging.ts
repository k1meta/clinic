import { db } from '@/db';
import { messages, automations } from '@/db/schema';
import { patients } from '@/db/schema';
import type { AutomationTypeName } from '@/db/schema/automations';
import { eq, and } from 'drizzle-orm';
import { sendTemplateMessage, sendInteractiveButtons, sendTextMessage } from './channels/whatsapp';
import { sendSms } from './channels/sms';
import { renderTemplate, DEFAULT_TEMPLATES } from './templates';
import type { TemplateVars } from './templates';

export type MessageType =
  | 'reminder_48h'
  | 'reminder_2h'
  | 'post_visit'
  | 're_engagement'
  | 'review_request'
  | 'confirmation'
  | 'cancellation'
  | 'reschedule'
  | 'freetext'
  | 'system';

export interface SendParams {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  channel: 'whatsapp' | 'sms';
  type: MessageType;
  content: string;
  metadata?: Record<string, unknown>;
}

/** Check if patient has opted out. */
async function isOptedOut(patientId: string): Promise<boolean> {
  const [p] = await db
    .select({ optOutAt: patients.optOutAt })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return !!p?.optOutAt;
}

/** Check if current time is within quiet hours for the given automation type. */
async function isQuietHours(clinicId: string, type: string): Promise<boolean> {
  const [auto] = await db
    .select({ quietHoursStart: automations.quietHoursStart, quietHoursEnd: automations.quietHoursEnd })
    .from(automations)
    .where(and(eq(automations.clinicId, clinicId), eq(automations.type, type as AutomationTypeName)))
    .limit(1);

  if (!auto) return false;

  const now = new Date();
  const hour = now.getHours();
  if (auto.quietHoursStart > auto.quietHoursEnd) {
    // e.g. 21-8: quiet from 21:00 to 08:00
    return hour >= auto.quietHoursStart || hour < auto.quietHoursEnd;
  }
  return hour >= auto.quietHoursStart && hour < auto.quietHoursEnd;
}

/** Check if the automation is enabled for this clinic. */
async function isAutomationEnabled(clinicId: string, type: string): Promise<boolean> {
  const [auto] = await db
    .select({ isEnabled: automations.isEnabled })
    .from(automations)
    .where(and(eq(automations.clinicId, clinicId), eq(automations.type, type as AutomationTypeName)))
    .limit(1);
  return auto?.isEnabled ?? false;
}

function formatSendError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Unknown error';
  if (raw.includes('131047') || raw.toLowerCase().includes('24 hour')) {
    return 'WhatsApp only allows free-text replies within 24 hours of the patient\'s last message. Ask the patient to message the clinic first, or wait until they do.';
  }
  if (raw.includes('131026') || raw.toLowerCase().includes('not a valid whatsapp')) {
    return 'This phone number is not registered on WhatsApp or is not whitelisted for your test number.';
  }
  if (raw.toLowerCase().includes('invalid phone')) {
    return 'Patient phone number is invalid. Use E.164 format (e.g. +38761123456) on the patient record.';
  }
  return raw;
}

/** Send a message through the appropriate channel and log to DB. */
export async function sendMessage(params: SendParams): Promise<{ id: string } | { skipped: string }> {
  // Check opt-out
  if (await isOptedOut(params.patientId)) {
    return { skipped: 'patient_opted_out' };
  }

  // Check automation enabled (for automated types)
  const automatedTypes: MessageType[] = ['reminder_48h', 'reminder_2h', 'post_visit', 're_engagement', 'review_request'];
  if (automatedTypes.includes(params.type)) {
    if (!(await isAutomationEnabled(params.clinicId, params.type))) {
      return { skipped: 'automation_disabled' };
    }
    if (await isQuietHours(params.clinicId, params.type)) {
      return { skipped: 'quiet_hours' };
    }
  }

  // Insert message record as queued
  const [msg] = await db
    .insert(messages)
    .values({
      clinicId: params.clinicId,
      patientId: params.patientId,
      appointmentId: params.appointmentId ?? null,
      channel: params.channel,
      direction: 'outbound',
      type: params.type,
      status: 'queued',
      content: params.content,
      metadata: params.metadata ?? null,
    })
    .returning({ id: messages.id });

  try {
    let externalId = '';

    const [patient] = await db
      .select({ phone: patients.phone })
      .from(patients)
      .where(eq(patients.id, params.patientId))
      .limit(1);

    if (!patient?.phone) throw new Error('Patient has no phone number');

    if (params.channel === 'whatsapp') {
      const result = await sendTextMessage(patient.phone, params.content);
      externalId = result.externalId;
    } else {
      const result = await sendSms(patient.phone, params.content);
      externalId = result.externalId;
    }

    // Update to sent
    await db
      .update(messages)
      .set({ status: 'sent', externalId, updatedAt: new Date() })
      .where(eq(messages.id, msg.id));

    return { id: msg.id };
  } catch (error) {
    const friendly = formatSendError(error);
    // Update to failed
    await db
      .update(messages)
      .set({
        status: 'failed',
        metadata: { ...(params.metadata ?? {}), error: friendly },
        updatedAt: new Date(),
      })
      .where(eq(messages.id, msg.id));

    throw new Error(friendly);
  }
}

/** Build message content from automation template + variables. */
export async function buildMessageContent(
  clinicId: string,
  type: string,
  vars: TemplateVars,
): Promise<string> {
  // Try to get custom template from DB
  const [auto] = await db
    .select({ templateContent: automations.templateContent })
    .from(automations)
    .where(and(eq(automations.clinicId, clinicId), eq(automations.type, type as AutomationTypeName)))
    .limit(1);

  const template = auto?.templateContent ?? DEFAULT_TEMPLATES[type] ?? '';
  return renderTemplate(template, vars);
}
