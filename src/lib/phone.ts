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

const DEFAULT_COUNTRY_CODE = '387';

/**
 * Parse a phone number to E.164. Local numbers (061…, 033…) are read as Bosnian.
 * Returns null for hidden ("anonymous") or implausible numbers.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, '');
  let digits = cleaned.replace(/\D/g, '');
  const international = cleaned.startsWith('+') || digits.startsWith('00');

  if (!cleaned.startsWith('+') && digits.startsWith('00')) digits = digits.slice(2);

  if (!international) {
    if (digits.startsWith('0')) {
      digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
    } else if (digits.length === 8 && !digits.startsWith(DEFAULT_COUNTRY_CODE)) {
      digits = DEFAULT_COUNTRY_CODE + digits;
    }
  }

  // "+387 (0)61 …": drop the national trunk zero people leave in.
  if (digits.startsWith(DEFAULT_COUNTRY_CODE + '0')) {
    digits = DEFAULT_COUNTRY_CODE + digits.slice(DEFAULT_COUNTRY_CODE.length + 1);
  }

  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return '+' + digits;
}

/** Digit-only spellings under which the same number may be stored in older rows. */
export function phoneDigitVariants(raw: string): string[] {
  const e164 = toE164(raw);
  if (!e164) return [];
  const digits = e164.slice(1);
  const variants = [digits, '00' + digits];
  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    const national = digits.slice(DEFAULT_COUNTRY_CODE.length);
    variants.push('0' + national, DEFAULT_COUNTRY_CODE + '0' + national, national);
  }
  return variants;
}
