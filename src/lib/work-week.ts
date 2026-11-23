export interface DayHours {
  start: number; // hour
  end: number;   // hour
}

/** Index 0 = Sunday … 6 = Saturday; null = closed. */
export type WeekHours = (DayHours | null)[];

/** Monday first, for forms and spoken summaries. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const DAY_NAMES_BS = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];

function isDayHours(value: unknown): value is DayHours {
  if (!value || typeof value !== 'object') return false;
  const { start, end } = value as Record<string, unknown>;
  return (
    Number.isInteger(start) && Number.isInteger(end) &&
    (start as number) >= 0 && (end as number) <= 23 && (end as number) > (start as number)
  );
}

/** Clinics saved before per-day hours existed keep Monday–Friday with their old hours. */
export function resolveWeekHours(raw: unknown, legacy: DayHours): WeekHours {
  if (Array.isArray(raw) && raw.length === 7 && raw.every((day) => day === null || isDayHours(day))) {
    return raw.map((day: DayHours | null) => (day ? { start: day.start, end: day.end } : null));
  }
  return Array.from({ length: 7 }, (_, day) => (day === 0 || day === 6 ? null : { ...legacy }));
}

/** Earliest opening and latest closing across the week, for the calendar grid. */
export function weekEnvelope(week: WeekHours, fallback: DayHours): DayHours {
  const open = week.filter((day): day is DayHours => day !== null);
  if (open.length === 0) return fallback;
  return { start: Math.min(...open.map((d) => d.start)), end: Math.max(...open.map((d) => d.end)) };
}

/** "ponedjeljak do petak 8:00 do 17:00, subota 9:00 do 13:00" */
export function describeWeekBs(week: WeekHours): string {
  const groups: { first: number; last: number; hours: DayHours }[] = [];
  for (const [position, day] of WEEK_ORDER.entries()) {
    const hours = week[day];
    if (!hours) continue;
    const previous = groups[groups.length - 1];
    if (previous && previous.last === position - 1 && previous.hours.start === hours.start && previous.hours.end === hours.end) {
      previous.last = position;
    } else {
      groups.push({ first: position, last: position, hours });
    }
  }
  if (groups.length === 0) return 'trenutno zatvoreno';
  const name = (position: number) => DAY_NAMES_BS[WEEK_ORDER[position]];
  return groups
    .map(({ first, last, hours }) => {
      const days = first === last ? name(first) : last === first + 1 ? `${name(first)} i ${name(last)}` : `${name(first)} do ${name(last)}`;
      return `${days} ${hours.start}:00 do ${hours.end}:00`;
    })
    .join(', ');
}
