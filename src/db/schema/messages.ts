import { pgTable, uuid, text, timestamp, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';
import { appointments } from './appointments';

export const messageChannelEnum = pgEnum('message_channel', ['whatsapp', 'sms', 'email', 'instagram', 'messenger']);
export const messageDirectionEnum = pgEnum('message_direction', ['outbound', 'inbound']);
export const messageTypeEnum = pgEnum('message_type', [
  'reminder_48h', 'reminder_2h', 'post_visit', 're_engagement', 'review_request',
  'confirmation', 'cancellation', 'reschedule', 'freetext', 'system', 'campaign',
]);
export const messageStatusEnum = pgEnum('message_status', [
  'queued', 'sent', 'delivered', 'read', 'failed',
]);

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  channel: messageChannelEnum('channel').notNull(),
  direction: messageDirectionEnum('direction').notNull(),
  type: messageTypeEnum('type').notNull(),
  status: messageStatusEnum('status').notNull().default('queued'),
  content: text('content').notNull(),
  externalId: text('external_id'),
  metadata: jsonb('metadata'),
  readByStaff: boolean('read_by_staff').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
