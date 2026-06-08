'use client';

import { useRouter } from 'next/navigation';

type Props = {
  value: string;
};

/** Navigates to `/calendar?date=…` so the day view stays shareable and SSR-backed. */
export default function CalendarDatePicker({ value }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2 pl-2 border-l border-outline-variant/20 ml-1">
      <span className="material-symbols-outlined text-outline text-lg" aria-hidden>
        calendar_month
      </span>
      <input
        type="date"
        value={value}
        aria-label="Select day to view"
        onChange={(e) => {
          const d = e.target.value;
          if (!d) return;
          if (d === value) return;
          router.push(`/calendar?date=${d}`, { scroll: false });
        }}
        className="bg-surface-container-lowest shadow-sm rounded-md py-1.5 px-2.5 text-sm font-bold text-on-surface border border-outline-variant/15 focus:outline-none focus:ring-2 focus:ring-primary/25 font-body min-w-[10.5rem]"
      />
    </div>
  );
}
