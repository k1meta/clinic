import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { calls } from '@/db/schema';
import type { PostCallRecord } from '@/lib/channels/voice/elevenlabs';
import { findPatientsByPhone } from '@/lib/voice/patients';

/** Clinic already linked to this conversation by a live tool call. */
export async function findClinicIdByConversation(conversationId: string): Promise<string | null> {
  const [row] = await db
    .select({ clinicId: calls.clinicId })
    .from(calls)
    .where(and(eq(calls.provider, 'elevenlabs'), eq(calls.providerCallId, conversationId)))
    .limit(1);
  return row?.clinicId ?? null;
}

/**
 * Log a finished call. Safe to run twice for the same conversation. Never changes the
 * patient, appointment, outcome or callback recorded during the call.
 */
export async function processVoiceCall(clinicId: string, record: PostCallRecord): Promise<void> {
  const now = new Date();
  const matches = await findPatientsByPhone(clinicId, record.callerNumber);
  const patientId = matches.length === 1 ? matches[0].id : null;
  const metadata = { transcriptTurns: record.turns, callSuccessful: record.callSuccessful };

  const rows = await db
    .insert(calls)
    .values({
      clinicId,
      patientId,
      provider: 'elevenlabs',
      providerCallId: record.conversationId,
      direction: record.direction,
      status: record.failed ? 'failed' : 'completed',
      fromNumber: record.callerNumber,
      toNumber: record.calledNumber,
      language: 'bs',
      transcript: record.transcript,
      summary: record.summary,
      outcome: 'logged',
      durationSec: record.durationSec,
      metadata,
      startedAt: record.startedAt ?? now,
      endedAt: record.endedAt ?? now,
    })
    .onConflictDoUpdate({
      target: calls.providerCallId,
      set: {
        status: record.failed ? 'failed' : 'completed',
        patientId: sql`coalesce(${calls.patientId}, excluded.patient_id)`,
        outcome: sql`coalesce(${calls.outcome}, excluded.outcome)`,
        summary: sql`coalesce(${calls.summary}, excluded.summary)`,
        transcript: sql`coalesce(excluded.transcript, ${calls.transcript})`,
        durationSec: sql`coalesce(excluded.duration_sec, ${calls.durationSec})`,
        fromNumber: sql`coalesce(${calls.fromNumber}, excluded.from_number)`,
        toNumber: sql`coalesce(${calls.toNumber}, excluded.to_number)`,
        startedAt: sql`excluded.started_at`,
        endedAt: sql`excluded.ended_at`,
        metadata: sql`coalesce(${calls.metadata}, '{}'::jsonb) || excluded.metadata`,
        updatedAt: now,
      },
      setWhere: eq(calls.clinicId, clinicId),
    })
    .returning({ id: calls.id });

  if (rows.length === 0) throw new Error('Conversation belongs to another clinic');
}
