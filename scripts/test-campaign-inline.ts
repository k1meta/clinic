import { db } from '../src/db';
import { campaigns, campaignRecipients } from '../src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { processSendCampaign } from '../src/jobs/send-campaign';

async function main() {
  const reset = process.argv.includes('--reset');
  const [c] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.channel, 'email'))
    .orderBy(desc(campaigns.createdAt))
    .limit(1);

  if (!c) {
    console.log('no email campaign found');
    return;
  }

  if (reset) {
    await db
      .update(campaignRecipients)
      .set({ status: 'pending' })
      .where(eq(campaignRecipients.campaignId, c.id));
    await db
      .update(campaigns)
      .set({ status: 'sending', sentCount: 0, failedCount: 0 })
      .where(eq(campaigns.id, c.id));
  }

  console.log('before', c.id, c.name, c.status, c.sentCount, c.failedCount);
  const t = Date.now();
  await processSendCampaign({ campaignId: c.id, clinicId: c.clinicId });
  const [after] = await db.select().from(campaigns).where(eq(campaigns.id, c.id));
  console.log(
    'after',
    after?.status,
    'sent',
    after?.sentCount,
    'failed',
    after?.failedCount,
    'ms',
    Date.now() - t,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
