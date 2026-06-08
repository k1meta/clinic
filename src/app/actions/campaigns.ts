'use server';

import { z } from 'zod';
import { db } from '@/db';
import { campaigns, campaignRecipients } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAdmin } from '@/db/queries/auth';
import { parseSegmentFilter, resolveSegmentPatients } from '@/lib/campaigns/segments';
import { addSendCampaignJob } from '@/lib/queue';
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
  return { count: patients.length, sample: patients.slice(0, 5).map((p) => p.fullName) };
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

  for (const p of audience) {
    await db.insert(campaignRecipients).values({
      campaignId: campaign.id,
      patientId: p.id,
      status: 'pending',
    });
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
  if (campaign.status === 'completed' || campaign.status === 'sending') {
    return { error: 'Campaign already launched' };
  }

  await db
    .update(campaigns)
    .set({ status: 'sending', updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  await addSendCampaignJob({ campaignId, clinicId });

  revalidatePath('/campaigns');
  return { success: true };
}
