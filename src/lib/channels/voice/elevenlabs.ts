export type TranscriptTurn = {
  role?: string;
  message?: string;
  text?: string;
};

export type ElevenLabsPostCallPayload = {
  type?: string;
  event?: string;
  data?: {
    conversation_id?: string;
    agent_id?: string;
    status?: string;
    transcript?: TranscriptTurn[];
    analysis?: {
      transcript_summary?: string;
      call_successful?: string;
    };
    metadata?: {
      phone_call?: {
        from_number?: string;
        to_number?: string;
        direction?: string;
      };
      start_time_unix_secs?: number;
      end_time_unix_secs?: number;
      call_duration_secs?: number;
    };
    conversation_initiation_client_data?: {
      dynamic_variables?: Record<string, unknown>;
    };
  };
};

export function getElevenLabsEventType(payload: ElevenLabsPostCallPayload): string {
  return (payload.type ?? payload.event ?? 'unknown').toString();
}

export function getElevenLabsConversationId(payload: ElevenLabsPostCallPayload): string | null {
  const id = payload.data?.conversation_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function getElevenLabsClinicId(payload: ElevenLabsPostCallPayload): string | null {
  const vars = payload.data?.conversation_initiation_client_data?.dynamic_variables ?? {};
  const candidate = vars.clinicId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

export function getElevenLabsFromNumber(payload: ElevenLabsPostCallPayload): string | null {
  const phone = payload.data?.metadata?.phone_call?.from_number;
  return typeof phone === 'string' && phone.length > 0 ? phone : null;
}

export function getElevenLabsToNumber(payload: ElevenLabsPostCallPayload): string | null {
  const phone = payload.data?.metadata?.phone_call?.to_number;
  return typeof phone === 'string' && phone.length > 0 ? phone : null;
}

export function getElevenLabsTranscriptTurns(payload: ElevenLabsPostCallPayload): TranscriptTurn[] {
  const data = payload.data as Record<string, unknown> | undefined;
  const direct = payload.data?.transcript;
  if (Array.isArray(direct) && direct.length > 0) return direct;

  const nested = data?.conversation_transcript ?? data?.transcription;
  if (Array.isArray(nested)) return nested as TranscriptTurn[];

  return [];
}

export function getElevenLabsSummary(payload: ElevenLabsPostCallPayload): string {
  const summary = payload.data?.analysis?.transcript_summary;
  if (typeof summary === 'string' && summary.trim()) return summary.trim();

  const data = payload.data as Record<string, unknown> | undefined;
  const alt = data?.summary ?? data?.call_summary;
  return typeof alt === 'string' ? alt.trim() : '';
}

export function isElevenLabsPostCallEvent(payload: ElevenLabsPostCallPayload): boolean {
  const eventType = getElevenLabsEventType(payload).toLowerCase();
  return (
    eventType.includes('post_call') ||
    eventType.includes('transcription') ||
    eventType.includes('conversation_end') ||
    eventType.includes('call_end') ||
    payload.data?.status === 'done'
  );
}

export function getElevenLabsTranscript(payload: ElevenLabsPostCallPayload): string {
  const turns = getElevenLabsTranscriptTurns(payload);
  if (turns.length === 0) {
    return getElevenLabsSummary(payload);
  }

  return turns
    .map((turn) => {
      const role = turn.role ?? 'unknown';
      const text = turn.message ?? turn.text ?? '';
      return `${role}: ${text}`.trim();
    })
    .filter(Boolean)
    .join('\n');
}

export function getElevenLabsDurationSec(payload: ElevenLabsPostCallPayload): number | null {
  const direct = payload.data?.metadata?.call_duration_secs;
  if (typeof direct === 'number' && direct > 0) return direct;

  const start = payload.data?.metadata?.start_time_unix_secs;
  const end = payload.data?.metadata?.end_time_unix_secs;
  if (typeof start === 'number' && typeof end === 'number' && end >= start) {
    return end - start;
  }
  return null;
}

export function parseElevenLabsPayload(raw: string): ElevenLabsPostCallPayload {
  return JSON.parse(raw) as ElevenLabsPostCallPayload;
}
