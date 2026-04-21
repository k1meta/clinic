'use client';

import { useState, useTransition } from 'react';
import { updateWorkHours } from '@/app/actions/clinic-settings';

function formatHour(h: number) {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

export default function WorkHoursForm({ currentStart, currentEnd }: { currentStart: number; currentEnd: number }) {
  const [start, setStart] = useState(currentStart);
  const [end, setEnd] = useState(currentEnd);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);

    if (end <= start) {
      setError('End hour must be after start hour');
      return;
    }

    startTransition(async () => {
      const result = await updateWorkHours({ start, end });
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 flex-wrap">
      <div className="flex-1 min-w-[140px]">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Opens At</label>
        <select
          value={start}
          onChange={(e) => setStart(Number(e.target.value))}
          className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>{formatHour(i)}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[140px]">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Closes At</label>
        <select
          value={end}
          onChange={(e) => setEnd(Number(e.target.value))}
          className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>{formatHour(i)}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md active:scale-95 transition-all disabled:opacity-50 shrink-0"
      >
        {isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Hours'}
      </button>
      {error && <p className="text-error text-xs font-medium mt-1 w-full">{error}</p>}
    </form>
  );
}