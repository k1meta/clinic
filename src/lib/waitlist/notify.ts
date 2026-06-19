import { db } from '@/db';
import { waitingList } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getMatchingWaitlist } from '@/db/queries/waiting-list';
import { sendMessageWithCascade } from '@/lib/messaging';

const WEEKDAYS = ['Ned', 'Pon', 'Uto', 'Sri', 'Cet', 'Pet', 'Sub'];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return WEEKDAYS[d.getDay()] + ' ' + dateStr.slice(8) + '.' + dateStr.slice(5, 7) + '.';
}

/**
 * A slot just opened (cancellation). Offer it to matching waiting-list patients
 * via SMS (falls back to WhatsApp). Marks each offered entry as 'notified'.
 * Returns how many patients were notified. Caps to avoid blasting everyone.
 */
export async function notifyWaitlistSlotOpened(params: {
  clinicId: string;
  treatmentTypeId: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  maxOffers?: number;
}): Promise<number> {
  const { clinicId, treatmentTypeId, date, time } = params;
  const maxOffers = params.maxOffers ?? 5;

  const matches = await getMatchingWaitlist(clinicId, treatmentTypeId, date);
  if (matches.length === 0) return 0;

  const dateLabel = formatDateLabel(date);
  let notified = 0;

  for (const m of matches.slice(0, maxOffers)) {
    const content =
      'Postovani/a, oslobodio se termin ' + dateLabel + ' u ' + time +
      '. Ako Vam odgovara, javite nam se da Vas zakazemo. Hvala!';
    try {
      const res = await sendMessageWithCascade({
        clinicId,
        patientId: m.patientId,
        type: 'system',
        content,
        channelConfig: 'sms,whatsapp',
        metadata: { kind: 'waitlist_offer', date, time },
        skipAutomationChecks: true,
      });
      if (!('skipped' in res)) {
        await db
          .update(waitingList)
          .set({ status: 'notified', notifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(waitingList.id, m.id));
        notified++;
      }
    } catch (err) {
      console.error('[waitlist] notify failed:', err instanceof Error ? err.message : err);
    }
  }

  return notified;
}
