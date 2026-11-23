import { pgEnum, pgTable, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';
import { appointments } from './appointments';

export const callDirectionEnum = pgEnum('call_direction', ['inbound', 'outbound']);
export const callStatusEnum = pgEnum('call_status', [
  'initiated',
  'ringing',
  'in_progress',
  'completed',
  'failed',
  'transferred',
]);

export const calls = pgTable('calls', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  provider: text('provider').notNull().default('elevenlabs'),
  providerCallId: text('provider_call_id').notNull().unique(),
  direction: callDirectionEnum('direction').notNull().default('inbound'),
  status: callStatusEnum('status').notNull().default('initiated'),
  fromNumber: text('from_number'),
  toNumber: text('to_number'),
  language: text('language').notNull().default('bs'),
  transcript: text('transcript'),
  summary: text('summary'),
  outcome: text('outcome'),
  durationSec: integer('duration_sec'),
  metadata: jsonb('metadata'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
