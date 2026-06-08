import { and, count, desc, eq, gte } from 'drizzle-orm';
import { db } from '..';
import { calls, patients } from '../schema';

const callSelectFields = {
  id: calls.id,
  provider: calls.provider,
  providerCallId: calls.providerCallId,
  status: calls.status,
  direction: calls.direction,
  fromNumber: calls.fromNumber,
  toNumber: calls.toNumber,
  summary: calls.summary,
  outcome: calls.outcome,
  transcript: calls.transcript,
  metadata: calls.metadata,
  startedAt: calls.startedAt,
  endedAt: calls.endedAt,
  durationSec: calls.durationSec,
  patient: {
    id: patients.id,
    fullName: patients.fullName,
  },
};

export async function getRecentCallsByClinic(clinicId: string, limit: number = 20) {
  return db
    .select(callSelectFields)
    .from(calls)
    .leftJoin(patients, eq(calls.patientId, patients.id))
    .where(eq(calls.clinicId, clinicId))
    .orderBy(desc(calls.createdAt))
    .limit(limit);
}

export async function getCallById(clinicId: string, callId: string) {
  const [row] = await db
    .select(callSelectFields)
    .from(calls)
    .leftJoin(patients, eq(calls.patientId, patients.id))
    .where(and(eq(calls.id, callId), eq(calls.clinicId, clinicId)))
    .limit(1);
  return row ?? null;
}

export async function getCallStatsThisWeek(clinicId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [totalRow, resolvedRow] = await Promise.all([
    db
      .select({ total: count() })
      .from(calls)
      .where(and(eq(calls.clinicId, clinicId), gte(calls.createdAt, since))),
    db
      .select({ total: count() })
      .from(calls)
      .where(and(eq(calls.clinicId, clinicId), gte(calls.createdAt, since), eq(calls.outcome, 'booked'))),
  ]);

  const total = totalRow[0]?.total ?? 0;
  const resolved = resolvedRow[0]?.total ?? 0;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  return { total, resolved, resolutionRate };
}
