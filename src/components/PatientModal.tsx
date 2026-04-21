'use client';

import { useRef, useState, useTransition } from 'react';
import { createPatient } from '@/app/actions/patients';

export default function PatientModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function open() {
    setError('');
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPatient(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        close();
      }
    });
  }

  return (
    <>
      <button
        onClick={open}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95"
      >
        <span className="material-symbols-outlined text-lg">person_add</span>
        Add Patient
      </button>

      <dialog
        ref={dialogRef}
        className="backdrop:bg-black/50 bg-transparent p-0 m-auto rounded-2xl max-w-lg w-full"
        onClick={(e) => { if (e.target === dialogRef.current) close(); }}
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-container-high/50 flex items-center justify-between">
            <h2 className="font-headline font-bold text-lg">New Patient</h2>
            <button onClick={close} className="p-1 hover:bg-surface-container-low rounded-lg transition-colors">
              <span className="material-symbols-outlined text-slate-400">close</span>
            </button>
          </div>

          <form action={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-error/10 text-error text-sm rounded-lg font-medium">{error}</div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Full Name *</label>
              <input
                type="text"
                name="fullName"
                required
                placeholder="John Doe"
                className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
              />
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="+387 61 123 456"
                  className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="patient@email.com"
                  className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                />
              </div>
            </div>

            {/* DOB & Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Gender</label>
                <select name="gender" className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body">
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Address</label>
              <input
                type="text"
                name="address"
                placeholder="123 Main St, City"
                className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
              />
            </div>

            {/* Emergency Contact */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Emergency Contact</label>
              <input
                type="text"
                name="emergencyContact"
                placeholder="Name — Phone"
                className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Notes</label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Allergies, medical history, etc."
                className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={close} className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-surface-container-low rounded-lg transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2.5 clinical-gradient text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Add Patient'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}