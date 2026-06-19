import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { doctors, treatmentTypes } from '@/db/schema';
import { getClinicBySlug } from '@/db/queries/clinics';
import { getAvailableSlots } from '@/lib/availability';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') ?? '';
  const date = searchParams.get('date') ?? '';
  const treatmentTypeId = searchParams.get('treatmentTypeId') ?? '';

  if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const clinic = await getClinicBySlug(slug);
  if (!clinic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rl = await rateLimit('avail:' + clinic.id, 120, 60);
  if (!rl.ok) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  let durationMin = 30;
  if (treatmentTypeId) {
    const [t] = await db
      .select({ d: treatmentTypes.defaultDurationMin })
      .from(treatmentTypes)
      .where(and(eq(treatmentTypes.id, treatmentTypeId), eq(treatmentTypes.clinicId, clinic.id)))
      .limit(1);
    if (t?.d) durationMin = t.d;
  }

  const activeDoctors = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(and(eq(doctors.clinicId, clinic.id), eq(doctors.isActive, true)));

  const byTime = new Map<string, { start: string; end: string; doctorId: string }>();
  for (const doc of activeDoctors) {
    const slots = await getAvailableSlots(clinic.id, doc.id, date, durationMin);
    for (const s of slots) {
      if (!byTime.has(s.start)) {
        byTime.set(s.start, { start: s.start, end: s.end, doctorId: doc.id });
      }
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const nowHM = new Date().toTimeString().slice(0, 5);

  const slots = Array.from(byTime.values())
    .filter((s) => date !== todayStr || s.start > nowHM)
    .sort((a, b) => a.start.localeCompare(b.start));

  return NextResponse.json({ slots, durationMin });
}
