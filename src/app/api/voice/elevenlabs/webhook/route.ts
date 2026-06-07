import { NextRequest, NextResponse } from 'next/server';
import {
  getElevenLabsClinicId,
  getElevenLabsConversationId,
  getElevenLabsDurationSec,
  getElevenLabsEventType,
  getElevenLabsFromNumber,
  getElevenLabsToNumber,
  getElevenLabsTranscript,
  parseElevenLabsPayload,
} from '@/lib/channels/voice/elevenlabs';
import { getClinicSettings } from '@/db/queries/clinics';
import { addVoiceEventJob } from '@/lib/queue';
import { verifyElevenLabsSignature } from '@/lib/voice/tool-request';

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get('elevenlabs-signature');

  if (!verifyElevenLabsSignature(raw, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let payload: ReturnType<typeof parseElevenLabsPayload>;
  try {
    payload = parseElevenLabsPayload(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const eventType = getElevenLabsEventType(payload);
  const isPostCall =
    eventType.includes('post_call') ||
    eventType.includes('transcription') ||
    payload.data?.status === 'done';

  if (!isPostCall) {
    return NextResponse.json({ ok: true, ignored: true, eventType });
  }

  const clinicId = getElevenLabsClinicId(payload) ?? process.env.DEFAULT_CLINIC_ID ?? null;
  if (!clinicId) {
    return NextResponse.json(
      { error: 'Missing clinicId in dynamic variables and DEFAULT_CLINIC_ID is not set' },
      { status: 400 },
    );
  }

  const settings = await getClinicSettings(clinicId);
  if (!settings.aiCalls) {
    return NextResponse.json({
      ok: true,
      aiCalls: false,
      message: 'AI calling is disabled in clinic settings',
    });
  }

  const conversationId = getElevenLabsConversationId(payload);
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
  }

  await addVoiceEventJob({
    clinicId,
    provider: 'elevenlabs',
    providerCallId: conversationId,
    eventType,
    fromNumber: getElevenLabsFromNumber(payload) ?? undefined,
    toNumber: getElevenLabsToNumber(payload) ?? undefined,
    direction: 'inbound',
    transcript: getElevenLabsTranscript(payload) || undefined,
    durationSec: getElevenLabsDurationSec(payload) ?? undefined,
    payload: payload as Record<string, unknown>,
    reconcileOnly: true,
  });

  return NextResponse.json({ ok: true });
}
