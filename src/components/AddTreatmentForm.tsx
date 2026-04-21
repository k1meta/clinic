'use client';

import { useState, useTransition } from 'react';
import { addTreatmentType } from '@/app/actions/treatment-types';

export default function AddTreatmentForm() {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const priceInCents = price.trim() ? Math.round(parseFloat(price) * 100) : undefined;
    if (price.trim() && (isNaN(priceInCents!) || priceInCents! < 0)) {
      setError('Invalid price');
      return;
    }

    startTransition(async () => {
      const result = await addTreatmentType({ name: name.trim(), defaultDurationMin: duration, price: priceInCents });
      if (result?.error) {
        setError(result.error);
      } else {
        setName('');
        setDuration(30);
        setPrice('');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex-1">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Treatment Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Annual Physical"
          required
          className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
        />
      </div>
      <div className="w-28">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Duration</label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          min={5}
          max={480}
          required
          className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
        />
      </div>
      <div className="w-28">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Price (BAM)</label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          min={0}
          step={0.01}
          placeholder="0.00"
          className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md active:scale-95 transition-all disabled:opacity-50 shrink-0"
      >
        {isPending ? 'Adding...' : 'Add'}
      </button>
      {error && <p className="text-error text-xs font-medium">{error}</p>}
    </form>
  );
}