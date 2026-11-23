import { toE164 } from '@/lib/phone';

export type TranscriptTurn = { role: string; message: string };

/** The parts of a finished call that are stored. Raw payloads are not kept. */
export type PostCallRecord = {
  conversationId: string;
  direction: 'inbound' | 'outbound';
  callerNumber: string | null;
  calledNumber: string | null;
  turns: TranscriptTurn[];
  transcript: string | null;
  summary: string | null;
  callSuccessful: string | null;
  durationSec: number | null;
  startedAt: Date | null;
  endedAt: Date | null;
  failed: boolean;
};

type Obj = Record<string, unknown>;

function asObject(value: unknown): Obj {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : {};
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Returns null for events that are not a call transcript or a failed call. */
export function parsePostCall(body: unknown): PostCallRecord | null {
  const payload = asObject(body);
  const type = asText(payload.type);
  const failed = type === 'call_initiation_failure';
  if (type !== 'post_call_transcription' && !failed) return null;

  const data = asObject(payload.data);
  const conversationId = asText(data.conversation_id);
  if (!conversationId) return null;

  const metadata = asObject(data.metadata);
  const phoneCall = asObject(metadata.phone_call);
  const analysis = asObject(data.analysis);
  const direction = phoneCall.direction === 'outbound' ? 'outbound' : 'inbound';
  const external = toE164(asText(phoneCall.external_number) ?? asText(phoneCall.from_number));
  const agent = toE164(asText(phoneCall.agent_number) ?? asText(phoneCall.to_number));

  const turns = (Array.isArray(data.transcript) ? data.transcript : [])
    .map(asObject)
    .map((turn) => ({ role: asText(turn.role) ?? 'unknown', message: asText(turn.message) ?? '' }))
    .filter((turn) => turn.message);

  const startUnix = asNumber(metadata.start_time_unix_secs);
  const durationSec = asNumber(metadata.call_duration_secs);
  const startedAt = startUnix === null ? null : new Date(startUnix * 1000);

  return {
    conversationId,
    direction,
    callerNumber: direction === 'inbound' ? external : agent,
    calledNumber: direction === 'inbound' ? agent : external,
    turns,
    transcript: turns.length > 0 ? turns.map((turn) => `${turn.role}: ${turn.message}`).join('\n') : null,
    summary: asText(analysis.transcript_summary),
    callSuccessful: asText(analysis.call_successful),
    durationSec: durationSec === null ? null : Math.round(durationSec),
    startedAt,
    endedAt: startedAt && durationSec !== null ? new Date(startedAt.getTime() + durationSec * 1000) : null,
    failed,
  };
}
