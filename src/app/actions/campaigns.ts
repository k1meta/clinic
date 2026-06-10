'use server';

import { z } from 'zod';
import { db } from '@/db';
import { campaigns, campaignRecipients } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAdmin } from '@/db/queries/auth';
import { parseSegmentFilter, resolveSegmentPatients } from '@/lib/campaigns/segments';
import { addSendCampaignJobWithTimeout } from '@/lib/queue';
import { processSendCampaign } from '@/jobs/send-campaign';
import { revalidatePath } from 'next/cache';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  channel: z.enum(['whatsapp', 'sms', 'email']),
  templateContent: z.string().min(1).max(2000),
  segmentFilter: z.record(z.string(), z.unknown()).optional(),
  scheduledAt: z.string().datetime().optional(),
});

export async function getCampaigns() {
  const { clinicId } = await requireAdmin();
  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.clinicId, clinicId))
    .orderBy(desc(campaigns.createdAt));
}

export async function previewCampaignAudience(segmentFilter: Record<string, unknown>) {
  const { clinicId } = await requireAdmin();
  const filter = parseSegmentFilter(segmentFilter);
  const patients = await resolveSegmentPatients(clinicId, filter);
  const members = patients.map((p) => ({ id: p.id, fullName: p.fullName }));
  return { count: members.length, members };
}

export async function createCampaign(input: z.infer<typeof createSchema>) {
  const { clinicId } = await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const filter = parseSegmentFilter(parsed.data.segmentFilter ?? {});
  const audience = await resolveSegmentPatients(clinicId, filter);
  if (audience.length === 0) return { error: 'No patients match this audience' };

  const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  const status = scheduledAt && scheduledAt > new Date() ? 'scheduled' : 'draft';

  const [campaign] = await db
    .insert(campaigns)
    .values({
      clinicId,
      name: parsed.data.name,
      channel: parsed.data.channel,
      templateContent: parsed.data.templateContent,
      segmentFilter: parsed.data.segmentFilter ?? {},
      scheduledAt,
      status: status as 'draft' | 'scheduled',
    })
    .returning({ id: campaigns.id });

  if (audience.length > 0) {
    await db.insert(campaignRecipients).values(
      audience.map((p) => ({
        campaignId: campaign.id,
        patientId: p.id,
        status: 'pending' as const,
      })),
    );
  }

  revalidatePath('/campaigns');
  return { success: true, id: campaign.id, recipientCount: audience.length };
}

export async function launchCampaign(campaignId: string) {
  const { clinicId } = await requireAdmin();

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.clinicId, clinicId)))
    .limit(1);

  if (!campaign) return { error: 'Campaign not found' };
  if (campaign.status === 'completed') {
    return { error: 'Campaign already completed' };
  }
  const stuckSending =
    campaign.status === 'sending' && campaign.sentCount === 0 && campaign.failedCount === 0;
  if (campaign.status === 'sending' && !stuckSending) {
    return { error: 'Campaign is already sending' };
  }

  await db
    .update(campaigns)
    .set({ status: 'sending', updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  const useQueue =
    process.env.NODE_ENV === 'production' || process.env.CAMPAIGN_USE_QUEUE === 'true';

  if (!useQueue) {
    try {
      await processSendCampaign({ campaignId, clinicId });
      revalidatePath('/campaigns');
      return {
        success: true,
        inline: true,
        warning: 'Dev mode: campaign sent directly (no Redis queue). Set CAMPAIGN_USE_QUEUE=true to use worker.',
      };
    } catch (inlineErr) {
      const inlineMsg = inlineErr instanceof Error ? inlineErr.message : 'Direct send failed';
      await db
        .update(campaigns)
        .set({ status: 'draft', updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
      return { error: inlineMsg };
    }
  }

  try {
    await addSendCampaignJobWithTimeout({ campaignId, clinicId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown queue error';

    await db
      .update(campaigns)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
    return {
      error:
        'Could not queue campaign. Check UPSTASH_REDIS_URL and ensure npm run worker is running. ' +
        msg,
    };
  }

  revalidatePath('/campaigns');
  return { success: true };
}
