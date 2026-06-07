-- Run in Supabase SQL Editor if npm script times out on the pooler.
-- Maps owner -> admin, receptionist/doctor -> staff.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'admin'
  ) THEN
    RAISE NOTICE 'user_role already migrated';
  ELSE
    ALTER TYPE user_role RENAME TO user_role_old;
    CREATE TYPE user_role AS ENUM ('admin', 'staff');
    ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE users ALTER COLUMN role TYPE user_role
      USING (CASE role::text
        WHEN 'owner' THEN 'admin'
        ELSE 'staff'
      END)::user_role;
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'staff';
    DROP TYPE user_role_old;
  END IF;
END $$;
