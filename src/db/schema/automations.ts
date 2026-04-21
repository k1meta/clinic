import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

export const automationTypeEnum = pgEnum('automation_type', [
  'reminder_48h', 'reminder_2h', 'post_visit', 're_engagement',
]);

export const automations = pgTable('automations', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  type: automationTypeEnum('type').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  channel: text('channel').notNull().default('whatsapp'),
  templateContent: text('template_content').notNull(),
  quietHoursStart: integer('quiet_hours_start').notNull().default(21),
  quietHoursEnd: integer('quiet_hours_end').notNull().default(8),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
