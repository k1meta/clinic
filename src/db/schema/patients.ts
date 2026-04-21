import { pgTable, uuid, text, timestamp, date, pgEnum } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

export const patientStatusEnum = pgEnum('patient_status', ['new', 'active', 'inactive']);

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  email: text('email'),
  dob: date('dob'),
  gender: text('gender'),
  address: text('address'),
  emergencyContact: text('emergency_contact'),
  status: patientStatusEnum('status').notNull().default('new'),
  notes: text('notes'),
  optOutAt: timestamp('opt_out_at', { withTimezone: true }),
  whatsappId: text('whatsapp_id'),
  instagramId: text('instagram_id'),
  messengerId: text('messenger_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
