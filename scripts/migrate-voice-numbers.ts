import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

/** npm run db:migrate-voice */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await sql.unsafe(readFileSync(join(__dirname, 'migrate-voice-numbers.sql'), 'utf8'));
    console.log('voice_numbers migration complete.');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
