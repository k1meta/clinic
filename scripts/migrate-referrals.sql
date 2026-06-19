-- Referral loop: per-patient referral code + referral events
-- Run: npm run db:migrate-referrals

DO $$ BEGIN
  CREATE TYPE referral_status AS ENUM ('pending', 'completed', 'rewarded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS referral_code text;

CREATE UNIQUE INDEX IF NOT EXISTS patients_referral_code_unique
  ON patients(referral_code) WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  referrer_patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  referred_patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  code text NOT NULL,
  status referral_status NOT NULL DEFAULT 'completed',
  reward_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referrals_clinic_id_idx ON referrals(clinic_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx ON referrals(clinic_id, code);
