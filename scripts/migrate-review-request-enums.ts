/**
 * Adds `review_request` to Postgres enums `message_type` and `automation_type`.
 * Idempotent (safe to re-run). Run after pulling schema changes:
 *
 *   tsx --env-file=.env.local scripts/migrate-review-request-enums.ts
 */
import postgres from 'postgres';

async function addEnumValue(sql: postgres.Sql, enumName: string, value: string) {
  await sql.unsafe(`
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
    WHERE t.typname = '${enumName}' AND e.enumlabel = '${value}'
  ) THEN
    ALTER TYPE ${enumName} ADD VALUE '${value}';
  END IF;
END $$;
`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = postgres(url, { prepare: false });
  try {
    await addEnumValue(sql, 'message_type', 'review_request');
    await addEnumValue(sql, 'automation_type', 'review_request');
    console.log('Enum values review_request ensured on message_type and automation_type.');
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
