'use client';

import { useState } from 'react';

type Slot = { start: string; end: string; doctorId: string };

interface Props {
  slug: string;
  treatments: { id: string; name: string }[];
  refCode: string;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingWidget({ slug, treatments, refCode }: Props) {
  const [treatmentTypeId, setTreatmentTypeId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ date: string; time: string } | null>(null);

  const card = 'bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/10';
  const input = 'w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body';

  async function loadSlots() {
    setError('');
    setSelected(null);
    setLoadingSlots(true);
    setSlots(null);
    try {
      const qs = new URLSearchParams({ slug, date });
      if (treatmentTypeId) qs.set('treatmentTypeId', treatmentTypeId);
      const res = await fetch('/api/public/availability?' + qs.toString());
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not load times');
        return;
      }
      setSlots(data.slots ?? []);
    } catch {
      setError('Could not load times. Please try again.');
    } finally {
      setLoadingSlots(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          phone,
          treatmentTypeId,
          doctorId: selected.doctorId,
          date,
          time: selected.start,
          ref: refCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Booking failed');
        if (res.status === 409) {
          setSelected(null);
          await loadSlots();
        }
        return;
      }
      setDone({ date: data.date, time: data.time });
    } catch {
      setError('Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={card + ' text-center'}>
        <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-green-500 text-3xl">check_circle</span>
        </div>
        <h2 className="font-headline text-xl font-extrabold text-on-surface">You&apos;re booked!</h2>
        <p className="text-sm text-on-surface-variant mt-2">
          {done.date} at {done.time}. We&apos;ll send you a reminder.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={card + ' space-y-4'}>
      <div>
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Service</label>
        <select value={treatmentTypeId} onChange={(e) => { setTreatmentTypeId(e.target.value); setSlots(null); setSelected(null); }} className={input}>
          <option value="">Any service</option>
          {treatments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Date</label>
          <input type="date" min={todayStr()} value={date} onChange={(e) => { setDate(e.target.value); setSlots(null); setSelected(null); }} className={input} />
        </div>
        <button type="button" onClick={loadSlots} disabled={loadingSlots} className="px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50 shrink-0">
          {loadingSlots ? '...' : 'Find times'}
        </button>
      </div>

      {slots && slots.length === 0 && (
        <p className="text-sm text-on-surface-variant text-center py-2">No free times that day. Try another date.</p>
      )}

      {slots && slots.length > 0 && (
        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Pick a time</label>
          <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
            {slots.map((s) => (
              <button
                type="button"
                key={s.start + s.doctorId}
                onClick={() => setSelected(s)}
                className={'py-2 text-xs font-bold rounded-lg transition-all ' + (selected?.start === s.start ? 'bg-primary text-white' : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface')}
              >
                {s.start}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-3 pt-2 border-t border-outline-variant/10">
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Your name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={input} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className={input} placeholder="+387 ..." />
          </div>
          <button type="submit" disabled={submitting} className="w-full px-4 py-3 bg-primary text-white text-sm font-bold rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50">
            {submitting ? 'Booking...' : `Confirm ${date} at ${selected.start}`}
          </button>
        </div>
      )}

      {error && <p className="text-error text-xs font-medium text-center">{error}</p>}
    </form>
  );
}
