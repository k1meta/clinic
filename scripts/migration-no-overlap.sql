-- Migration: Prevent overlapping appointments per doctor
-- Run this in Supabase SQL editor

-- Required for GiST exclusion on non-range types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Exclusion constraint: no two active appointments for the same doctor can overlap.
-- Uses closed-open interval [starts_at, ends_at) so back-to-back is allowed.
-- Cancelled and no-show appointments are excluded from the check.
ALTER TABLE appointments ADD CONSTRAINT no_doctor_overlap
  EXCLUDE USING gist (
    doctor_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show'));