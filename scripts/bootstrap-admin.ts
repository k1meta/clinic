/**
 * Links a Supabase Auth email to the demo clinic as admin.
 * Run after sign-up if no users row exists:
 *
 *   tsx --env-file=.env.local scripts/bootstrap-admin.ts you@email.com "Your Name"
 */
import postgres from 'postgres';

const DEMO_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const fullName = process.argv[3]?.trim() || 'Clinic Admin';

  if (!email) {
    console.error('Usage: tsx --env-file=.env.local scripts/bootstrap-admin.ts <email> [fullName]');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const directUrl = url
    .replace('.pooler.supabase.com:6543', '.pooler.supabase.com:5432')
    .replace(':6543/', ':5432/');
  const sql = postgres(directUrl, { prepare: false });

  try {
    const [existing] = await sql<{ id: string; role: string }[]>`
      SELECT id, role::text AS role FROM users WHERE email = ${email} LIMIT 1
    `;

    if (existing) {
      await sql`
        UPDATE users
        SET role = 'admin', is_active = true, full_name = ${fullName}, updated_at = now()
        WHERE email = ${email}
      `;
      console.log(`Updated existing user ${email} to admin.`);
    } else {
      await sql`
        INSERT INTO users (clinic_id, email, full_name, role, is_active)
        VALUES (${DEMO_CLINIC_ID}::uuid, ${email}, ${fullName}, 'admin', true)
      `;
      console.log(`Created admin user ${email} for demo clinic.`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
