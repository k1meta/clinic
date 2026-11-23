import { toE164 } from '@/lib/phone';

/**
 * Tool body sent by ElevenLabs. The three identity fields are bound to system
 * variables in config/voice/agent.ts, so the language model cannot set them.
 * Everything else in the body is model-written and must not be trusted for identity.
 */
export const IDENTITY_FIELDS = ['conversation_id', 'caller_number', 'called_number'] as const;

export type VoiceToolRequest = {
  conversationId: string;
  callerNumber: string | null;
  calledNumber: string | null;
  args: Record<string, unknown>;
};

export function parseVoiceToolRequest(body: unknown): VoiceToolRequest | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const payload = body as Record<string, unknown>;

  const conversationId = readText(payload.conversation_id, 200);
  if (!conversationId) return null;

  const args = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !(IDENTITY_FIELDS as readonly string[]).includes(key)),
  );

  return {
    conversationId,
    callerNumber: toE164(readText(payload.caller_number, 40)),
    calledNumber: toE164(readText(payload.called_number, 40)),
    args,
  };
}

/** Trimmed, length-limited string; undefined for blanks and unfilled {{placeholders}}. */
export function readText(value: unknown, maxLength = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text || /^\{\{.*\}\}$/.test(text)) return undefined;
  return text.slice(0, maxLength);
}

/** "9:30" → "09:30"; anything unparseable is returned as is and rejected later. */
export function readTime(value: unknown): string | undefined {
  const text = readText(value, 10);
  const match = text?.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : text;
}
