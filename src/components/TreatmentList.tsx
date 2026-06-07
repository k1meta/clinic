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
  // Per-row error message (delete or price update). Cleared on next interaction.
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Delete this treatment? Existing appointments that reference it will keep their record but show no treatment name.')) return;
    setRowError(null);
    startTransition(async () => {
      const result = await deleteTreatmentType(id);
      if (result && 'error' in result && result.error) {
        setRowError({ id, text: result.error });
      }
    });
  }

  function startEdit(t: Treatment) {
    setRowError(null);
    setEditingId(t.id);
    setEditPrice(t.price != null ? (t.price / 100).toFixed(2) : '');
  }

  function savePrice(id: string) {
    const trimmed = editPrice.trim();
    const cents = trimmed ? Math.round(parseFloat(trimmed) * 100) : null;
    if (trimmed && (isNaN(cents!) || cents! < 0)) {
      setRowError({ id, text: 'Invalid price' });
      return;
    }
    setRowError(null);
    startTransition(async () => {
      const result = await updateTreatmentPrice(id, cents);
      if (result && 'error' in result && result.error) {
        setRowError({ id, text: result.error });
        return;
      }
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
      {treatments.map((t) => {
        const hasPrice = t.price != null;
        const isEditing = editingId === t.id;
        const showError = rowError?.id === t.id;

        return (
          <div key={t.id} className="py-3 px-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary shrink-0">
                  <span className="material-symbols-outlined text-lg">healing</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{t.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {t.defaultDurationMin} min
                    {hasPrice && (
                      <> &middot; <span className="text-green-600 font-semibold">{formatPrice(t.price)} BAM</span></>
                    )}
                    {!hasPrice && !isEditing && (
                      <> &middot; <span className="text-slate-300">No price set</span></>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isEditing ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); savePrice(t.id); }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      autoFocus
                      className="w-24 bg-surface-container-low rounded-lg py-1.5 px-2.5 text-xs border-none focus:ring-2 focus:ring-primary/20 font-body"
                    />
                    <span className="text-[10px] font-bold text-slate-400">BAM</span>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="p-1 rounded-lg hover:bg-green-100 text-green-600 transition-colors disabled:opacity-50"
                      title="Save price"
                    >
                      <span className="material-symbols-outlined text-base">check</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(null); setRowError(null); }}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                      title="Cancel"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </form>
                ) : hasPrice ? (
                  <button
                    onClick={() => startEdit(t)}
                    className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors"
                    title="Edit price"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                ) : (
                  <button
                    onClick={() => startEdit(t)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors"
                    title="Set price"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add price
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

            {showError && (
              <p className="mt-1.5 ml-12 text-[11px] font-medium text-error">{rowError.text}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
