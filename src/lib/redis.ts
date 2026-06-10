import IORedis from 'ioredis';

function createConnection(overrides?: Record<string, unknown>) {
  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) throw new Error('UPSTASH_REDIS_URL is not set');
  return new IORedis(url, {
    tls: url.startsWith('rediss://') ? {} : undefined,
    ...overrides,
  });
}

/** Connection for BullMQ Queue (producers). Fail fast so server actions do not hang. */
export function getQueueConnection() {
  return createConnection({
    maxRetriesPerRequest: 3,
    connectTimeout: 5_000,
    enableOfflineQueue: false,
  });
}

/** Connection for BullMQ Worker (consumers). Requires maxRetriesPerRequest: null. */
export function getWorkerConnection() {
  return createConnection({ maxRetriesPerRequest: null });
}
