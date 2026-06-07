import { createHmac, timingSafeEqual } from 'crypto';
import type { RetellVoiceWebhookPayload } from '@/lib/channels/voice/retell';
import { getClinicIdFromPayload } from '@/lib/channels/voice/retell';

export type VoiceToolProvider = 'retell' | 'elevenlabs';

export type ParsedVoiceToolRequest = {
  provider: VoiceToolProvider;
  args: Record<string, unknown>;
  clinicId: string | null;
  providerCallId: string;
  fromNumber: string | null;
  language: string;
  toolName?: string;
};

export type RetellCustomFunctionPayload = {
  name?: string;
  args?: Record<string, unknown>;
  call?: RetellVoiceWebhookPayload['call'] & {
    call_id?: string;
    from_number?: string;
    metadata?: Record<string, unknown>;
  };
};

export type ElevenLabsToolPayload = {
  tool_call_id?: string;
  tool_name?: string;
  parameters?: Record<string, unknown>;
  conversation_id?: string;
  dynamic_variables?: Record<string, unknown>;
};

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export function verifyElevenLabsSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(',');
  const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
  const signature = parts.find((p) => p.startsWith('v0='));
  if (!timestamp || !signature) return false;

  const reqTimestamp = Number(timestamp) * 1000;
  if (Number.isNaN(reqTimestamp) || reqTimestamp < Date.now() - 30 * 60 * 1000) {
    return false;
  }

  const digest = `v0=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
  return safeEqual(digest, signature);
}

export function verifyVoiceToolsBearer(authHeader: string | null): boolean {
  const expected = process.env.VOICE_TOOLS_API_KEY;
  if (!expected) return false;
  if (!authHeader?.startsWith('Bearer ')) return false;
  return safeEqual(authHeader.slice('Bearer '.length), expected);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function resolveClinicId(
  primary: string | null,
  args: Record<string, unknown>,
  dynamicVars?: Record<string, unknown>,
): string | null {
  return (
    primary ??
    readString(args.clinicId) ??
    readString(dynamicVars?.clinicId) ??
    process.env.DEFAULT_CLINIC_ID ??
    null
  );
}

export function parseVoiceToolRequest(body: unknown): ParsedVoiceToolRequest | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Record<string, unknown>;

  if ('call' in payload || ('name' in payload && 'args' in payload)) {
    const retell = payload as RetellCustomFunctionPayload;
    const call = retell.call ?? {};
    const args = (retell.args ?? {}) as Record<string, unknown>;
    const callId = readString(call.call_id) ?? readString(payload.call_id as string);
    if (!callId) return null;

    const retellPayload: RetellVoiceWebhookPayload = {
      call,
      metadata: call.metadata,
    };

    return {
      provider: 'retell',
      args,
      clinicId: resolveClinicId(getClinicIdFromPayload(retellPayload), args),
      providerCallId: callId,
      fromNumber: readString(call.from_number) ?? readString(payload.from_number as string),
      language: readString(args.language) ?? 'bs-BA',
      toolName: readString(retell.name) ?? undefined,
    };
  }

  if ('parameters' in payload || 'conversation_id' in payload) {
    const eleven = payload as ElevenLabsToolPayload;
    const args = (eleven.parameters ?? {}) as Record<string, unknown>;
    const dynamicVars = eleven.dynamic_variables;
    const conversationId =
      readString(eleven.conversation_id) ??
      readString(args.conversation_id) ??
      readString(eleven.tool_call_id);

    if (!conversationId) return null;

    return {
      provider: 'elevenlabs',
      args,
      clinicId: resolveClinicId(null, args, dynamicVars),
      providerCallId: conversationId,
      fromNumber:
        readString(args.from_number) ??
        readString(args.phone) ??
        readString(dynamicVars?.from_number),
      language: readString(args.language) ?? 'en-US',
      toolName: readString(eleven.tool_name) ?? undefined,
    };
  }

  return null;
}

export function voiceToolResponse(
  result: { ok: true; message: string; data?: Record<string, unknown> } | { ok: false; error: string; code?: string },
) {
  if (result.ok) {
    return {
      success: true,
      message: result.message,
      ...(result.data ? { data: result.data } : {}),
    };
  }
  return {
    success: false,
    error: result.error,
    code: result.code ?? 'error',
    message: result.error,
  };
}
