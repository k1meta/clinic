-- Migration: Add AI channel support
-- Run this in Supabase SQL editor or via psql

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'message_channel'::regtype AND enumlabel = 'instagram') THEN
    ALTER TYPE message_channel ADD VALUE 'instagram';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'message_channel'::regtype AND enumlabel = 'messenger') THEN
    ALTER TYPE message_channel ADD VALUE 'messenger';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'appointment_source'::regtype AND enumlabel = 'whatsapp_ai') THEN
    ALTER TYPE appointment_source ADD VALUE 'whatsapp_ai';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'appointment_source'::regtype AND enumlabel = 'instagram_ai') THEN
    ALTER TYPE appointment_source ADD VALUE 'instagram_ai';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'appointment_source'::regtype AND enumlabel = 'messenger_ai') THEN
    ALTER TYPE appointment_source ADD VALUE 'messenger_ai';
  END IF;
END $$;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS whatsapp_id TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS instagram_id TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS messenger_id TEXT;

CREATE INDEX IF NOT EXISTS idx_patients_whatsapp_id ON patients(clinic_id, whatsapp_id) WHERE whatsapp_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_instagram_id ON patients(clinic_id, instagram_id) WHERE instagram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_messenger_id ON patients(clinic_id, messenger_id) WHERE messenger_id IS NOT NULL;