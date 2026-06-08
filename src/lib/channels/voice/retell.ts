import { createHmac, timingSafeEqual } from 'crypto';

export type RetellVoiceWebhookPayload = {
  event?: string;
  type?: string;
  call_id?: string;
  call?: {
    call_id?: string;
    from_number?: string;
    to_number?: string;
    direction?: 'inbound' | 'outbound';
    start_timestamp?: number;
    end_timestamp?: number;
    duration_ms?: number;
    transcript?: string;
    call_analysis?: { call_summary?: string };
    metadata?: Record<string, unknown>;
  };
  from_number?: string;
  to_number?: string;
  transcript?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

function normalizeSig(sig: string): string {
  return sig.startsWith('sha256=') ? sig.slice('sha256='.length) : sig;
}

export function verifyRetellSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.RETELL_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signatureHeader) return false;
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(digest, normalizeSig(signatureHeader));
}

export function parseRetellPayload(raw: string): RetellVoiceWebhookPayload {
  const parsed = JSON.parse(raw) as RetellVoiceWebhookPayload;
  return parsed;
}

export function getCallId(payload: RetellVoiceWebhookPayload): string | null {
  return payload.call_id ?? payload.call?.call_id ?? null;
}

export function getEventType(payload: RetellVoiceWebhookPayload): string {
  return (payload.event ?? payload.type ?? 'unknown').toString();
}

export function getFromNumber(payload: RetellVoiceWebhookPayload): string | null {
  return payload.from_number ?? payload.call?.from_number ?? null;
}

export function getToNumber(payload: RetellVoiceWebhookPayload): string | null {
  return payload.to_number ?? payload.call?.to_number ?? null;
}

export function getDirection(payload: RetellVoiceWebhookPayload): 'inbound' | 'outbound' {
  return payload.call?.direction === 'outbound' ? 'outbound' : 'inbound';
}

export function getClinicIdFromPayload(payload: RetellVoiceWebhookPayload): string | null {
  const meta = (payload.metadata ?? payload.call?.metadata ?? {}) as Record<string, unknown>;
  const candidate = meta.clinicId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

export function getTranscript(payload: RetellVoiceWebhookPayload): string {
  if (typeof payload.transcript === 'string' && payload.transcript.trim()) {
    return payload.transcript;
  }
  const callTranscript = payload.call?.transcript;
  if (typeof callTranscript === 'string' && callTranscript.trim()) {
    return callTranscript;
  }
  const nested = payload.payload as Record<string, unknown> | undefined;
  if (nested && typeof nested.transcript === 'string') return nested.transcript;
  return '';
}

export function getRetellSummary(payload: RetellVoiceWebhookPayload): string {
  if (typeof payload.summary === 'string' && payload.summary.trim()) {
    return payload.summary.trim();
  }
  const callSummary = payload.call?.call_analysis?.call_summary;
  if (typeof callSummary === 'string' && callSummary.trim()) {
    return callSummary.trim();
  }
  return '';
}
