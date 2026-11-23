import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { clinics, doctors, treatmentTypes } from '@/db/schema';
import { getClinicSettings } from '@/db/queries/clinics';
import { describeWeekBs } from '@/lib/work-week';

export type ClinicVariables = {
  greeting: string;
  service_mode: 'active' | 'unavailable';
  clinic_name: string;
  clinic_hours: string;
  clinic_doctors: string;
  clinic_treatments: string;
};

/** Used when the clinic is unknown or the database is down: no clinic data, no bookings. */
export const FALLBACK_VARIABLES: ClinicVariables = {
  greeting: 'Dobar dan, ovdje virtuelni asistent. Trenutno ne mogu zakazivati termine. Molim Vas, nazovite kasnije.',
  service_mode: 'unavailable',
  clinic_name: 'ordinacija',
  clinic_hours: 'nepoznato',
  clinic_doctors: 'nepoznato',
  clinic_treatments: 'nepoznato',
};

export async function buildClinicVariables(clinicId: string): Promise<ClinicVariables> {
  const [settings, clinicRows, doctorRows, treatmentRows] = await Promise.all([
    getClinicSettings(clinicId),
    db.select({ name: clinics.name }).from(clinics).where(eq(clinics.id, clinicId)).limit(1),
    db
      .select({ fullName: doctors.fullName, specialty: doctors.specialty })
      .from(doctors)
      .where(and(eq(doctors.clinicId, clinicId), eq(doctors.isActive, true)))
      .orderBy(doctors.fullName),
    db
      .select({ name: treatmentTypes.name, durationMin: treatmentTypes.defaultDurationMin })
      .from(treatmentTypes)
      .where(eq(treatmentTypes.clinicId, clinicId))
      .orderBy(treatmentTypes.name),
  ]);
  const clinic = clinicRows[0];
  if (!clinic) return FALLBACK_VARIABLES;

  const base = {
    clinic_name: clinic.name,
    clinic_hours: describeWeekBs(settings.weekHours),
    clinic_doctors: doctorRows.map((d) => `${d.fullName} (${d.specialty})`).join(', ') || 'nema',
    clinic_treatments: treatmentRows.map((t) => `${t.name} (${t.durationMin} min)`).join(', ') || 'nema',
  };

  if (!settings.aiCalls) {
    return {
      ...base,
      service_mode: 'unavailable',
      greeting: `Dobar dan, dobili ste ${clinic.name}. Trenutno se ne možemo javiti. Molim Vas, nazovite kasnije.`,
    };
  }
  return {
    ...base,
    service_mode: 'active',
    greeting: `Dobar dan, dobili ste ${clinic.name}. Ja sam virtuelni AI asistent. Kako Vam mogu pomoći?`,
  };
}
