import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/db';
import { appointments, patients, messages, automations } from '../src/db/schema';
import { eq, like } from 'drizzle-orm';
import { scan48hReminders } from '../src/jobs/scan-reminders';
import dns from 'node:dns/promises';

async function main() {
  const now = new Date();
  const from = new Date(now.getTime() + 47 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 49 * 60 * 60 * 1000);

  console.log('=== 48h reminder debug ===');
  console.log('now:', now.toISOString());
  console.log('scan window:', from.toISOString(), '->', to.toISOString());

  const redisUrl = process.env.UPSTASH_REDIS_URL ?? '';
  const hostMatch = redisUrl.match(/@([^:/]+)/);
  const redisHost = hostMatch?.[1] ?? 'unknown';
  console.log('redis host:', redisHost);
  try {
    await dns.lookup(redisHost);
    console.log('redis dns: OK');
  } catch (e) {
    console.log('redis dns: FAIL', e instanceof Error ? e.message : e);
  }

  const pts = await db.select().from(patients).where(like(patients.fullName, '%Emin%'));
  console.log(
    'patients:',
    pts.map((p) => ({ id: p.id, name: p.fullName, phone: p.phone })),
  );

  for (const patient of pts) {
    const appts = await db
      .select({
        id: appointments.id,
        startsAt: appointments.startsAt,
        status: appointments.status,
      })
      .from(appointments)
      .where(eq(appointments.patientId, patient.id));

    for (const a of appts) {
      const hrs = (a.startsAt.getTime() - now.getTime()) / 3_600_000;
      const inWindow = a.startsAt >= from && a.startsAt <= to;
      console.log('appt:', {
        id: a.id,
        startsAt: a.startsAt.toISOString(),
        hrsUntil: hrs.toFixed(2),
        in48hWindow: inWindow,
        status: a.status,
      });
    }

    const msgs = await db
      .select({ type: messages.type, status: messages.status, appointmentId: messages.appointmentId })
      .from(messages)
      .where(eq(messages.patientId, patient.id));
    console.log('messages:', msgs);
  }

  const autos = await db.select().from(automations).where(eq(automations.type, 'reminder_48h'));
  console.log('automation:', autos.map((a) => ({ isEnabled: a.isEnabled, channel: a.channel })));

  const count = await scan48hReminders();
  console.log('scan48hReminders matched:', count);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
