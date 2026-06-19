import { pgTable, uuid, text, timestamp, date, pgEnum } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';
import { doctors } from './doctors';
import { treatmentTypes } from './treatment-types';

export const waitlistStatusEnum = pgEnum('waitlist_status', [
  'active', 'notified', 'booked', 'cancelled',
]);

export const waitingList = pgTable('waiting_list', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  treatmentTypeId: uuid('treatment_type_id').references(() => treatmentTypes.id, { onDelete: 'set null' }),
  doctorId: uuid('doctor_id').references(() => doctors.id, { onDelete: 'set null' }),
  preferredFrom: date('preferred_from'),
  preferredTo: date('preferred_to'),
  note: text('note'),
  status: waitlistStatusEnum('status').notNull().default('active'),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
