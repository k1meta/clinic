import type IORedis from 'ioredis';
import { getQueueConnection } from './redis';

let _conn: IORedis | null = null;

function conn(): IORedis {
  if (!_conn) _conn = getQueueConnection();
  return _conn;
}

/**
 * Best-effort fixed-window rate limiter backed by Redis. Fails OPEN (allows the
 * request) if Redis is unreachable, so a Redis outage never blocks bookings.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<{ ok: boolean; remaining: number }> {
  try {
    const c = conn();
    const redisKey = 'rl:' + key;
    const n = await c.incr(redisKey);
    if (n === 1) await c.expire(redisKey, windowSec);
    return { ok: n <= max, remaining: Math.max(0, max - n) };
  } catch {
    return { ok: true, remaining: max };
  }
}
