export type ElevenLabsPostCallPayload = {
  type?: string;
  event?: string;
  data?: {
    conversation_id?: string;
    agent_id?: string;
    status?: string;
    transcript?: Array<{ role?: string; message?: string; text?: string }>;
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

export function getElevenLabsTranscript(payload: ElevenLabsPostCallPayload): string {
  const turns = payload.data?.transcript;
  if (!Array.isArray(turns) || turns.length === 0) {
    return payload.data?.analysis?.transcript_summary ?? '';
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
