'use client';

import { useTransition } from 'react';
import { deleteDoctor, restoreDoctor } from '@/app/actions/doctors';

type Doctor = {
  id: string;
  fullName: string;
  specialty: string;
  isActive: boolean;
};

export default function DoctorList({ doctors }: { doctors: Doctor[] }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => { await deleteDoctor(id); });
  }

  function handleRestore(id: string) {
    startTransition(async () => { await restoreDoctor(id); });
  }

  if (doctors.length === 0) {
    return (
      <div className="py-8 text-center">
        <span className="material-symbols-outlined text-3xl text-outline mb-1">person_off</span>
        <p className="text-sm text-on-surface-variant mt-1">No doctors added yet. Add your first doctor above.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-surface-container-high/30">
      {doctors.map((d) => (
        <div key={d.id} className={`flex items-center justify-between py-3 px-1 ${!d.isActive ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-xs">
              {d.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">{d.fullName}</p>
              <p className="text-[11px] text-on-surface-variant">{d.specialty}</p>
            </div>
            {!d.isActive && (
              <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-[10px] font-bold rounded-full uppercase tracking-wider">Inactive</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {d.isActive ? (
              <button
                onClick={() => handleDelete(d.id)}
                disabled={isPending}
                className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors disabled:opacity-50"
                title="Deactivate doctor"
              >
                <span className="material-symbols-outlined text-lg">person_remove</span>
              </button>
            ) : (
              <button
                onClick={() => handleRestore(d.id)}
                disabled={isPending}
                className="p-1.5 rounded-lg hover:bg-green-500/10 text-on-surface-variant hover:text-green-400 transition-colors disabled:opacity-50"
                title="Restore doctor"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}