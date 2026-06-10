import { Queue } from 'bullmq';
import { getQueueConnection } from './redis';
import { useInlineQueueFallback } from './redis-health';

// --- Job data types ---

export interface SendMessageJobData {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  type: 'reminder_48h' | 'reminder_2h' | 'post_visit' | 're_engagement' | 'review_request';
}

export interface SendCampaignJobData {
  campaignId: string;
  clinicId: string;
}

export interface ProcessReplyJobData {
  clinicId: string;
  patientId: string;
  appointmentId: string;
  action: 'confirm' | 'cancel' | 'reschedule';
  messageId?: string;
}

export interface RescheduleSelectionJobData {
  clinicId: string;
  patientId: string;
  oldAppointmentId: string;
  doctorId: string;
  newDate: string;
  newTime: string;
  durationMin: number;
}

export interface VoiceEventJobData {
  clinicId: string;
  provider: 'retell' | 'elevenlabs';
  providerCallId: string;
  eventType: string;
  fromNumber?: string;
  toNumber?: string;
  direction?: 'inbound' | 'outbound';
  transcript?: string;
  summary?: string;
  transcriptTurns?: Array<{ role?: string; message?: string; text?: string }>;
  durationSec?: number;
  payload: Record<string, unknown>;
  /** When true, worker only logs/reconciles — booking happens via real-time tool routes. */
  reconcileOnly?: boolean;
}

// --- Queues ---

let _messagingQueue: Queue | null = null;
let _schedulerQueue: Queue | null = null;
let _voiceQueue: Queue | null = null;

export function getMessagingQueue() {
  if (!_messagingQueue) {
    _messagingQueue = new Queue('messaging', { connection: getQueueConnection() });
  }
  return _messagingQueue;
}

export function getSchedulerQueue() {
  if (!_schedulerQueue) {
    _schedulerQueue = new Queue('scheduler', { connection: getQueueConnection() });
  }
  return _schedulerQueue;
}

export function getVoiceQueue() {
  if (!_voiceQueue) {
    _voiceQueue = new Queue('voice', { connection: getQueueConnection() });
  }
  return _voiceQueue;
}

// --- Helper to add jobs ---

export type AddSendMessageJobOptions = {
  /** BullMQ delay before the job runs (ms). */
  delay?: number;
};

async function runSendMessageInline(data: SendMessageJobData, delayMs?: number) {
  const { processSendMessage } = await import('@/jobs/send-message');
  if (typeof delayMs === 'number' && delayMs > 0) {
    setTimeout(() => {
      processSendMessage(data).catch((err) => {
        console.error('[queue:inline] delayed send-message failed:', err);
      });
    }, delayMs);
    return { id: `inline-delayed-${Date.now()}` };
  }
  await processSendMessage(data);
  return { id: `inline-${Date.now()}` };
}

export async function addSendMessageJob(data: SendMessageJobData, options?: AddSendMessageJobOptions) {
  const delay = options?.delay;
  const jobOpts = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
    ...(typeof delay === 'number' && delay > 0 ? { delay } : {}),
  };

  try {
    const queue = getMessagingQueue();
    return await Promise.race([
      queue.add('send-message', data, jobOpts),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Redis enqueue timed out after 5000ms')), 5_000);
      }),
    ]);
  } catch (err) {
    if (!useInlineQueueFallback()) throw err;
    console.warn('[queue] Redis unavailable — processing send-message inline');
    return runSendMessageInline(data, delay);
  }
}

export async function addProcessReplyJob(data: ProcessReplyJobData) {
  const queue = getMessagingQueue();
  return queue.add('process-reply', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  });
}

export async function addRescheduleSelectionJob(data: RescheduleSelectionJobData) {
  const queue = getMessagingQueue();
  return queue.add('reschedule-selection', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  });
}

export async function addSendCampaignJob(data: SendCampaignJobData) {
  const queue = getMessagingQueue();
  return queue.add('send-campaign', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

/** Enqueue with timeout so server actions do not hang when Redis is unreachable. */
export async function addSendCampaignJobWithTimeout(
  data: SendCampaignJobData,
  timeoutMs = 4_000,
) {
  await Promise.race([
    addSendCampaignJob(data),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Redis enqueue timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    }),
  ]);
}

export async function addVoiceEventJob(data: VoiceEventJobData) {
  const queue = getVoiceQueue();
  return queue.add('process-voice-event', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}
