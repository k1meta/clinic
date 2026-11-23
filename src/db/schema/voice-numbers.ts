import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

/** Landing numbers the AI answers. Each number belongs to exactly one clinic. */
export const voiceNumbers = pgTable('voice_numbers', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
  e164: text('e164').notNull().unique(),
  /** Who sells the number: telnyx, zadarma, sim_gateway, sip_test… */
  provider: text('provider').notNull(),
  elevenlabsPhoneNumberId: text('elevenlabs_phone_number_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
