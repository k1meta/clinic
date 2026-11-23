/**
 * End-to-end check of the voice tools against a running app and its real database.
 *
 *   npm run dev            (first terminal)
 *   npm run voice:smoke    (second terminal)
 *
 * Creates its own clinic and deletes only that clinic at the end, even on failure.
 * The clinic has no automations, so no messages are sent.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { appointments, calls, clinics, doctors, patients, voiceNumbers } from '../src/db/schema';
import { addDays, todayInZone, toZonedParts, weekdayOf } from '../src/lib/timezone';

const BASE = process.env.VOICE_SMOKE_URL ?? 'http://localhost:3000';
const TZ = 'Europe/Sarajevo';
const run = randomUUID().slice(0, 8);
const digits = String(Date.now()).slice(-8);
const CALLED = `+38799${digits}`;
const CALLER = `+38798${digits}`;
const STRANGER = `+38797${digits}`;

const FULL_DAY = { start: 8, end: 17 };
const WEEK = [null, FULL_DAY, FULL_DAY, FULL_DAY, FULL_DAY, FULL_DAY, { start: 9, end: 13 }];

type Reply = { success: boolean; code?: string; message: string };

async function tool(path: string, args: Record<string, unknown>, options: { caller?: string; conversation?: string } = {}): Promise<Reply> {
  const response = await fetch(`${BASE}/api/voice/tools/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.VOICE_TOOLS_API_KEY}` },
    body: JSON.stringify({
      conversation_id: options.conversation ?? `smoke_${run}`,
      caller_number: options.caller ?? CALLER,
      called_number: CALLED,
      ...args,
    }),
  });
  assert.equal(response.status, 200, `${path} → HTTP ${response.status}: ${await response.clone().text()}`);
  return (await response.json()) as Reply;
}

function expect(label: string, reply: Reply, success: boolean, code?: string) {
  assert.equal(reply.success, success, `${label}: ${JSON.stringify(reply)}`);
  if (code) assert.equal(reply.code, code, `${label}: ${JSON.stringify(reply)}`);
  console.log(`✓ ${label}`);
}

async function main() {
  let day = addDays(todayInZone(TZ), 1);
  while ([0, 6].includes(weekdayOf(day))) day = addDays(day, 1);
  let saturday = day;
  while (weekdayOf(saturday) !== 6) saturday = addDays(saturday, 1);
  const sunday = addDays(saturday, 1);

  const [clinic] = await db
    .insert(clinics)
    .values({ name: `Smoke ${run}`, slug: `smoke-${run}`, timezone: TZ, settings: { weekHours: WEEK, aiCalls: true } })
    .returning({ id: clinics.id });

  try {
    const [doctor] = await db
      .insert(doctors)
      .values({ clinicId: clinic.id, fullName: 'Dr. Smoke Test', specialty: 'Test' })
      .returning({ id: doctors.id });
    await db.insert(voiceNumbers).values({ clinicId: clinic.id, e164: CALLED, provider: 'smoke' });

    expect('unknown caller is identified', await tool('identify-caller', {}), true);
    expect('availability', await tool('check-availability', { date: day }), true);
    expect('unknown doctor is refused', await tool('check-availability', { doctor: 'Nepostojeci' }), false, 'doctor_not_found');
    expect('name is required', await tool('book', { date: day, time: '10:00' }), false, 'missing_patient_name');
    expect('closed Sunday is refused', await tool('book', { date: sunday, time: '10:00', patient_name: 'Emir Test' }), false, 'closed_day');
    expect('Saturday after closing is refused', await tool('book', { date: saturday, time: '13:00', patient_name: 'Emir Test' }), false, 'outside_hours');
    expect('Saturday is offered', await tool('check-availability', { date: saturday }), true);
    expect('night is refused', await tool('book', { date: day, time: '03:00', patient_name: 'Emir Test' }), false, 'outside_hours');
    expect('past is refused', await tool('book', { date: '2020-01-02', time: '10:00', patient_name: 'Emir Test' }), false, 'in_past');
    assert.equal((await db.select().from(patients).where(eq(patients.clinicId, clinic.id))).length, 0);
    console.log('✓ refused bookings leave no patient behind');

    expect('booking', await tool('book', { date: day, time: '10:00', patient_name: 'Emir Test' }), true);
    expect('repeated booking is confirmed, not doubled', await tool('book', { date: day, time: '10:00', patient_name: 'Emir Test' }), true);
    const booked = await db.select().from(appointments).where(eq(appointments.clinicId, clinic.id));
    assert.equal(booked.length, 1);
    assert.deepEqual(
      [toZonedParts(booked[0].startsAt, TZ).date, toZonedParts(booked[0].startsAt, TZ).time, booked[0].source],
      [day, '10:00', 'voice_ai'],
    );
    console.log('✓ stored at 10:00 Sarajevo time');

    expect('taken slot is refused', await tool('book', { date: day, time: '10:15', patient_name: 'Selma Test' }, { caller: STRANGER }), false, 'slot_unavailable');

    const race = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        tool('book', { date: day, time: '12:00', patient_name: `Trka Broj${i}` }, { caller: `+3879600000${i}`, conversation: `smoke_${run}_${i}` })),
    );
    assert.equal(race.filter((r) => r.success).length, 1, JSON.stringify(race));
    console.log('✓ five simultaneous callers, one booking');

    expect('a stranger cannot cancel', await tool('cancel', { patient_name: 'Emir Test', phone: CALLER }, { caller: STRANGER }), false, 'caller_not_verified');
    expect('reschedule', await tool('reschedule', { date: day, time: '11:00' }), true);
    expect('reschedule into a taken slot is refused', await tool('reschedule', { date: day, time: '12:00' }), false, 'slot_unavailable');
    expect('message', await tool('take-message', { patient_name: 'Emir Test', message: 'Nazvati' }, { conversation: `smoke_${run}_msg` }), true);
    expect('cancel', await tool('cancel', {}), true);
    expect('nothing left to cancel', await tool('cancel', {}), false, 'no_upcoming_appointment');

    const logged = await db.select().from(calls).where(eq(calls.clinicId, clinic.id));
    assert.ok(logged.some((c) => c.outcome === 'callback_requested'));
    assert.ok(logged.some((c) => c.outcome === 'cancelled'));
    console.log('✓ calls logged');
    assert.ok(doctor.id);
  } finally {
    await db.delete(clinics).where(eq(clinics.id, clinic.id));
    console.log('✓ test clinic removed');
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
