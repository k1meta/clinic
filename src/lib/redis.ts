import IORedis from 'ioredis';

function createConnection(overrides?: Record<string, unknown>) {
  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) throw new Error('UPSTASH_REDIS_URL is not set');
  return new IORedis(url, {
    tls: url.startsWith('rediss://') ? {} : undefined,
    ...overrides,
  });
}

/** Connection for BullMQ Queue (producers). Uses default maxRetriesPerRequest. */
export function getQueueConnection() {
  return createConnection();
}

/** Connection for BullMQ Worker (consumers). Requires maxRetriesPerRequest: null. */
export function getWorkerConnection() {
  return createConnection({ maxRetriesPerRequest: null });
}
