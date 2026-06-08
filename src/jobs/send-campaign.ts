import { db } from '@/db';
import { campaigns, campaignRecipients, patients } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendMessage } from '@/lib/messaging';
import { renderTemplate } from '@/lib/templates';
import type { SendCampaignJobData } from '@/lib/queue';

export async function processSendCampaign(data: SendCampaignJobData) {
  const { campaignId, clinicId } = data;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.clinicId, clinicId)))
    .limit(1);

  if (!campaign) return;

  const recipients = await db
    .select({
      recipientId: campaignRecipients.id,
      patientId: campaignRecipients.patientId,
      fullName: patients.fullName,
    })
    .from(campaignRecipients)
    .innerJoin(patients, eq(campaignRecipients.patientId, patients.id))
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.status, 'pending'),
      ),
    );

  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const content = renderTemplate(campaign.templateContent, {
      patient_name: r.fullName,
    });

    try {
      const result = await sendMessage({
        clinicId,
        patientId: r.patientId,
        channel: campaign.channel as 'whatsapp' | 'sms' | 'email',
        type: 'campaign',
        content,
        emailSubject: campaign.name,
        skipAutomationChecks: true,
      });

      if ('skipped' in result) {
        await db
          .update(campaignRecipients)
          .set({ status: 'skipped' })
          .where(eq(campaignRecipients.id, r.recipientId));
        failed++;
        continue;
      }

      await db
        .update(campaignRecipients)
        .set({ status: 'sent', messageId: result.id })
        .where(eq(campaignRecipients.id, r.recipientId));
      sent++;
    } catch {
      await db
        .update(campaignRecipients)
        .set({ status: 'failed' })
        .where(eq(campaignRecipients.id, r.recipientId));
      failed++;
    }
  }

  await db
    .update(campaigns)
    .set({
      status: 'completed',
      sentCount: sent,
      failedCount: failed,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));
}
