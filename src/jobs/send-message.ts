import { db } from '@/db';
import { appointments, patients, doctors, messages, automations, clinics } from '@/db/schema';
import type { AutomationTypeName } from '@/db/schema/automations';
import { and, eq, inArray } from 'drizzle-orm';
import { sendMessage, sendMessageWithCascade, buildMessageContent, getAutomationChannel } from '@/lib/messaging';
import { sendTemplateMessage } from '@/lib/channels/whatsapp';
import type { SendMessageJobData } from '@/lib/queue';
import { getClinicSettings } from '@/db/queries/clinics';

/**
 * The Meta-approved WhatsApp template that carries the 48 h appointment reminder
 * with three quick-reply buttons (Confirm / Cancel / Reschedule). The button
 * payloads must be `confirm:<apptId>` / `cancel:<apptId>` / `reschedule:<apptId>`
 * so the inbound webhook in src/app/api/whatsapp/webhook/route.ts can decode them.
 *
 * If you renamed your template in Business Manager, change this constant.
 */
const REMINDER_48H_TEMPLATE = {
  name: 'appointment_reminder_48h',
  language: 'hr',
  buttonLabels: { confirm: 'Potvrdi', cancel: 'Otkazi', reschedule: 'Pomjeri' },
};

/** Meta-approved template: two body variables — patient name, full review URL. */
const REVIEW_REQUEST_TEMPLATE = {
  name: 'google_review_first_visit',
  language: 'hr',
};

async function isOptedOut(patientId: string): Promise<boolean> {
  const [p] = await db.select({ optOutAt: patients.optOutAt }).from(patients).where(eq(patients.id, patientId)).limit(1);
  return !!p?.optOutAt;
}

async function readAutomationFlags(clinicId: string, type: AutomationTypeName) {
  const [a] = await db
    .select({ isEnabled: automations.isEnabled })
    .from(automations)
    .where(and(eq(automations.clinicId, clinicId), eq(automations.type, type)))
    .limit(1);
  return a ?? null;
}

export async function processSendMessage(data: SendMessageJobData) {
  const { clinicId, patientId, appointmentId, type } = data;

  const [patient] = await db
    .select({ fullName: patients.fullName, phone: patients.phone })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient?.phone) {
    console.log('Skipping message: patient has no phone', patientId);
    return;
  }

  let doctorName = '';
  let date = '';
  let time = '';

  if (appointmentId) {
    const [apt] = await db
      .select({ startsAt: appointments.startsAt, doctorId: appointments.doctorId })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (apt) {
      const [doc] = await db.select({ fullName: doctors.fullName }).from(doctors).where(eq(doctors.id, apt.doctorId)).limit(1);
      doctorName = doc?.fullName ?? '';
      const d = new Date(apt.startsAt);
      date = d.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      time = d.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });
    }
  }

  // 48 h reminder: must use an approved template + quick-reply buttons because
  // it's sent OUTSIDE Meta's 24 h customer-service window. Plain text would be rejected.
  if (type === 'reminder_48h' && appointmentId) {
    if (await isOptedOut(patientId)) {
      console.log('Skipping reminder_48h: patient opted out', patientId);
      return;
    }
    const flags48 = await readAutomationFlags(clinicId, 'reminder_48h');
    if (!flags48?.isEnabled) {
      console.log('Skipping reminder_48h: automation disabled for clinic', clinicId);
      return;
    }

    const [alreadySent] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.appointmentId, appointmentId),
          eq(messages.type, 'reminder_48h'),
          eq(messages.direction, 'outbound'),
          inArray(messages.status, ['queued', 'sent', 'delivered', 'read']),
        ),
      )
      .limit(1);
    if (alreadySent) {
      console.log('Skipping reminder_48h: already sent for appointment', appointmentId);
      return;
    }

    const renderedContent = await buildMessageContent(clinicId, type, {
      patient_name: patient.fullName, date, time, doctor: doctorName,
    });

    const [logged] = await db.insert(messages).values({
      clinicId, patientId, appointmentId,
      channel: 'whatsapp', direction: 'outbound', type: 'reminder_48h',
      status: 'queued', content: renderedContent,
      metadata: { template: REMINDER_48H_TEMPLATE.name },
    }).returning({ id: messages.id });

    try {
      const result = await sendTemplateMessage(
        patient.phone,
        REMINDER_48H_TEMPLATE.name,
        REMINDER_48H_TEMPLATE.language,
        [patient.fullName, date, time, doctorName],
        [
          { type: 'quick_reply', text: REMINDER_48H_TEMPLATE.buttonLabels.confirm,    payload: 'confirm:'    + appointmentId },
          { type: 'quick_reply', text: REMINDER_48H_TEMPLATE.buttonLabels.cancel,     payload: 'cancel:'     + appointmentId },
          { type: 'quick_reply', text: REMINDER_48H_TEMPLATE.buttonLabels.reschedule, payload: 'reschedule:' + appointmentId },
        ],
      );
      await db.update(messages).set({ status: 'sent', externalId: result.externalId, updatedAt: new Date() }).where(eq(messages.id, logged.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await db.update(messages).set({
        status: 'failed',
        metadata: { template: REMINDER_48H_TEMPLATE.name, error: msg },
        updatedAt: new Date(),
      }).where(eq(messages.id, logged.id));
      throw err;
    }
    return;
  }

  // First-visit Google review ask (WhatsApp template; link from clinic settings).
  if (type === 'review_request' && appointmentId) {
    const [dup] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.patientId, patientId),
          eq(messages.type, 'review_request'),
          eq(messages.direction, 'outbound'),
          inArray(messages.status, ['queued', 'sent', 'delivered', 'read']),
        ),
      )
      .limit(1);
    if (dup) {
      console.log('Skipping review_request: already queued or sent for patient', patientId);
      return;
    }

    if (await isOptedOut(patientId)) {
      console.log('Skipping review_request: patient opted out', patientId);
      return;
    }

    const flagsRv = await readAutomationFlags(clinicId, 'review_request');
    if (!flagsRv?.isEnabled) {
      console.log('Skipping review_request: automation disabled', clinicId);
      return;
    }

    const clinicSettings = await getClinicSettings(clinicId);
    const baseReviewUrl = clinicSettings.googleReviewUrl.trim();
    if (!baseReviewUrl) {
      console.log('Skipping review_request: no googleReviewUrl in clinic settings', clinicId);
      return;
    }

    const reviewUrl = baseReviewUrl.includes('?')
      ? `${baseReviewUrl}&utm_source=clinicos&utm_medium=review_request`
      : `${baseReviewUrl}?utm_source=clinicos&utm_medium=review_request`;

    const renderedContent = await buildMessageContent(clinicId, 'review_request', {
      patient_name: patient.fullName,
      review_url: reviewUrl,
    });

    const [logged] = await db
      .insert(messages)
      .values({
        clinicId,
        patientId,
        appointmentId,
        channel: 'whatsapp',
        direction: 'outbound',
        type: 'review_request',
        status: 'queued',
        content: renderedContent,
        metadata: { template: REVIEW_REQUEST_TEMPLATE.name },
      })
      .returning({ id: messages.id });

    try {
      const result = await sendTemplateMessage(
        patient.phone,
        REVIEW_REQUEST_TEMPLATE.name,
        REVIEW_REQUEST_TEMPLATE.language,
        [patient.fullName, reviewUrl],
      );
      await db
        .update(messages)
        .set({ status: 'sent', externalId: result.externalId, updatedAt: new Date() })
        .where(eq(messages.id, logged.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await db
        .update(messages)
        .set({
          status: 'failed',
          metadata: { template: REVIEW_REQUEST_TEMPLATE.name, error: msg },
          updatedAt: new Date(),
        })
        .where(eq(messages.id, logged.id));

      const channelConfig = await getAutomationChannel(clinicId, 'review_request');
      if (channelConfig.includes(',')) {
        await sendMessageWithCascade({
          clinicId,
          patientId,
          appointmentId,
          type: 'review_request',
          content: renderedContent,
          channelConfig,
          emailSubject: 'We would love your feedback',
          metadata: { fallbackAfterTemplateFail: true },
          skipAutomationChecks: true,
        });
        return;
      }
      throw err;
    }
    return;
  }

  if (type === 'reminder_2h' && appointmentId) {
    if (await isOptedOut(patientId)) {
      console.log('Skipping reminder_2h: patient opted out', patientId);
      return;
    }
    const flags2h = await readAutomationFlags(clinicId, 'reminder_2h');
    if (!flags2h?.isEnabled) {
      console.log('Skipping reminder_2h: automation disabled for clinic', clinicId);
      return;
    }

    const [apt2h] = await db
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!apt2h || apt2h.status === 'cancelled') {
      console.log('Skipping reminder_2h: appointment cancelled or missing', appointmentId);
      return;
    }

    const [confirmed] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.appointmentId, appointmentId),
          eq(messages.type, 'confirmation'),
          eq(messages.direction, 'inbound'),
        ),
      )
      .limit(1);
    if (confirmed) {
      console.log('Skipping reminder_2h: patient already confirmed', appointmentId);
      return;
    }

    const [alreadySent2h] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.appointmentId, appointmentId),
          eq(messages.type, 'reminder_2h'),
          eq(messages.direction, 'outbound'),
          inArray(messages.status, ['queued', 'sent', 'delivered', 'read']),
        ),
      )
      .limit(1);
    if (alreadySent2h) {
      console.log('Skipping reminder_2h: already sent for appointment', appointmentId);
      return;
    }
  }

  const [clinicRow] = await db
    .select({ name: clinics.name })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);
  const clinicSettings = await getClinicSettings(clinicId);
  const content = await buildMessageContent(clinicId, type, {
    patient_name: patient.fullName,
    date,
    time,
    doctor: doctorName,
    clinic_name: clinicRow?.name,
    review_url: type === 'review_request' ? clinicSettings.googleReviewUrl : undefined,
  });

  const channelConfig = await getAutomationChannel(clinicId, type);
  const useCascade = channelConfig.includes(',');

  if (useCascade) {
    await sendMessageWithCascade({
      clinicId,
      patientId,
      appointmentId,
      type,
      content,
      channelConfig,
      emailSubject: type === 're_engagement' ? 'We miss you!' : 'Message from your clinic',
    });
    return;
  }

  const singleChannel = channelConfig as 'whatsapp' | 'sms' | 'email';
  await sendMessage({
    clinicId,
    patientId,
    appointmentId,
    channel: singleChannel,
    type,
    content,
    emailSubject: type === 're_engagement' ? 'We miss you!' : 'Message from your clinic',
  });
}
