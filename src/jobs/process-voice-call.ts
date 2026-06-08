import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { calls } from '@/db/schema';
import type { VoiceEventJobData } from '@/lib/queue';
import { findPatientByPhone, upsertCallRecord } from '@/lib/voice/booking-service';

function shouldReconcileIntents() {
  return process.env.VOICE_RECONCILE_INTENTS === 'true';
}

function resolveLanguage(language?: string) {
  if (language?.toLowerCase().startsWith('en')) return 'en-US';
  return 'bs-BA';
}

export async function processVoiceEvent(data: VoiceEventJobData) {
  const now = new Date();
  const phone = data.fromNumber ?? null;
  const patient = phone ? await findPatientByPhone(data.clinicId, phone) : null;
  const language = resolveLanguage(data.payload?.language as string | undefined);
  const isEndEvent =
    data.eventType.includes('end') ||
    data.eventType.includes('post_call') ||
    data.eventType.includes('transcription') ||
    (data.payload?.data &&
      typeof data.payload.data === 'object' &&
      (data.payload.data as { status?: string }).status === 'done');

  const [existingCall] = await db
    .select({ id: calls.id, outcome: calls.outcome })
    .from(calls)
    .where(eq(calls.providerCallId, data.providerCallId))
    .limit(1);

  if (!existingCall) {
    await db.insert(calls).values({
      clinicId: data.clinicId,
      patientId: patient?.id ?? null,
      provider: data.provider,
      providerCallId: data.providerCallId,
      direction: data.direction ?? 'inbound',
      status: isEndEvent ? 'completed' : 'in_progress',
      fromNumber: data.fromNumber ?? null,
      toNumber: data.toNumber ?? null,
      transcript: data.transcript ?? null,
      language,
      metadata: data.payload,
      durationSec: data.durationSec ?? null,
      startedAt: now,
      endedAt: isEndEvent ? now : null,
    });
  } else {
    await db
      .update(calls)
      .set({
        patientId: patient?.id ?? null,
        transcript: data.transcript || undefined,
        status: isEndEvent ? 'completed' : 'in_progress',
        metadata: data.payload,
        durationSec: data.durationSec ?? undefined,
        updatedAt: now,
        ...(isEndEvent ? { endedAt: now } : {}),
      })
      .where(eq(calls.id, existingCall.id));
  }

  if (data.reconcileOnly || !shouldReconcileIntents()) {
    if (isEndEvent && !existingCall?.outcome) {
      await upsertCallRecord(
        {
          clinicId: data.clinicId,
          provider: data.provider,
          providerCallId: data.providerCallId,
          fromNumber: data.fromNumber,
          language,
        },
        {
          patientId: patient?.id ?? null,
          status: 'completed',
          outcome: 'logged',
          summary: 'Poziv zabiljezen. Zakazivanje ide preko live tool poziva tokom razgovora.',
        },
      );
    }
    return;
  }

  // Optional legacy fallback — disabled by default.
  const [last] = await db
    .select({ id: calls.id, outcome: calls.outcome })
    .from(calls)
    .where(and(eq(calls.providerCallId, data.providerCallId)))
    .orderBy(desc(calls.updatedAt))
    .limit(1);

  if (last && !last.outcome && isEndEvent) {
    await db
      .update(calls)
      .set({ outcome: 'other', updatedAt: new Date() })
      .where(eq(calls.id, last.id));
  }
}
