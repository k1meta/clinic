import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { patients } from '@/db/schema';
import { phoneDigitVariants, toE164 } from '@/lib/phone';
import { countNameParts, nameMatches, sameFullName } from '@/lib/voice/names';

export const PLACEHOLDER_PATIENT_NAME = 'Nepoznati pacijent';

export type PatientRow = { id: string; fullName: string; phone: string | null; status: string };

export async function findPatientsByPhone(clinicId: string, phone: string | null): Promise<PatientRow[]> {
  const variants = phone ? phoneDigitVariants(phone) : [];
  if (variants.length === 0) return [];
  return db
    .select({ id: patients.id, fullName: patients.fullName, phone: patients.phone, status: patients.status })
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, clinicId),
        inArray(sql`regexp_replace(coalesce(${patients.phone}, ''), '[^0-9]', '', 'g')`, variants),
      ),
    )
    .orderBy(patients.createdAt);
}

export type BookingPatient =
  | { kind: 'existing'; patient: PatientRow; renameTo?: string }
  | { kind: 'new'; fullName: string; phone: string };

export type BookingPatientResult =
  | { ok: true; value: BookingPatient }
  | { ok: false; code: 'missing_patient_name' | 'missing_patient_phone' | 'ambiguous_patient'; error: string };

/**
 * Decide whose appointment this is.
 *
 * - Caller ID may select an existing patient.
 * - A spoken phone number selects an existing patient only together with the exact
 *   full name; otherwise it only registers a new patient.
 * - A spoken name that differs from the caller's record (booking for a child, say)
 *   registers a new patient instead of booking under the caller.
 */
export function chooseBookingPatient(input: {
  callerNumber: string | null;
  callerMatches: PatientRow[];
  spokenName?: string;
  spokenPhone?: string;
  spokenMatches: PatientRow[];
}): BookingPatientResult {
  const { callerNumber, callerMatches, spokenName, spokenMatches } = input;

  if (!spokenName) {
    const known = callerMatches.filter((p) => p.fullName !== PLACEHOLDER_PATIENT_NAME);
    if (known.length === 1 && callerMatches.length === 1) {
      return { ok: true, value: { kind: 'existing', patient: known[0] } };
    }
    if (callerMatches.length > 1) {
      return {
        ok: false,
        code: 'ambiguous_patient',
        error: 'Više pacijenata koristi ovaj broj. Pitaj za koga je termin (ime i prezime).',
      };
    }
    return {
      ok: false,
      code: 'missing_patient_name',
      error: 'Potrebno je ime i prezime pacijenta. Pitaj pozivaoca.',
    };
  }

  const exact = callerMatches.filter((p) => sameFullName(spokenName, p.fullName));
  if (exact.length > 0) return { ok: true, value: { kind: 'existing', patient: exact[0] } };

  const partial = callerMatches.filter((p) => nameMatches(spokenName, p.fullName));
  if (partial.length === 1) return { ok: true, value: { kind: 'existing', patient: partial[0] } };
  if (partial.length > 1) {
    return { ok: false, code: 'ambiguous_patient', error: 'Pitaj za puno ime i prezime pacijenta.' };
  }

  const spoken = spokenMatches.filter((p) => sameFullName(spokenName, p.fullName));
  if (spoken.length > 0) return { ok: true, value: { kind: 'existing', patient: spoken[0] } };

  if (countNameParts(spokenName) < 2) {
    return { ok: false, code: 'missing_patient_name', error: 'Potrebno je i ime i prezime pacijenta.' };
  }

  const placeholder = callerMatches.find((p) => p.fullName === PLACEHOLDER_PATIENT_NAME);
  if (placeholder && callerMatches.length === 1) {
    return { ok: true, value: { kind: 'existing', patient: placeholder, renameTo: spokenName } };
  }

  const phone = toE164(input.spokenPhone) ?? callerNumber;
  if (!phone) {
    return {
      ok: false,
      code: 'missing_patient_phone',
      error: 'Broj pozivaoca nije vidljiv ili je neispravan. Pitaj za broj telefona i ponovi ga cifru po cifru.',
    };
  }
  return { ok: true, value: { kind: 'new', fullName: spokenName, phone } };
}

export async function resolveBookingPatient(params: {
  clinicId: string;
  callerNumber: string | null;
  spokenName?: string;
  spokenPhone?: string;
}): Promise<BookingPatientResult> {
  const spokenE164 = toE164(params.spokenPhone);
  const [callerMatches, spokenMatches] = await Promise.all([
    findPatientsByPhone(params.clinicId, params.callerNumber),
    spokenE164 && spokenE164 !== params.callerNumber
      ? findPatientsByPhone(params.clinicId, spokenE164)
      : Promise.resolve([]),
  ]);
  return chooseBookingPatient({ ...params, callerMatches, spokenMatches });
}

export type VerifiedPatientResult =
  | { ok: true; patient: PatientRow }
  | { ok: false; code: 'caller_not_verified' | 'ambiguous_patient'; error: string };

/**
 * Who may see, move or cancel an appointment. Caller ID is the only accepted proof:
 * deliberately takes no spoken phone number.
 */
export function chooseVerifiedPatient(callerMatches: PatientRow[], spokenName?: string): VerifiedPatientResult {
  if (callerMatches.length === 0) {
    return {
      ok: false,
      code: 'caller_not_verified',
      error:
        'Poziv ne dolazi s broja koji je u kartonu, pa promjena nije moguća preko telefona. Ponudi take_message da osoblje nazove pacijenta.',
    };
  }
  if (!spokenName) {
    if (callerMatches.length === 1) return { ok: true, patient: callerMatches[0] };
    return {
      ok: false,
      code: 'ambiguous_patient',
      error: 'Više pacijenata koristi ovaj broj. Pitaj za ime i prezime pacijenta.',
    };
  }
  const exact = callerMatches.filter((p) => sameFullName(spokenName, p.fullName));
  const matches = exact.length > 0 ? exact : callerMatches.filter((p) => nameMatches(spokenName, p.fullName));
  if (matches.length === 1) return { ok: true, patient: matches[0] };
  if (matches.length > 1) {
    return { ok: false, code: 'ambiguous_patient', error: 'Pitaj za puno ime i prezime pacijenta.' };
  }
  return {
    ok: false,
    code: 'caller_not_verified',
    error: 'Ime ne odgovara broju s kojeg se zove. Ponudi take_message da osoblje nazove pacijenta.',
  };
}

export async function resolveVerifiedPatient(
  clinicId: string,
  callerNumber: string | null,
  spokenName?: string,
): Promise<VerifiedPatientResult> {
  return chooseVerifiedPatient(await findPatientsByPhone(clinicId, callerNumber), spokenName);
}
