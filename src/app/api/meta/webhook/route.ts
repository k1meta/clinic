import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getClinicSettings } from '@/db/queries/clinics';
import { handleInboundMessage, type ConvState } from '@/lib/ai/conversation';
import { matchPatientBySocialId } from '@/lib/ai/patient-matcher';
import { sendTextMessage, sendQuickReplies } from '@/lib/channels/instagram';

// For a real deployment each clinic will have their own Meta app / page.
// For MVP we use a single app covering all clinics.
// The clinicId is derived from the page ID stored in env.
const CLINIC_ID = process.env.DEMO_CLINIC_ID ?? '00000000-0000-0000-0000-000000000001';

function verifySignature(body: string, signature: string): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true; // skip in dev if not set
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** GET: Meta webhook verification handshake */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const mode = p.get('hub.mode');
  const token = p.get('hub.verify_token');
  const challenge = p.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/** POST: inbound messages from Instagram DMs and Messenger */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sig = request.headers.get('x-hub-signature-256') ?? '';
  if (sig && !verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ status: 'ok' }); }

  const object = body.object as string;
  const channel = object === 'instagram' ? 'instagram' : 'messenger';

  try {
    const entries = (body.entry as Array<Record<string, unknown>>) ?? [];
    for (const entry of entries) {
      const messaging = (entry.messaging as Array<Record<string, unknown>>) ?? [];
      for (const event of messaging) {
        const sender = event.sender as { id: string } | undefined;
        if (!sender?.id) continue;
        const senderId = sender.id;

        // Delivery / read receipts ? skip
        if (event.delivery || event.read) continue;

        const msg = event.message as Record<string, unknown> | undefined;
        if (!msg) continue;

        const mid = (msg.mid as string) ?? '';
        const text = (msg.text as string) ?? '';
        const quickReplyPayload = (msg.quick_reply as { payload?: string } | undefined)?.payload ?? null;

        if (!text && !quickReplyPayload) continue;

        const clinicId = CLINIC_ID;

        // Match patient by social ID
        const patient = await matchPatientBySocialId(clinicId, channel, senderId);

        // Load conversation state from last AI message
        const currentState = await loadConvState(clinicId, patient?.id ?? null);

        // Check aiMessaging setting
        const settings = await getClinicSettings(clinicId);
        const aiEnabled = settings.aiMessaging;

        const messageText = quickReplyPayload ?? text;

        // Handle slot quick-reply specially: treat payload as slot choice
        let finalText = messageText;
        if (quickReplyPayload?.startsWith('slot:')) {
          const choiceNum = parseInt(quickReplyPayload.split(':')[1]);
          if (!isNaN(choiceNum)) finalText = String(choiceNum);
        }

        // Process with AI
        const result = await handleInboundMessage({
          channel,
          senderId,
          senderName: null,
          text: finalText,
          clinicId,
          patientId: patient?.id ?? null,
          patientName: patient?.fullName ?? null,
          currentState,
          aiEnabled,
        });

        // Log inbound message
        if (patient) {
          await db.insert(messages).values({
            clinicId,
            patientId: patient.id,
            channel,
            direction: 'inbound',
            type: 'freetext',
            status: 'delivered',
            content: messageText,
            externalId: mid,
            readByStaff: false,
          });
        }

        // Send AI response
        if (result.response) {
          if (result.slotOptions && result.slotOptions.length > 0) {
            await sendQuickReplies(senderId, result.response, result.slotOptions.map(s => ({ title: s.title, payload: s.payload })));
          } else {
            await sendTextMessage(senderId, result.response);
          }

          // Log outbound
          if (patient) {
            await db.insert(messages).values({
              clinicId,
              patientId: patient.id,
              channel,
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
  } catch (error) {
    console.error('[meta webhook] Error:', error);
  }

  return NextResponse.json({ status: 'ok' });
}

const CONV_STATE_TTL_MS = 24 * 60 * 60 * 1000;

async function loadConvState(clinicId: string, patientId: string | null): Promise<ConvState | null> {
  if (!patientId) return null;
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
  if (m.intent === undefined && m.step === undefined) return null;
  if (m.step === 'done' || m.step === null) return null;
  return m as unknown as ConvState;
}
