import dns from 'node:dns/promises';

/** True when UPSTASH_REDIS_URL hostname resolves (queue can connect). */
export async function isRedisHostReachable(): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) return false;
  const match = url.match(/@([^:/]+)/);
  if (!match?.[1]) return false;
  try {
    await dns.lookup(match[1]);
    return true;
  } catch {
    return false;
  }
}

export function useInlineQueueFallback(): boolean {
  if (process.env.REMINDER_INLINE_FALLBACK === 'true') return true;
  if (process.env.REMINDER_INLINE_FALLBACK === 'false') return false;
  // `npm run worker` does not set NODE_ENV; treat non-production as dev.
  return process.env.NODE_ENV !== 'production';
}
