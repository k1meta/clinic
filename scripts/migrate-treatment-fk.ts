/**
 * One-off migration: swap appointments.treatment_type_id FK to ON DELETE SET NULL.
 *
 * `npm run db:push` choked on a drizzle-kit CHECK-constraint introspection bug,
 * so we apply the change directly via SQL. Idempotent: drops the existing FK
 * constraint first (regardless of its drizzle-generated name) then recreates it.
 *
 * Run with: tsx --env-file=.env.local scripts/migrate-treatment-fk.ts
 */
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = postgres(url, { prepare: false });

  try {
    // Find any existing FK on appointments.treatment_type_id (drizzle's auto-name varies).
    const existing = await sql<{ constraint_name: string }[]>`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'appointments'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'treatment_type_id'
    `;

    for (const row of existing) {
      console.log('Dropping FK', row.constraint_name);
      await sql.unsafe(
        `ALTER TABLE "appointments" DROP CONSTRAINT "${row.constraint_name}"`
      );
    }

    console.log('Adding FK with ON DELETE SET NULL');
    await sql`
      ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_treatment_type_id_treatment_types_id_fk"
      FOREIGN KEY ("treatment_type_id")
      REFERENCES "treatment_types"("id")
      ON DELETE SET NULL
    `;

    console.log('Done.');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
