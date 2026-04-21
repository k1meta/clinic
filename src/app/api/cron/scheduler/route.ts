import { NextRequest, NextResponse } from 'next/server';
import { getSchedulerQueue } from '@/lib/queue';

/** GET: Trigger scheduler scan (protected by CRON_SECRET) */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const queue = getSchedulerQueue();
  await queue.add('scan-48h', {});
  await queue.add('scan-2h', {});

  return NextResponse.json({ triggered: true });
}
