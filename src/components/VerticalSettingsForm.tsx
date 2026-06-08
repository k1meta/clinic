'use client';

import { useState, useTransition } from 'react';
import { updateBusinessVertical } from '@/app/actions/clinic-settings';
import type { BusinessVertical } from '@/lib/verticals';
import { VERTICAL_LABELS } from '@/lib/verticals';

const OPTIONS: { value: BusinessVertical; label: string }[] = [
  { value: 'dental', label: 'Dental / Medical clinic' },
  { value: 'salon', label: 'Salon / Spa' },
  { value: 'vet', label: 'Veterinary' },
  { value: 'generic', label: 'Generic local business' },
];

type Props = {
  vertical: BusinessVertical;
};

export default function VerticalSettingsForm({ vertical }: Props) {
  const [selected, setSelected] = useState<BusinessVertical>(vertical);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleChange(v: BusinessVertical) {
    setSelected(v);
    startTransition(async () => {
      await updateBusinessVertical(v);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const labels = VERTICAL_LABELS[selected];

  return (
    <div className="space-y-3">
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value as BusinessVertical)}
        disabled={isPending}
        className="w-full max-w-md rounded-lg border border-surface-container-high bg-white px-3 py-2 text-sm"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-slate-400">
        UI labels: {labels.customers}, {labels.providers}, {labels.appointment}s.
        Automation templates update to match this vertical.
      </p>
      {saved && <p className="text-xs text-green-600 font-medium">Vertical saved</p>}
    </div>
  );
}
