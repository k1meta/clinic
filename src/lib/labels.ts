import { getClinicSettings } from '@/db/queries/clinics';
import { getVerticalLabels, type VerticalLabels } from '@/lib/verticals';

/** Server-side UI labels based on clinic vertical setting. */
export async function getLabelsForClinic(clinicId: string): Promise<VerticalLabels> {
  const settings = await getClinicSettings(clinicId);
  return getVerticalLabels(settings.vertical);
}
