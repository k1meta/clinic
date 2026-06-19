'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addToWaitlist, removeFromWaitlist } from '@/app/actions/waiting-list';
import type { WaitlistEntry } from '@/db/queries/waiting-list';

interface Props {
  entries: WaitlistEntry[];
  patients: { id: string; fullName: string }[];
  treatmentTypes: { id: string; name: string }[];
}

export default function WaitlistPanel({ entries, patients, treatmentTypes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [treatmentTypeId, setTreatmentTypeId] = useState('');
  const [preferredFrom, setPreferredFrom] = useState('');
  const [preferredTo, setPreferredTo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function reset() {
    setPatientId('');
    setTreatmentTypeId('');
    setPreferredFrom('');
    setPreferredTo('');
    setNote('');
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!patientId) {
      setError('Select a patient');
      return;
    }
    startTransition(async () => {
      const res = await addToWaitlist({ patientId, treatmentTypeId, preferredFrom, preferredTo, note });
      if (res?.error) {
        setError(res.error);
      } else {
        reset();
        setOpen(false);
        router.refresh();
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeFromWaitlist(id);
      router.refresh();
    });
  }

  const inputClass =
    'w-full bg-surface-container-lowest rounded-lg py-2 px-3 text-xs border-none focus:ring-2 focus:ring-primary/20 font-body';

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Waiting List</h3>
        <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-black px-2 py-0.5 rounded-full">
          {entries.length}
        </span>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full mb-4 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-sm">{open ? 'close' : 'add'}</span>
        {open ? 'Cancel' : 'Add to waiting list'}
      </button>

      {open && (
        <form onSubmit={handleAdd} className="space-y-2 mb-4 bg-surface-container-lowest rounded-xl p-3 border border-outline-variant/10">
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputClass}>
            <option value="">Select patient...</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>
          <select value={treatmentTypeId} onChange={(e) => setTreatmentTypeId(e.target.value)} className={inputClass}>
            <option value="">Any treatment</option>
            {treatmentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">From</label>
              <input type="date" value={preferredFrom} onChange={(e) => setPreferredFrom(e.target.value)} className={inputClass} />
            </div>
            <div className="flex-1">
              <label className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">To</label>
              <input type="date" value={preferredTo} onChange={(e) => setPreferredTo(e.target.value)} className={inputClass} />
            </div>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className={inputClass}
          />
          {error && <p className="text-error text-[11px] font-medium">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg disabled:opacity-50"
          >
            {isPending ? 'Adding...' : 'Add'}
          </button>
        </form>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-8">No patients on the waiting list.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="bg-surface-container-lowest rounded-xl p-3 border border-outline-variant/10">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{entry.patientName}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {entry.treatmentName ?? 'Any treatment'}
                    {entry.doctorName ? ' \u00b7 ' + entry.doctorName : ''}
                  </p>
                  {(entry.preferredFrom || entry.preferredTo) && (
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      {entry.preferredFrom ?? '...'} &rarr; {entry.preferredTo ?? '...'}
                    </p>
                  )}
                  {entry.note && <p className="text-[10px] italic text-on-surface-variant mt-0.5 truncate">&ldquo;{entry.note}&rdquo;</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {entry.status === 'notified' && (
                    <span className="bg-green-500/15 text-green-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Notified</span>
                  )}
                  <button
                    onClick={() => handleRemove(entry.id)}
                    disabled={isPending}
                    className="p-1 rounded-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
                    title="Remove"
                  >
                    <span className="material-symbols-outlined text-outline text-base">close</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          <span className="text-xs font-bold text-primary">Auto-fill</span>
        </div>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          When an appointment is cancelled, matching patients here are automatically texted that a slot opened.
        </p>
      </div>
    </>
  );
}
