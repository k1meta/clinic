import { Queue } from 'bullmq';
import { getQueueConnection } from './redis';

// --- Job data types ---

export interface SendMessageJobData {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  type: 'reminder_48h' | 'reminder_2h' | 'post_visit' | 're_engagement';
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

// --- Queues ---

let _messagingQueue: Queue | null = null;
let _schedulerQueue: Queue | null = null;

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

// --- Helper to add jobs ---

export async function addSendMessageJob(data: SendMessageJobData) {
  const queue = getMessagingQueue();
  return queue.add('send-message', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
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
