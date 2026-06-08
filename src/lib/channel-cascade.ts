export type OutboundChannel = 'whatsapp' | 'sms' | 'email';

const VALID: OutboundChannel[] = ['whatsapp', 'sms', 'email'];

/** Parse automations.channel — single channel or comma-separated cascade. */
export function parseChannelCascade(channel: string): OutboundChannel[] {
  const parts = channel.split(',').map((s) => s.trim().toLowerCase());
  const parsed = parts.filter((p): p is OutboundChannel => VALID.includes(p as OutboundChannel));
  return parsed.length > 0 ? parsed : ['whatsapp'];
}

/** Default cascade order when automation row has a single channel. */
export function defaultChannelForType(type: string): OutboundChannel {
  if (type === 'reminder_2h') return 'sms';
  return 'whatsapp';
}
