import { NextRequest, NextResponse } from 'next/server';
import { getClinicSettings } from '@/db/queries/clinics';
import { addVoiceEventJob } from '@/lib/queue';
import {
  getCallId,
  getClinicIdFromPayload,
  getDirection,
  getEventType,
  getFromNumber,
  getToNumber,
  getTranscript,
  parseRetellPayload,
  verifyRetellSignature,
} from '@/lib/channels/voice/retell';

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature =
    request.headers.get('x-retell-signature') ??
    request.headers.get('x-retell-signature-256') ??
    request.headers.get('x-signature');

  if (!verifyRetellSignature(raw, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  let payload: ReturnType<typeof parseRetellPayload>;
  try {
    payload = parseRetellPayload(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const clinicId = getClinicIdFromPayload(payload) ?? process.env.DEFAULT_CLINIC_ID ?? null;
  if (!clinicId) {
    return NextResponse.json({ error: 'Missing clinicId in metadata and DEFAULT_CLINIC_ID is not set' }, { status: 400 });
  }

  const settings = await getClinicSettings(clinicId);
  if (!settings.aiCalls) {
    return NextResponse.json({
      ok: true,
      aiCalls: false,
      message: 'AI calling is disabled in clinic settings',
    });
  }

  const callId = getCallId(payload);
  if (!callId) {
    return NextResponse.json({ error: 'Missing call_id' }, { status: 400 });
  }

  await addVoiceEventJob({
    clinicId,
    provider: 'retell',
    providerCallId: callId,
    eventType: getEventType(payload),
    fromNumber: getFromNumber(payload) ?? undefined,
    toNumber: getToNumber(payload) ?? undefined,
    direction: getDirection(payload),
    transcript: getTranscript(payload) || undefined,
    payload: payload as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true });
}
