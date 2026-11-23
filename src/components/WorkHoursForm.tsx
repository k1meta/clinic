'use client';

import { useState, useTransition } from 'react';
import { updateWorkHours } from '@/app/actions/clinic-settings';
import { WEEK_ORDER, type DayHours, type WeekHours } from '@/lib/work-week';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const NEW_DAY: DayHours = { start: 9, end: 13 };

function formatHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

export default function WorkHoursForm({ current }: { current: WeekHours }) {
  const [week, setWeek] = useState<WeekHours>(current);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setDay(day: number, hours: DayHours | null) {
    setWeek((previous) => previous.map((value, index) => (index === day ? hours : value)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);

    const invalid = WEEK_ORDER.find((day) => {
      const hours = week[day];
      return hours && hours.end <= hours.start;
    });
    if (invalid !== undefined) {
      setError(`${DAY_LABELS[invalid]}: closing must be after opening`);
      return;
    }

    startTransition(async () => {
      const result = await updateWorkHours({ week });
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const selectClass = 'min-h-11 bg-surface-container-low rounded-lg px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body disabled:opacity-40';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {WEEK_ORDER.map((day) => {
        const hours = week[day];
        const label = DAY_LABELS[day];
        return (
          <div key={day} className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-3 w-36 min-h-11 text-sm font-semibold text-on-surface">
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={hours !== null}
                onChange={(e) => setDay(day, e.target.checked ? NEW_DAY : null)}
              />
              {label}
            </label>
            {hours ? (
              <>
                <select aria-label={`${label} opens`} value={hours.start} onChange={(e) => setDay(day, { ...hours, start: Number(e.target.value) })} className={selectClass}>
                  {HOURS.map((h) => <option key={h} value={h}>{formatHour(h)}</option>)}
                </select>
                <span className="text-on-surface-variant">&ndash;</span>
                <select aria-label={`${label} closes`} value={hours.end} onChange={(e) => setDay(day, { ...hours, end: Number(e.target.value) })} className={selectClass}>
                  {HOURS.map((h) => <option key={h} value={h}>{formatHour(h)}</option>)}
                </select>
              </>
            ) : (
              <span className="text-sm text-on-surface-variant">Closed</span>
            )}
          </div>
        );
      })}
      <button
        type="submit"
        disabled={isPending}
        className="min-h-11 px-5 bg-primary text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md active:scale-95 transition-all disabled:opacity-50"
      >
        {isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Hours'}
      </button>
      {error && <p role="alert" className="text-error text-xs font-medium">{error}</p>}
    </form>
  );
}
