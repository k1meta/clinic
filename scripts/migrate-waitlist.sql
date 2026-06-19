-- Waiting list: patients waiting for a freed/earlier slot
-- Run: npm run db:migrate-waitlist

DO $$ BEGIN
  CREATE TYPE waitlist_status AS ENUM ('active', 'notified', 'booked', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_type_id uuid REFERENCES treatment_types(id) ON DELETE SET NULL,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  preferred_from date,
  preferred_to date,
  note text,
  status waitlist_status NOT NULL DEFAULT 'active',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waiting_list_clinic_id_idx ON waiting_list(clinic_id);
CREATE INDEX IF NOT EXISTS waiting_list_status_idx ON waiting_list(clinic_id, status);
