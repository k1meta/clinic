'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { getClinicId } from '@/db/queries/auth';
import { calls } from '@/db/schema';

export async function resolveCallback(callId: string) {
  const clinicId = await getClinicId();
  const parsed = z.string().uuid().safeParse(callId);
  if (!parsed.success) return { error: 'Invalid call' };

  const rows = await db
    .update(calls)
    .set({
      metadata: sql`jsonb_set(${calls.metadata}, '{callback,resolvedAt}', to_jsonb(${new Date().toISOString()}::text))`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(calls.id, parsed.data),
        eq(calls.clinicId, clinicId),
        sql`${calls.metadata} -> 'callback' is not null`,
      ),
    )
    .returning({ id: calls.id });

  if (rows.length === 0) return { error: 'Callback not found' };
  revalidatePath('/voice-ai');
  return { success: true };
}
