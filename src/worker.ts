import { config } from 'dotenv';
config({ path: '.env.local' });

import { Worker } from 'bullmq';
import { getWorkerConnection } from '@/lib/redis';
import { getSchedulerQueue } from '@/lib/queue';
import type { SendMessageJobData, ProcessReplyJobData, VoiceEventJobData, SendCampaignJobData } from '@/lib/queue';
import { processSendMessage } from '@/jobs/send-message';
import { processSendCampaign } from '@/jobs/send-campaign';
import { processButtonReply } from '@/jobs/process-reply';
import { scan48hReminders, scan2hReminders, scanPostVisit, scanReEngagement } from '@/jobs/scan-reminders';
import { processVoiceEvent } from '@/jobs/process-voice-call';

async function main() {
  const connection = getWorkerConnection();
  console.log('[worker] Starting messaging worker...');

  // Messaging worker
  const messagingWorker = new Worker(
    'messaging',
    async (job) => {
      console.log('[worker] Processing job:', job.name, job.id);

      if (job.name === 'send-message') {
        await processSendMessage(job.data as SendMessageJobData);
      } else if (job.name === 'send-campaign') {
        await processSendCampaign(job.data as SendCampaignJobData);
      } else if (job.name === 'process-reply') {
        await processButtonReply(job.data as ProcessReplyJobData);
      }
    },
    { connection, concurrency: 5 },
  );

  messagingWorker.on('completed', (job) => {
    console.log('[worker] Job completed:', job?.name, job?.id);
  });

  messagingWorker.on('failed', (job, err) => {
    console.error('[worker] Job failed:', job?.name, job?.id, err.message);
  });

  // Voice worker
  const voiceWorker = new Worker(
    'voice',
    async (job) => {
      console.log('[worker] Processing voice job:', job.name, job.id);
      if (job.name === 'process-voice-event') {
        await processVoiceEvent(job.data as VoiceEventJobData);
      }
    },
    { connection: getWorkerConnection(), concurrency: 5 },
  );

  voiceWorker.on('failed', (job, err) => {
    console.error('[worker] Voice job failed:', job?.name, job?.id, err.message);
  });

  // Scheduler worker
  const schedulerWorker = new Worker(
    'scheduler',
    async (job) => {
      console.log('[worker] Running scheduler:', job.name);

      if (job.name === 'scan-48h') {
        const count = await scan48hReminders();
        console.log('[worker] 48h reminders queued:', count);
      } else if (job.name === 'scan-2h') {
        const count = await scan2hReminders();
        console.log('[worker] 2h reminders queued:', count);
      } else if (job.name === 'scan-post-visit') {
        const count = await scanPostVisit();
        console.log('[worker] Post-visit messages queued:', count);
      } else if (job.name === 'scan-re-engagement') {
        const count = await scanReEngagement();
        console.log('[worker] Re-engagement messages queued:', count);
      }
    },
    { connection: getWorkerConnection(), concurrency: 1 },
  );

  // Register repeatable jobs
  const schedulerQueue = getSchedulerQueue();

  await schedulerQueue.upsertJobScheduler('scan-48h-repeat', {
    every: 15 * 60 * 1000,
  }, { name: 'scan-48h' });

  await schedulerQueue.upsertJobScheduler('scan-2h-repeat', {
    every: 15 * 60 * 1000,
  }, { name: 'scan-2h' });

  await schedulerQueue.upsertJobScheduler('scan-post-visit-repeat', {
    pattern: '0 10 * * *', // daily at 10:00
  }, { name: 'scan-post-visit' });

  await schedulerQueue.upsertJobScheduler('scan-re-engagement-repeat', {
    pattern: '0 10 * * 1', // Monday 10:00
  }, { name: 'scan-re-engagement' });

  console.log('[worker] Repeatable jobs registered');
  console.log('[worker] Ready and listening for jobs');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[worker] Shutting down...');
    await messagingWorker.close();
    await voiceWorker.close();
    await schedulerWorker.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
