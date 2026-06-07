/**
 * Migrates user_role enum from owner|receptionist|doctor to admin|staff.
 * Idempotent when already migrated. Run:
 *
 *   tsx --env-file=.env.local scripts/migrate-user-roles.ts
 */
import postgres from 'postgres';

function directDatabaseUrl(url: string): string {
  // Supabase transaction pooler (6543) can block DDL; use session/direct port for migrations.
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
    const [row] = await sql<{ typname: string }[]>`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'admin'
      LIMIT 1
    `;

    if (row) {
      console.log('user_role enum already migrated to admin|staff.');
      return;
    }

    await sql.unsafe(`
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
    `);

    console.log('Migrated user_role: owner→admin, receptionist/doctor→staff.');
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
