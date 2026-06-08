'use client';

import { useState, useTransition } from 'react';
import { addDoctor } from '@/app/actions/doctors';

export default function AddDoctorForm() {
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    startTransition(async () => {
      const result = await addDoctor({ fullName: fullName.trim(), specialty: specialty.trim() });
      if (result?.error) {
        setError(result.error);
      } else {
        setFullName('');
        setSpecialty('');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex-1">
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Full Name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Dr. Jane Smith"
          required
          className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
        />
      </div>
      <div className="flex-1">
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Specialty</label>
        <input
          type="text"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder="Cardiology"
          required
          className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md active:scale-95 transition-all disabled:opacity-50 shrink-0"
      >
        {isPending ? 'Adding...' : 'Add Doctor'}
      </button>
      {error && <p className="text-error text-xs font-medium">{error}</p>}
    </form>
  );
}