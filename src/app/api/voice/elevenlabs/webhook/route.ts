import { NextResponse, type NextRequest } from 'next/server';
import { findClinicIdByConversation, processVoiceCall } from '@/jobs/process-voice-call';
import { parsePostCall } from '@/lib/channels/voice/elevenlabs';
import { verifyElevenLabsSignature } from '@/lib/voice/auth';
import { logVoiceError } from '@/lib/voice/log';
import { resolveClinicId } from '@/lib/voice/clinic-routing';

/**
 * Post-call log. Written directly, without Redis or the worker. A failed write returns
 * 500 so ElevenLabs shows the delivery as failed and it can be redelivered.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyElevenLabsSignature(raw, request.headers.get('elevenlabs-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const record = parsePostCall(body);
  if (!record) return NextResponse.json({ ok: true, ignored: true });

  try {
    const clinicId =
      (await findClinicIdByConversation(record.conversationId)) ?? (await resolveClinicId(record.calledNumber));
    if (!clinicId) {
      console.warn('[voice] post-call for an unregistered number ignored');
      return NextResponse.json({ ok: true, ignored: true });
    }
    await processVoiceCall(clinicId, record);
  } catch (error) {
    logVoiceError('post-call logging failed', error);
    return NextResponse.json({ error: 'Could not store call' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
