-- Landing numbers for the voice agent. Additive and safe to run more than once.
CREATE TABLE IF NOT EXISTS voice_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  e164 text NOT NULL UNIQUE,
  provider text NOT NULL,
  elevenlabs_phone_number_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_numbers_clinic ON voice_numbers (clinic_id);

-- The app connects as the database owner, which bypasses RLS. With RLS on and no
-- policies, Supabase's public anon key cannot read or change call routing.
ALTER TABLE voice_numbers ENABLE ROW LEVEL SECURITY;

ALTER TABLE calls ALTER COLUMN provider SET DEFAULT 'elevenlabs';
