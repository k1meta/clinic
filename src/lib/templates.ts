export const DEFAULT_TEMPLATES: Record<string, string> = {
  reminder_48h:
    'Po\u0161tovani {{patient_name}}, podsje\u0107amo Vas na zakazani termin {{date}} u {{time}} kod dr. {{doctor}}. Molimo potvrdite dolazak.',
  reminder_2h:
    'Podsjetnik: Va\u0161 termin je danas u {{time}} kod dr. {{doctor}}. Vidimo se!',
  post_visit:
    'Hvala na posjeti, {{patient_name}}! Nadamo se da ste zadovoljni. Ako imate pitanja, javite nam se.',
  re_engagement:
    'Po\u0161tovani {{patient_name}}, primje\u0107ujemo da niste bili kod nas ve\u0107 du\u017ee vrijeme. \u017delite li zakazati termin? Javite nam se!',
  review_request:
    'Po\u0161tovani {{patient_name}}, hvala na prvoj posjeti! Ako imate trenutak, ostavite kratku recenziju na Googleu \u2014 poma\u017ee drugim pacijentima da nas prona\u0111u: {{review_url}}',
};

export interface TemplateVars {
  patient_name?: string;
  date?: string;
  time?: string;
  doctor?: string;
  clinic_name?: string;
  service?: string;
  /** Google Maps / Business review URL (review_request). */
  review_url?: string;
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    if (value) result = result.replaceAll('{{' + key + '}}', value);
  }
  return result;
}
