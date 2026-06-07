import twilio from 'twilio';
import { normalizeForSms } from '@/lib/phone';

let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set');
    _client = twilio(sid, token);
  }
  return _client;
}

export interface SmsResult {
  externalId: string;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('TWILIO_PHONE_NUMBER is not set');

  const message = await getClient().messages.create({ to: normalizeForSms(to), from, body });
  return { externalId: message.sid };
}
