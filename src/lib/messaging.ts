import { db } from '@/db';
import { messages, automations } from '@/db/schema';
import { patients } from '@/db/schema';
import type { AutomationTypeName } from '@/db/schema/automations';
import { eq, and } from 'drizzle-orm';
import { sendTextMessage } from './channels/whatsapp';
import { sendSms } from './channels/sms';
import { sendEmail } from './channels/email';
import { renderTemplate, DEFAULT_TEMPLATES } from './templates';
import type { TemplateVars } from './templates';
import { parseChannelCascade, type OutboundChannel } from './channel-cascade';

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
  | 'system'
  | 'campaign';

export interface SendParams {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  channel: OutboundChannel;
  type: MessageType;
  content: string;
  metadata?: Record<string, unknown>;
  emailSubject?: string;
  skipAutomationChecks?: boolean;
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

export async function getAutomationChannel(clinicId: string, type: string): Promise<string> {
  const [auto] = await db
    .select({ channel: automations.channel })
    .from(automations)
    .where(and(eq(automations.clinicId, clinicId), eq(automations.type, type as AutomationTypeName)))
    .limit(1);
  return auto?.channel ?? 'whatsapp';
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

async function dispatchToChannel(
  channel: OutboundChannel,
  patient: { phone: string | null; email: string | null },
  content: string,
  emailSubject?: string,
): Promise<string> {
  if (channel === 'whatsapp') {
    if (!patient.phone) throw new Error('Patient has no phone number for WhatsApp');
    const result = await sendTextMessage(patient.phone, content);
    return result.externalId;
  }
  if (channel === 'sms') {
    if (!patient.phone) throw new Error('Patient has no phone number for SMS');
    const result = await sendSms(patient.phone, content);
    return result.externalId;
  }
  if (!patient.email) throw new Error('Patient has no email address');
  const result = await sendEmail({
    to: patient.email,
    subject: emailSubject ?? 'Message from your clinic',
    body: content,
  });
  return result.externalId;
}

/** Send a message through the appropriate channel and log to DB. */
export async function sendMessage(params: SendParams): Promise<{ id: string } | { skipped: string }> {
  if (await isOptedOut(params.patientId)) {
    return { skipped: 'patient_opted_out' };
  }

  const automatedTypes: MessageType[] = ['reminder_48h', 'reminder_2h', 'post_visit', 're_engagement', 'review_request'];
  if (!params.skipAutomationChecks && automatedTypes.includes(params.type)) {
    if (!(await isAutomationEnabled(params.clinicId, params.type))) {
      return { skipped: 'automation_disabled' };
    }
    if (await isQuietHours(params.clinicId, params.type)) {
      return { skipped: 'quiet_hours' };
    }
  }

  const [patient] = await db
    .select({ phone: patients.phone, email: patients.email })
    .from(patients)
    .where(eq(patients.id, params.patientId))
    .limit(1);

  if (!patient) throw new Error('Patient not found');

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
    const externalId = await dispatchToChannel(
      params.channel,
      patient,
      params.content,
      params.emailSubject,
    );

    await db
      .update(messages)
      .set({ status: 'sent', externalId, updatedAt: new Date() })
      .where(eq(messages.id, msg.id));

    return { id: msg.id };
  } catch (error) {
    const friendly = formatSendError(error);
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

/**
 * Try channels in cascade order until one succeeds.
 * Returns message id on success, or throws after all channels fail.
 */
export async function sendMessageWithCascade(params: {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  type: MessageType;
  content: string;
  channelConfig: string;
  metadata?: Record<string, unknown>;
  emailSubject?: string;
  skipAutomationChecks?: boolean;
}): Promise<{ id: string; channel: OutboundChannel } | { skipped: string }> {
  const channels = parseChannelCascade(params.channelConfig);
  let lastError: Error | null = null;

  for (const channel of channels) {
    try {
      const result = await sendMessage({
        clinicId: params.clinicId,
        patientId: params.patientId,
        appointmentId: params.appointmentId,
        channel,
        type: params.type,
        content: params.content,
        metadata: { ...params.metadata, cascadeAttempt: channel },
        emailSubject: params.emailSubject,
        skipAutomationChecks: params.skipAutomationChecks,
      });
      if ('skipped' in result) return result;
      return { id: result.id, channel };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Send failed');
    }
  }

  if (lastError) throw lastError;
  return { skipped: 'no_channel_available' };
}

/** Build message content from automation template + variables. */
export async function buildMessageContent(
  clinicId: string,
  type: string,
  vars: TemplateVars,
): Promise<string> {
  const [auto] = await db
    .select({ templateContent: automations.templateContent })
    .from(automations)
    .where(and(eq(automations.clinicId, clinicId), eq(automations.type, type as AutomationTypeName)))
    .limit(1);

  const template = auto?.templateContent ?? DEFAULT_TEMPLATES[type] ?? '';
  return renderTemplate(template, vars);
}
