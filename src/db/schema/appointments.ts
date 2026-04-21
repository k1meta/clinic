import { pgTable, uuid, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';
import { doctors } from './doctors';
import { treatmentTypes } from './treatment-types';

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'confirmed', 'arrived', 'completed', 'no_show', 'cancelled',
]);
export const appointmentSourceEnum = pgEnum('appointment_source', [
  'manual', 'voice_ai', 'online', 'whatsapp_ai', 'instagram_ai', 'messenger_ai',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'partial', 'paid', 'waived',
]);

export const appointments = pgTable('appointments', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  doctorId: uuid('doctor_id').notNull().references(() => doctors.id, { onDelete: 'cascade' }),
  treatmentTypeId: uuid('treatment_type_id').references(() => treatmentTypes.id),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: appointmentStatusEnum('status').notNull().default('confirmed'),
  source: appointmentSourceEnum('source').notNull().default('manual'),
  amountCharged: integer('amount_charged'),
  amountPaid: integer('amount_paid').notNull().default(0),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
  notes: text('notes'),
  cancelledReason: text('cancelled_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
