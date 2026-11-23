import { createHmac, timingSafeEqual } from 'crypto';

/** Both checks fail closed: a missing secret rejects every request. */

const MAX_SIGNATURE_AGE_MS = 30 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function usableSecret(secret: string | undefined): secret is string {
  return Boolean(secret) && secret !== 'replace_me';
}

/** Tool calls and the initiation webhook. */
export function verifyVoiceBearer(
  authorization: string | null,
  secret: string | undefined = process.env.VOICE_TOOLS_API_KEY,
): boolean {
  if (!usableSecret(secret) || !authorization?.startsWith('Bearer ')) return false;
  return safeEqual(authorization.slice('Bearer '.length), secret);
}

/** Post-call webhook: `ElevenLabs-Signature: t=<unix>,v0=<hmac>`. */
export function verifyElevenLabsSignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined = process.env.ELEVENLABS_WEBHOOK_SECRET,
  nowMs: number = Date.now(),
): boolean {
  if (!usableSecret(secret) || !header) return false;

  const parts = header.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v0='));
  if (!timestamp || signatures.length === 0) return false;

  const signedAt = Number(timestamp) * 1000;
  if (!Number.isFinite(signedAt)) return false;
  if (signedAt < nowMs - MAX_SIGNATURE_AGE_MS || signedAt > nowMs + MAX_CLOCK_SKEW_MS) return false;

  const expected = 'v0=' + createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return signatures.some((signature) => safeEqual(expected, signature));
}
