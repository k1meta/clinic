import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const sql = postgres(url, { prepare: false });
  const migration = readFileSync(join(__dirname, 'migrate-waitlist.sql'), 'utf8');
  await sql.unsafe(migration);
  await sql.end();
  console.log('Waiting list migration complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
