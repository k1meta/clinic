import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { calls } from '@/db/schema';
import { logVoiceError } from '@/lib/voice/log';

export type VoiceContext = {
  clinicId: string;
  conversationId: string;
  /** Network-reported caller number. Null when hidden or a browser test. */
  callerNumber: string | null;
  calledNumber: string | null;
};

export type CallOutcome =
  | 'identified'
  | 'booked'
  | 'book_conflict'
  | 'rescheduled'
  | 'cancelled'
  | 'callback_requested'
  | 'logged';

export type CallbackRequest = {
  name: string;
  phone: string | null;
  message: string;
  requestedAt: string;
  resolvedAt?: string;
};

type CallPatch = {
  patientId?: string | null;
  appointmentId?: string | null;
  outcome?: CallOutcome;
  summary?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Create or update the row for this conversation. A conversation id that already
 * belongs to another clinic is left untouched.
 */
export async function recordCall(ctx: VoiceContext, patch: CallPatch): Promise<void> {
  const now = new Date();
  const metadata = patch.metadata ?? {};
  const rows = await db
    .insert(calls)
    .values({
      clinicId: ctx.clinicId,
      provider: 'elevenlabs',
      providerCallId: ctx.conversationId,
      direction: 'inbound',
      status: 'in_progress',
      fromNumber: ctx.callerNumber,
      toNumber: ctx.calledNumber,
      language: 'bs',
      patientId: patch.patientId ?? null,
      appointmentId: patch.appointmentId ?? null,
      outcome: patch.outcome ?? null,
      summary: patch.summary ?? null,
      metadata,
      startedAt: now,
    })
    .onConflictDoUpdate({
      target: calls.providerCallId,
      set: {
        updatedAt: now,
        metadata: sql`coalesce(${calls.metadata}, '{}'::jsonb) || ${JSON.stringify(metadata)}::jsonb`,
        ...(patch.patientId ? { patientId: patch.patientId } : {}),
        ...(patch.appointmentId ? { appointmentId: patch.appointmentId } : {}),
        ...(patch.outcome ? { outcome: patch.outcome } : {}),
        ...(patch.summary ? { summary: patch.summary } : {}),
      },
      setWhere: eq(calls.clinicId, ctx.clinicId),
    })
    .returning({ id: calls.id });

  if (rows.length === 0) throw new Error('Call record belongs to another clinic');
}

/** Logging must never break a booking that already happened. */
export async function tryRecordCall(ctx: VoiceContext, patch: CallPatch): Promise<void> {
  try {
    await recordCall(ctx, patch);
  } catch (error) {
    logVoiceError('call record failed', error);
  }
}

/** Store a callback request. Throws on failure so the agent never promises a lost message. */
export async function recordCallback(ctx: VoiceContext, callback: CallbackRequest): Promise<void> {
  const [existing] = await db
    .select({ outcome: calls.outcome })
    .from(calls)
    .where(and(eq(calls.providerCallId, ctx.conversationId), eq(calls.clinicId, ctx.clinicId)))
    .limit(1);
  const alreadyActed = ['booked', 'rescheduled', 'cancelled'].includes(existing?.outcome ?? '');

  await recordCall(ctx, {
    metadata: { callback },
    ...(alreadyActed
      ? {}
      : { outcome: 'callback_requested' as const, summary: `${callback.name}: ${callback.message}` }),
  });
}
