export function normalizePhone(input: string): string {
  return input.replace(/[^\d+]/g, '');
}

export function parseDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const dt = new Date(`${date}T${time}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function phoneMatchVariants(phone: string) {
  const normalized = normalizePhone(phone);
  return [normalized, normalized.replace(/^\+/, ''), '+' + normalized.replace(/^\+/, '')];
}
