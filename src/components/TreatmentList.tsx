'use client';

import { useState, useTransition } from 'react';
import { deleteTreatmentType, updateTreatmentPrice } from '@/app/actions/treatment-types';

type Treatment = {
  id: string;
  name: string;
  defaultDurationMin: number;
  price: number | null;
};

function formatPrice(cents: number | null) {
  if (cents == null) return null;
  return (cents / 100).toFixed(2);
}

export default function TreatmentList({ treatments }: { treatments: Treatment[] }) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');

  function handleDelete(id: string) {
    if (!confirm('Delete this treatment? This cannot be undone if existing appointments reference it.')) return;
    startTransition(async () => { await deleteTreatmentType(id); });
  }

  function startEdit(t: Treatment) {
    setEditingId(t.id);
    setEditPrice(t.price != null ? (t.price / 100).toFixed(2) : '');
  }

  function savePrice(id: string) {
    const cents = editPrice.trim() ? Math.round(parseFloat(editPrice) * 100) : null;
    if (editPrice.trim() && (isNaN(cents!) || cents! < 0)) return;
    startTransition(async () => {
      await updateTreatmentPrice(id, cents);
      setEditingId(null);
    });
  }

  if (treatments.length === 0) {
    return (
      <div className="py-8 text-center">
        <span className="material-symbols-outlined text-3xl text-slate-300 mb-1">healing</span>
        <p className="text-sm text-slate-400 mt-1">No treatments added yet. Add your first treatment above.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-surface-container-high/30">
      {treatments.map((t) => (
        <div key={t.id} className="flex items-center justify-between py-3 px-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-lg">healing</span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">{t.name}</p>
              <p className="text-[11px] text-slate-400">
                {t.defaultDurationMin} min
                {t.price != null && <> &middot; <span className="text-green-600 font-semibold">{formatPrice(t.price)} BAM</span></>}
                {t.price == null && <> &middot; <span className="text-slate-300">No price set</span></>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {editingId === t.id ? (
              <form onSubmit={(e) => { e.preventDefault(); savePrice(t.id); }} className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  autoFocus
                  className="w-20 bg-surface-container-low rounded-lg py-1.5 px-2.5 text-xs border-none focus:ring-2 focus:ring-primary/20 font-body"
                />
                <button type="submit" disabled={isPending} className="p-1 rounded-lg hover:bg-green-100 text-green-600 transition-colors">
                  <span className="material-symbols-outlined text-base">check</span>
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </form>
            ) : (
              <button
                onClick={() => startEdit(t)}
                className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors"
                title="Edit price"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>
            )}
            <button
              onClick={() => handleDelete(t.id)}
              disabled={isPending}
              className="p-1.5 rounded-lg hover:bg-error/10 text-slate-400 hover:text-error transition-colors disabled:opacity-50"
              title="Delete treatment"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}