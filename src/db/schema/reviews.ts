import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';

export const reviews = pgTable('reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  externalReviewId: text('external_review_id'),
  author: text('author').notNull(),
  rating: integer('rating').notNull(),
  content: text('content'),
  replyDraft: text('reply_draft'),
  replyPostedAt: timestamp('reply_posted_at', { withTimezone: true }),
  source: text('source').notNull().default('google'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
