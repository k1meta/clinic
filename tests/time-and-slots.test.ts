import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeFreeSlots, findSlotProblem } from '@/lib/availability';
import { describeWeekBs, resolveWeekHours, weekEnvelope } from '@/lib/work-week';
import { isReminderDue, reminderWindowStart } from '@/lib/reminder-window';
import { addDays, isValidDate, safeTimezone, speakDateBs, toZonedParts, weekdayOf, zonedDayRange, zonedToUtc } from '@/lib/timezone';

const TZ = 'Europe/Sarajevo';
const iso = (date: string, time: string) => zonedToUtc(date, time, TZ)?.toISOString();

test('clinic time converts to UTC in winter and summer, whatever the server timezone', () => {
  assert.equal(iso('2026-11-24', '10:00'), '2026-11-24T09:00:00.000Z');
  assert.equal(iso('2026-07-01', '10:00'), '2026-07-01T08:00:00.000Z');
});

test('DST: skipped time is rejected, repeated time takes the first occurrence', () => {
  assert.equal(zonedToUtc('2026-03-29', '02:30', TZ), null);
  assert.equal(iso('2026-03-29', '03:00'), '2026-03-29T01:00:00.000Z');
  assert.equal(iso('2026-10-25', '02:30'), '2026-10-25T00:30:00.000Z');
});

test('day ranges follow DST', () => {
  const hours = (date: string) => {
    const { start, end } = zonedDayRange(date, TZ);
    return (end.getTime() - start.getTime()) / 3_600_000;
  };
  assert.equal(hours('2026-03-29'), 23);
  assert.equal(hours('2026-10-25'), 25);
  assert.equal(hours('2026-11-24'), 24);
});

test('round trip and late evening keep the clinic date', () => {
  assert.deepEqual(toZonedParts(new Date('2026-11-24T23:30:00Z'), TZ), {
    date: '2026-11-25', time: '00:30', hour: 0, minute: 30, minutes: 30,
  });
});

test('invalid input is rejected', () => {
  for (const [date, time] of [['2026-02-30', '10:00'], ['24.11.2026', '10:00'], ['2026-11-24', '25:00'], ['2026-11-24', '9:00'], ['', '']]) {
    assert.equal(zonedToUtc(date, time, TZ), null, `${date} ${time}`);
  }
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(safeTimezone('Mars/Base'), TZ);
});

test('calendar helpers', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(weekdayOf('2026-11-24'), 2);
  assert.equal(speakDateBs('2026-11-24'), 'utorak, 24. novembra');
});

test('free slots skip busy time, passed time and the end of the day', () => {
  const slots = computeFreeSlots({
    date: '2026-11-24',
    workHours: { start: 8, end: 11 },
    durationMin: 30,
    busy: [{ start: 9 * 60, end: 9 * 60 + 45 }, { start: 0, end: 0 }],
    notBefore: 8 * 60,
  });
  assert.deepEqual(slots.map((s) => s.start), ['08:30', '09:45', '10:15']);
});

test('an overlapping or out-of-hours busy block never produces slots outside hours', () => {
  const slots = computeFreeSlots({
    date: '2026-11-24',
    workHours: { start: 8, end: 10 },
    durationMin: 30,
    busy: [{ start: 20 * 60, end: 21 * 60 }, { start: 7 * 60, end: 9 * 60 }],
  });
  assert.deepEqual(slots.map((s) => s.start), ['09:00', '09:30']);
});

test('AI bookings must be in the future, on a working day, inside hours', () => {
  const week = resolveWeekHours(undefined, { start: 8, end: 17 });
  const problem = (date: string, time: string, minutes = 30, weekHours = week) => {
    const startsAt = zonedToUtc(date, time, TZ)!;
    return findSlotProblem({
      startsAt,
      endsAt: new Date(startsAt.getTime() + minutes * 60_000),
      weekHours,
      timeZone: TZ,
      now: new Date('2026-11-23T12:00:00Z'),
    });
  };
  assert.equal(problem('2026-11-24', '08:00'), null);
  assert.equal(problem('2026-11-24', '16:30'), null);
  assert.equal(problem('2026-11-24', '16:45'), 'outside_hours');
  assert.equal(problem('2026-11-24', '07:30'), 'outside_hours');
  assert.equal(problem('2026-11-24', '23:50'), 'outside_hours');
  assert.equal(problem('2026-11-28', '10:00'), 'closed_day');
  const openSaturday = week.map((hours, day) => (day === 6 ? { start: 9, end: 13 } : hours));
  assert.equal(problem('2026-11-28', '10:00', 30, openSaturday), null);
  assert.equal(problem('2026-11-28', '13:00', 30, openSaturday), 'outside_hours');
  assert.equal(problem('2026-11-29', '10:00', 30, openSaturday), 'closed_day');
  assert.equal(problem('2026-11-23', '12:59'), 'in_past');
  assert.equal(problem('2026-11-23', '13:30'), null);
});

test('reminders follow the appointment when it moves', () => {
  const startsAt = new Date('2026-11-30T09:00:00Z');
  const due = (now: string, status = 'confirmed') => isReminderDue({ startsAt, status }, 'reminder_48h', new Date(now));
  assert.equal(due('2026-11-28T09:00:00Z'), true);
  assert.equal(due('2026-11-28T08:57:00Z'), true);
  assert.equal(due('2026-11-26T09:00:00Z'), false, 'job queued for an earlier time');
  assert.equal(due('2026-11-30T09:00:00Z'), false, 'already started');
  assert.equal(due('2026-11-28T09:00:00Z', 'cancelled'), false);

  const sentForOldTime = new Date('2026-11-25T09:00:00Z');
  assert.ok(sentForOldTime < reminderWindowStart(startsAt, 'reminder_48h'), 'old reminder does not suppress the new one');
});

test('week hours: old clinics stay Monday to Friday, bad data is ignored', () => {
  const legacy = { start: 8, end: 17 };
  const week = resolveWeekHours(undefined, legacy);
  assert.equal(describeWeekBs(week), 'ponedjeljak do petak 8:00 do 17:00');
  assert.deepEqual(resolveWeekHours([{ start: 9, end: 5 }], legacy), week);
  assert.deepEqual(resolveWeekHours([null, null, null, null, null, null, { start: 13, end: 9 }], legacy), week);

  const weekend = week.map((hours, day) => (day === 6 ? { start: 9, end: 13 } : day === 0 ? { start: 10, end: 18 } : hours));
  assert.deepEqual(resolveWeekHours(weekend, legacy), weekend);
  assert.equal(describeWeekBs(weekend), 'ponedjeljak do petak 8:00 do 17:00, subota 9:00 do 13:00, nedjelja 10:00 do 18:00');
  assert.deepEqual(weekEnvelope(weekend, legacy), { start: 8, end: 18 });
  assert.equal(describeWeekBs(Array(7).fill(null)), 'trenutno zatvoreno');
  assert.deepEqual(weekEnvelope(Array(7).fill(null), legacy), legacy);
});
