import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { messages, patients } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { addProcessReplyJob } from '@/lib/queue';
import { getClinicSettings } from '@/db/queries/clinics';
import { handleInboundMessage, type ConvState } from '@/lib/ai/conversation';
import { matchWhatsAppPatient } from '@/lib/ai/patient-matcher';
import { sendTextMessage, sendSlotList } from '@/lib/channels/whatsapp';

type ReminderAction = 'confirm' | 'cancel' | 'reschedule';

function parseReminderButtonPayload(
  raw: string | undefined,
): { action: ReminderAction; appointmentId: string } | null {
  if (!raw) return null;
  const colon = raw.indexOf(':');
  if (colon <= 0) return null;
  const action = raw.slice(0, colon);
  const appointmentId = raw.slice(colon + 1);
  if (!['confirm', 'cancel', 'reschedule'].includes(action) || !appointmentId) return null;
  return { action: action as ReminderAction, appointmentId };
}

async function handleReminderButtonReply(params: {
  clinicId: string;
  phone: string;
  action: ReminderAction;
  appointmentId: string;
}) {
  const { clinicId, phone, action, appointmentId } = params;
  const patient = await matchWhatsAppPatient(clinicId, phone);
  if (!patient) return;
  await addProcessReplyJob({
    clinicId,
    patientId: patient.id,
    appointmentId,
    action,
  });
}

function verifySignature(body: string, signature: string): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** GET: Meta webhook verification */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const mode = p.get('hub.mode');
  const token = p.get('hub.verify_token');
  const challenge = p.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/** POST: inbound messages + status updates from Meta Cloud API */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sig = request.headers.get('x-hub-signature-256') ?? '';
  if (sig && !verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ status: 'ok' }); }

  try {
    const entries = (body?.entry as Array<Record<string, unknown>>) ?? [];
    for (const entry of entries) {
      const changes = (entry?.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        const value = change?.value as Record<string, unknown> | undefined;
        if (!value) continue;

        // Status updates (delivered, read, failed)
        const statuses = value.statuses as Array<Record<string, unknown>> | undefined;
        if (statuses) {
          for (const status of statuses) {
            const externalId = status.id as string;
            const newStatus = status.status as string;
            if (externalId && ['delivered', 'read', 'failed'].includes(newStatus)) {
              await db.update(messages)
                .set({ status: newStatus as 'delivered' | 'read' | 'failed', updatedAt: new Date() })
                .where(eq(messages.externalId, externalId));
            }
          }
        }

        // Inbound messages
        const inbound = value.messages as Array<Record<string, unknown>> | undefined;
        if (!inbound) continue;

        // Derive clinic from phone number ID
        const metadata = value.metadata as Record<string, unknown> | undefined;
        const phoneNumberId = metadata?.phone_number_id as string | undefined;
        // For MVP: single clinic ? in production match by phoneNumberId
        const clinicId = process.env.DEMO_CLINIC_ID ?? '00000000-0000-0000-0000-000000000001';

        for (const msg of inbound) {
          const phone = msg.from as string | undefined;
          if (!phone) continue;

          // Template quick-reply (48 h reminder): type "button" + button.payload
          if (msg.type === 'button') {
            const templateBtn = msg.button as { payload?: string; text?: string } | undefined;
            const parsed = parseReminderButtonPayload(templateBtn?.payload);
            if (parsed) {
              await handleReminderButtonReply({
                clinicId,
                phone,
                action: parsed.action,
                appointmentId: parsed.appointmentId,
              });
              continue;
            }
          }

          // Interactive button reply (non-template flows)
          const interactive = msg.interactive as Record<string, unknown> | undefined;
          if (msg.type === 'interactive' && interactive?.type === 'button_reply') {
            const buttonReply = interactive.button_reply as { id: string; title: string };
            const parsed = parseReminderButtonPayload(buttonReply.id);
            if (parsed) {
              await handleReminderButtonReply({
                clinicId,
                phone,
                action: parsed.action,
                appointmentId: parsed.appointmentId,
              });
            }
            continue;
          }

          // Free text / list reply -> AI handler
          const listReply = interactive?.type === 'list_reply'
            ? (interactive.list_reply as { id: string; title: string } | undefined)
            : undefined;
          const textBody = listReply?.title ?? (msg.text as { body?: string } | undefined)?.body ?? '[media]';

          const patient = await matchWhatsAppPatient(clinicId, phone);
          const currentState = patient ? await loadConvState(clinicId, patient.id) : null;
          const settings = await getClinicSettings(clinicId);

          // Handle slot list reply: payload encoded as 'slot:N'
          let finalText = textBody;
          if (listReply?.id?.startsWith('slot:')) {
            const choiceNum = parseInt(listReply.id.split(':')[1]);
            if (!isNaN(choiceNum)) finalText = String(choiceNum);
          }

          // Log inbound first so it's preserved even if the AI call below throws.
          if (patient) {
            await db.insert(messages).values({
              clinicId,
              patientId: patient.id,
              channel: 'whatsapp',
              direction: 'inbound',
              type: 'freetext',
              status: 'delivered',
              content: textBody,
              externalId: msg.id as string ?? '',
              readByStaff: false,
            });
          }

          // Run the AI conversation engine. If it throws (Groq quota, network,
          // model error, etc.) we fall back to a polite Croatian system message
          // so the patient is never left in silence.
          let result;
          try {
            result = await handleInboundMessage({
              channel: 'whatsapp',
              senderId: phone,
              senderName: null,
              text: finalText,
              clinicId,
              patientId: patient?.id ?? null,
              patientName: patient?.fullName ?? null,
              currentState,
              aiEnabled: settings.aiMessaging,
            });
          } catch (aiErr) {
            console.error('[whatsapp webhook] AI error:', aiErr);
            const fallback = 'Postovani, trenutno imamo tehnickih poteskoca u sistemu. Vasa poruka je zaprimljena, javit cemo Vam se uskoro.';
            try { await sendTextMessage(phone, fallback); } catch { /* swallow send error */ }
            if (patient) {
              await db.insert(messages).values({
                clinicId,
                patientId: patient.id,
                channel: 'whatsapp',
                direction: 'outbound',
                type: 'system',
                status: 'sent',
                content: fallback,
                metadata: { error: aiErr instanceof Error ? aiErr.message : String(aiErr) },
                readByStaff: false,
              });
            }
            continue;
          }

          // Send AI reply
          if (result.response) {
            if (result.slotOptions && result.slotOptions.length > 0) {
              await sendSlotList(phone, 'Slobodni termini', result.response, result.slotOptions);
            } else {
              await sendTextMessage(phone, result.response);
            }

            // Log outbound with conversation state
            if (patient) {
              await db.insert(messages).values({
                clinicId,
                patientId: patient.id,
                channel: 'whatsapp',
                direction: 'outbound',
                type: 'freetext',
                status: 'sent',
                content: result.response,
                metadata: result.nextState as unknown as Record<string, unknown>,
                readByStaff: true,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[whatsapp webhook] Error:', error);
  }

  return NextResponse.json({ status: 'ok' });
}

// Keep an in-flight conversation alive for at most this long. After 24 h with no
// reply we restart the FSM so a stale slot list / awaiting_treatment doesn't
// hijack a brand-new patient request.
const CONV_STATE_TTL_MS = 24 * 60 * 60 * 1000;

async function loadConvState(clinicId: string, patientId: string): Promise<ConvState | null> {
  const [last] = await db
    .select({ metadata: messages.metadata, createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.patientId, patientId), eq(messages.clinicId, clinicId)))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  if (!last?.metadata) return null;

  const ageMs = Date.now() - new Date(last.createdAt).getTime();
  if (ageMs > CONV_STATE_TTL_MS) return null;

  const m = last.metadata as Record<string, unknown>;
  // Skip metadata blobs from non-AI rows (e.g. error/template metadata)
  if (m.intent === undefined && m.step === undefined) return null;
  // A finished conversation doesn't carry forward
  if (m.step === 'done' || m.step === null) return null;
  return m as unknown as ConvState;
}
