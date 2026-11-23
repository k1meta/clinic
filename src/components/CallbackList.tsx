'use client';

import { useState, useTransition } from 'react';
import { resolveCallback } from '@/app/actions/callbacks';

type Callback = {
  id: string;
  createdAt: Date;
  callback: { name?: string; phone?: string | null; message?: string };
};

export default function CallbackList({ callbacks, timeZone }: { callbacks: Callback[]; timeZone: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (callbacks.length === 0) return null;

  function handleResolve(id: string) {
    startTransition(async () => {
      const result = await resolveCallback(id);
      setError('error' in result && result.error ? result.error : null);
    });
  }

  return (
    <section className="col-span-12 bg-surface-container-lowest rounded-xl shadow-sm p-6">
      <h3 className="font-headline font-bold text-on-surface">Treba nazvati ({callbacks.length})</h3>
      {error && <p role="alert" className="text-sm text-error mt-2">{error}</p>}
      <ul className="divide-y divide-surface-container-low mt-3">
        {callbacks.map(({ id, createdAt, callback }) => (
          <li key={id} className="py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface">
                {callback.name ?? 'Nepoznat pozivalac'}
                {callback.phone && (
                  <a href={`tel:${callback.phone}`} className="ml-2 text-primary hover:underline">{callback.phone}</a>
                )}
              </p>
              <p className="text-sm text-on-surface-variant mt-1 break-words">{callback.message}</p>
              <p className="text-xs text-on-surface-variant mt-1">
                {new Date(createdAt).toLocaleString('bs-BA', { timeZone })}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleResolve(id)}
              className="min-h-11 px-4 text-sm font-semibold rounded-lg bg-primary text-white disabled:opacity-50"
            >
              Riješeno
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
