import { pgTable, uuid, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

export const userRoleEnum = pgEnum('user_role', ['admin', 'staff']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: userRoleEnum('role').notNull().default('staff'),
  clerkUserId: text('clerk_user_id').unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
