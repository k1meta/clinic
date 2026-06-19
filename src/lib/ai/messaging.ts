import { generateResponse } from './llm';
import { buildAssistantSystemPrompt, type BusinessVertical } from '@/lib/verticals';
import type { TimeSlot } from '../availability';

export async function generateRescheduleOptions(
  patientName: string,
  slots: TimeSlot[],
  vertical: BusinessVertical = 'dental',
): Promise<string> {
  if (slots.length === 0) {
    return 'Nema dostupnih termina u narednih 14 dana. Molimo kontaktirajte nas telefonom.';
  }

  const slotList = slots
    .map((s, i) => (i + 1) + '. ' + s.date + ' u ' + s.start)
    .join('\n');

  const prompt = 'Klijent ' + patientName + ' zeli da pomjeri termin. Ponudi mu sljedece slobodne termine:\n' + slotList + '\nNapisi kratku poruku sa ponudjenim terminima.';

  return generateResponse(buildAssistantSystemPrompt(vertical), prompt, 200);
}

export async function generateConfirmation(
  patientName: string,
  date: string,
  time: string,
  doctorName: string,
  vertical: BusinessVertical = 'dental',
): Promise<string> {
  const prompt = 'Klijent ' + patientName + ' je potvrdio termin za ' + date + ' u ' + time + ' kod ' + doctorName + '. Napisi kratku potvrdu.';
  return generateResponse(buildAssistantSystemPrompt(vertical), prompt, 150);
}

export async function generateCancellationAck(
  patientName: string,
  vertical: BusinessVertical = 'dental',
): Promise<string> {
  const prompt = 'Klijent ' + patientName + ' je otkazao termin. Napisi kratku potvrdu otkazivanja i pozovi ih da zakazu ponovo kad im odgovara.';
  return generateResponse(buildAssistantSystemPrompt(vertical), prompt, 150);
}
