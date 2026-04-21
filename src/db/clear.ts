import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

async function clearData() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  console.log('Clearing seed/dummy data (preserving users and clinic)...\n');

  const appts = await db.execute(sql`DELETE FROM appointments RETURNING id`);
  console.log(`  Deleted ${appts.length} appointments`);

  const pts = await db.execute(sql`DELETE FROM patients RETURNING id`);
  console.log(`  Deleted ${pts.length} patients`);

  const tts = await db.execute(sql`DELETE FROM treatment_types RETURNING id`);
  console.log(`  Deleted ${tts.length} treatment types`);

  const docs = await db.execute(sql`DELETE FROM doctors RETURNING id`);
  console.log(`  Deleted ${docs.length} doctors`);

  console.log('\n  Kept users and clinics intact.');
  console.log('\nDone! Your login and clinic are preserved.');
  await client.end();
}

clearData().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});