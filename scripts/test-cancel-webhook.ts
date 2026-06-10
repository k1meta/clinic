import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/db';
import { appointments, patients, messages } from '../src/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/** Simulate Meta webhook for template quick-reply Cancel tap. */
async function main() {
  const apptId = process.argv[2];
  if (!apptId) {
    console.error('Usage: npx tsx scripts/test-cancel-webhook.ts <appointmentId>');
    process.exit(1);
  }

  const [appt] = await db
    .select({ id: appointments.id, status: appointments.status, patientId: appointments.patientId })
    .from(appointments)
    .where(eq(appointments.id, apptId));
  if (!appt) {
    console.error('Appointment not found:', apptId);
    process.exit(1);
  }

  if (process.argv.includes('--reset-confirmed') && appt.status === 'cancelled') {
    await db
      .update(appointments)
      .set({ status: 'confirmed', cancelledReason: null, updatedAt: new Date() })
      .where(eq(appointments.id, apptId));
    appt.status = 'confirmed';
    console.log('reset appointment to confirmed for test');
  }

  const [patient] = await db
    .select({ phone: patients.phone })
    .from(patients)
    .where(eq(patients.id, appt.patientId));
  if (!patient?.phone) {
    console.error('Patient phone not found');
    process.exit(1);
  }

  const phoneDigits = patient.phone.replace(/\D/g, '');
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID ?? 'test' },
              messages: [
                {
                  from: phoneDigits,
                  id: `wamid.test-${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'button',
                  button: { payload: `cancel:${apptId}`, text: 'Otkazi' },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  console.log('POST /api/whatsapp/webhook with type=button payload');
  console.log('appointment before:', appt.status);

  const res = await fetch('http://localhost:3000/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  console.log('webhook status:', res.status);

  await new Promise((r) => setTimeout(r, 3000));

  const [apptAfter] = await db
    .select({ status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, apptId));
  console.log('appointment after:', apptAfter?.status);

  const recent = await db
    .select({ type: messages.type, direction: messages.direction, content: messages.content })
    .from(messages)
    .where(and(eq(messages.appointmentId, apptId)))
    .orderBy(desc(messages.createdAt))
    .limit(3);
  console.log('recent messages:', recent);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
