import { pgTable, uuid, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

export const treatmentTypes = pgTable('treatment_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  defaultDurationMin: integer('default_duration_min').notNull().default(30),
  price: integer('price'),
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurringIntervalDays: integer('recurring_interval_days'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});