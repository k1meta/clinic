import { DEFAULT_TEMPLATES } from './templates';

export type BusinessVertical = 'dental' | 'salon' | 'vet' | 'generic';

export interface VerticalLabels {
  customer: string;
  customers: string;
  provider: string;
  providers: string;
  service: string;
  appointment: string;
}

export const VERTICAL_LABELS: Record<BusinessVertical, VerticalLabels> = {
  dental: {
    customer: 'Patient',
    customers: 'Patients',
    provider: 'Doctor',
    providers: 'Doctors',
    service: 'Treatment',
    appointment: 'Appointment',
  },
  salon: {
    customer: 'Client',
    customers: 'Clients',
    provider: 'Stylist',
    providers: 'Stylists',
    service: 'Service',
    appointment: 'Booking',
  },
  vet: {
    customer: 'Pet Owner',
    customers: 'Pet Owners',
    provider: 'Veterinarian',
    providers: 'Veterinarians',
    service: 'Treatment',
    appointment: 'Appointment',
  },
  generic: {
    customer: 'Customer',
    customers: 'Customers',
    provider: 'Staff',
    providers: 'Staff',
    service: 'Service',
    appointment: 'Appointment',
  },
};

export const VERTICAL_TEMPLATE_PACKS: Record<BusinessVertical, Record<string, string>> = {
  dental: DEFAULT_TEMPLATES,
  salon: {
    reminder_48h:
      'Hi {{patient_name}}, reminder: your {{service}} is on {{date}} at {{time}} with {{doctor}}. Reply to confirm.',
    reminder_2h: 'Reminder: your appointment is today at {{time}} with {{doctor}}. See you soon!',
    post_visit: 'Thanks for visiting us, {{patient_name}}! We hope you love your new look.',
    re_engagement:
      'Hi {{patient_name}}, it has been a while since your last visit. Ready to book your next {{service}}?',
    review_request:
      'Hi {{patient_name}}, thanks for your first visit! If you have a moment, leave us a Google review: {{review_url}}',
  },
  vet: {
    reminder_48h:
      'Hello {{patient_name}}, reminder for your pet\'s appointment on {{date}} at {{time}} with {{doctor}}.',
    reminder_2h: 'Reminder: your pet\'s appointment is today at {{time}} with {{doctor}}.',
    post_visit: 'Thank you for bringing your pet in, {{patient_name}}! Let us know if you have any questions.',
    re_engagement:
      'Hello {{patient_name}}, it has been over 6 months since your last visit. Would you like to schedule a check-up?',
    review_request:
      'Thank you, {{patient_name}}! If you are happy with our care, a Google review helps other pet owners find us: {{review_url}}',
  },
  generic: DEFAULT_TEMPLATES,
};

export function getVerticalLabels(vertical: BusinessVertical): VerticalLabels {
  return VERTICAL_LABELS[vertical] ?? VERTICAL_LABELS.generic;
}

/** BCS role phrase for the AI assistant, tailored to the business vertical. */
const VERTICAL_ASSISTANT_ROLE: Record<BusinessVertical, string> = {
  dental: 'profesionalni recepcioner medicinske/stomatoloske klinike',
  salon: 'profesionalni recepcioner salona za uljepsavanje',
  vet: 'profesionalni recepcioner veterinarske klinike',
  generic: 'profesionalni recepcioner',
};

export function getVerticalAssistantRole(vertical: BusinessVertical): string {
  return VERTICAL_ASSISTANT_ROLE[vertical] ?? VERTICAL_ASSISTANT_ROLE.generic;
}

/**
 * Build the base BCS system prompt for the conversational assistant, tailored
 * to the clinic's vertical so salon/vet/generic tenants don't read as a medical
 * clinic.
 */
export function buildAssistantSystemPrompt(vertical: BusinessVertical): string {
  return [
    'Ti si ' + getVerticalAssistantRole(vertical) + '.',
    'Komuniciras na bosanskom/srpskom/hrvatskom jeziku, ili engleskom ako ti klijent pise na engleskom.',
    'Budi kratak, jasan i ljubazan. Ne koristi emojije.',
    'Koristi formalno obracanje (Vi).',
  ].join(' ');
}

export function isBusinessVertical(v: string): v is BusinessVertical {
  return v === 'dental' || v === 'salon' || v === 'vet' || v === 'generic';
}
