import { generateResponse } from './llm';
import type { TimeSlot } from '../availability';

const SYSTEM_PROMPT = [
  'Ti si profesionalni medicinski recepcioner klinike.',
  'Komuniciras na bosanskom/srpskom/hrvatskom jeziku.',
  'Budi kratak, jasan i ljubazan. Ne koristi emojije.',
  'Koristi formalno obracanje (Vi).',
].join(' ');

export async function generateRescheduleOptions(
  patientName: string,
  slots: TimeSlot[],
): Promise<string> {
  if (slots.length === 0) {
    return 'Nema dostupnih termina u narednih 14 dana. Molimo kontaktirajte nas telefonom.';
  }

  const slotList = slots
    .map((s, i) => (i + 1) + '. ' + s.date + ' u ' + s.start)
    .join('\n');

  const prompt = 'Pacijent ' + patientName + ' zeli da pomjeri termin. Ponudi mu sljedece slobodne termine:\n' + slotList + '\nNapisi kratku poruku sa ponudjenim terminima.';

  return generateResponse(SYSTEM_PROMPT, prompt, 200);
}

export async function generateConfirmation(
  patientName: string,
  date: string,
  time: string,
  doctorName: string,
): Promise<string> {
  const prompt = 'Pacijent ' + patientName + ' je potvrdio termin za ' + date + ' u ' + time + ' kod dr. ' + doctorName + '. Napisi kratku potvrdu.';
  return generateResponse(SYSTEM_PROMPT, prompt, 150);
}

export async function generateCancellationAck(patientName: string): Promise<string> {
  const prompt = 'Pacijent ' + patientName + ' je otkazao termin. Napisi kratku potvrdu otkazivanja i pozovi ih da zakazu ponovo kad im odgovara.';
  return generateResponse(SYSTEM_PROMPT, prompt, 150);
}
