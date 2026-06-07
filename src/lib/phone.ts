/** Strip to digits only for WhatsApp Cloud API (E.164 without +). */
export function normalizeForWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 8) {
    throw new Error('Invalid phone number for WhatsApp.');
  }
  return digits;
}

/** Normalize to E.164 with leading + for Twilio SMS. */
export function normalizeForSms(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 8) {
    throw new Error('Invalid phone number for SMS.');
  }
  return '+' + digits;
}
