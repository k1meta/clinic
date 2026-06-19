import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';

export const referralStatusEnum = pgEnum('referral_status', ['pending', 'completed', 'rewarded']);

export const referrals = pgTable('referrals', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  referrerPatientId: uuid('referrer_patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  referredPatientId: uuid('referred_patient_id').references(() => patients.id, { onDelete: 'set null' }),
  code: text('code').notNull(),
  status: referralStatusEnum('status').notNull().default('completed'),
  rewardNote: text('reward_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
