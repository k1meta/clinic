import { NextRequest, NextResponse } from 'next/server';
import { getClinicSettings } from '@/db/queries/clinics';
import { verifyRetellSignature } from '@/lib/channels/voice/retell';
import {
  parseVoiceToolRequest,
  verifyElevenLabsSignature,
  verifyVoiceToolsBearer,
  voiceToolResponse,
} from '@/lib/voice/tool-request';

export async function parseAuthorizedVoiceToolRequest(request: NextRequest) {
  const raw = await request.text();
  const retellSig =
    request.headers.get('x-retell-signature') ??
    request.headers.get('x-retell-signature-256') ??
    request.headers.get('x-signature');
  const elevenSig = request.headers.get('elevenlabs-signature');
  const bearer = request.headers.get('authorization');

  const retellOk = retellSig ? verifyRetellSignature(raw, retellSig) : false;
  const elevenOk = elevenSig ? verifyElevenLabsSignature(raw, elevenSig) : false;
  const bearerOk = verifyVoiceToolsBearer(bearer);

  if (!retellOk && !elevenOk && !bearerOk) {
    if (process.env.RETELL_WEBHOOK_SECRET || process.env.ELEVENLABS_WEBHOOK_SECRET || process.env.VOICE_TOOLS_API_KEY) {
      return { error: NextResponse.json({ error: 'Invalid signature or authorization' }, { status: 401 }) };
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }) };
  }

  const parsed = parseVoiceToolRequest(body);
  if (!parsed) {
    return { error: NextResponse.json({ error: 'Unrecognized tool payload' }, { status: 400 }) };
  }

  if (!parsed.clinicId) {
    return {
      error: NextResponse.json(
        { error: 'Missing clinicId in call metadata, tool args, or DEFAULT_CLINIC_ID' },
        { status: 400 },
      ),
    };
  }

  const settings = await getClinicSettings(parsed.clinicId);
  if (!settings.aiCalls) {
    return {
      error: NextResponse.json(
        voiceToolResponse({
          ok: false,
          error: 'AI calling is disabled for this clinic.',
          code: 'ai_calls_disabled',
        }),
        { status: 403 },
      ),
    };
  }

  return { parsed, settings };
}

export function okToolJson(
  message: string,
  data?: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(voiceToolResponse({ ok: true, message, data }), { status });
}

export function failToolJson(error: string, code?: string, status = 200) {
  return NextResponse.json(voiceToolResponse({ ok: false, error, code }), { status });
}
