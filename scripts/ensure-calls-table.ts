/**
 * Creates call_direction / call_status enums and calls table if missing.
 * Idempotent. Run:
 *
 *   tsx --env-file=.env.local scripts/ensure-calls-table.ts
 */
import postgres from 'postgres';

function directDatabaseUrl(url: string): string {
  return url
    .replace('.pooler.supabase.com:6543', '.pooler.supabase.com:5432')
    .replace(':6543/', ':5432/');
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = postgres(directDatabaseUrl(url), { prepare: false, max: 1 });

  try {
    await sql.unsafe(`SET statement_timeout = '180s'`);

    const [exists] = await sql<{ reg: string | null }[]>`
      SELECT to_regclass('public.calls') AS reg
    `;
    if (exists?.reg) {
      console.log('calls table already exists.');
      return;
    }

    await sql.unsafe(`
      DO $$ BEGIN
        CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE call_status AS ENUM (
          'initiated', 'ringing', 'in_progress', 'completed', 'failed', 'transferred'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS calls (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
        appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
        provider text DEFAULT 'elevenlabs' NOT NULL,
        provider_call_id text NOT NULL UNIQUE,
        direction call_direction DEFAULT 'inbound' NOT NULL,
        status call_status DEFAULT 'initiated' NOT NULL,
        from_number text,
        to_number text,
        language text DEFAULT 'bs-BA' NOT NULL,
        transcript text,
        summary text,
        outcome text,
        duration_sec integer,
        metadata jsonb,
        started_at timestamptz,
        ended_at timestamptz,
        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL
      );
    `);

    console.log('calls table created.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
