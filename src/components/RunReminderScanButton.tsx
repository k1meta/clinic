'use client';

import { useState, useTransition } from 'react';
import { runReminderScanNow } from '@/app/actions/clinic-settings';

export default function RunReminderScanButton() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleRun() {
    setStatus(null);
    startTransition(async () => {
      const result = await runReminderScanNow();
      if ('error' in result && result.error) {
        setStatus({ type: 'error', text: result.error });
      } else if ('message' in result && result.message) {
        setStatus({ type: 'success', text: result.message });
        setTimeout(() => setStatus(null), 6000);
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        Scans for appointments needing a 48 h reminder, a 2 h SMS nudge, or a post-visit
        follow-up and pushes matches to the worker queue. Runs automatically every 15 min.
      </p>
      <button
        onClick={handleRun}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40"
      >
        <span className="material-symbols-outlined text-base" style={{ fontSize: '18px' }}>
          {isPending ? 'autorenew' : 'play_arrow'}
        </span>
        {isPending ? 'Queuing scan...' : 'Run reminder scan now'}
      </button>
      {status && (
        <p className={'text-xs font-medium ' + (status.type === 'error' ? 'text-red-600' : 'text-green-600')}>
          {status.text}
        </p>
      )}
    </div>
  );
}
