'use client';

import { useRef, useState, useTransition } from 'react';
import { createAppointment } from '@/app/actions/appointments';
import type { CreateAppointmentInput } from '@/app/actions/appointments';

type Props = {
  doctors: { id: string; fullName: string; specialty: string }[];
  treatmentTypes: { id: string; name: string; defaultDurationMin: number }[];
  patients: { id: string; fullName: string }[];
  defaultDate?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function fmtHourLabel(h: number) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export default function AppointmentModal({ doctors, treatmentTypes, patients, defaultDate }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const [selectedPatient, setSelectedPatient] = useState<{ id: string; fullName: string } | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [doctorId, setDoctorId] = useState('');
  const [treatmentTypeId, setTreatmentTypeId] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');

  const filteredPatients = patientSearch.length > 0
    ? patients.filter(p => p.fullName.toLowerCase().includes(patientSearch.toLowerCase())).slice(0, 8)
    : patients.slice(0, 8);

  function open() {
    setError('');
    setSelectedPatient(null);
    setPatientSearch('');
    setDoctorId('');
    setTreatmentTypeId('');
    setDate(defaultDate || new Date().toISOString().split('T')[0]);
    setHour(9);
    setMinute(0);
    setDuration(30);
    setNotes('');
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleTreatmentChange(id: string) {
    setTreatmentTypeId(id);
    const tt = treatmentTypes.find(t => t.id === id);
    if (tt) setDuration(tt.defaultDurationMin);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedPatient) {
      setError('Please select a patient');
      return;
    }
    if (!doctorId) {
      setError('Please select a doctor');
      return;
    }

    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const input: CreateAppointmentInput = {
      patientId: selectedPatient.id,
      doctorId,
      ...(treatmentTypeId ? { treatmentTypeId } : {}),
      date,
      time,
      durationMin: duration,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    startTransition(async () => {
      const result = await createAppointment(input);
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
        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-sm">add</span>
        Add Appointment
      </button>

      <dialog
        ref={dialogRef}
        className="backdrop:bg-black/50 bg-transparent p-0 m-auto rounded-2xl max-w-lg w-full"
        onClick={(e) => { if (e.target === dialogRef.current) close(); }}
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-container-high/50 flex items-center justify-between">
            <h2 className="font-headline font-bold text-lg">New Appointment</h2>
            <button type="button" onClick={close} className="p-1 hover:bg-surface-container-low rounded-lg transition-colors">
              <span className="material-symbols-outlined text-slate-400">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-error/10 text-error text-sm rounded-lg font-medium">{error}</div>
            )}

            {/* Patient Search */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Patient *</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-bold text-primary">{selectedPatient.fullName}</span>
                  <button type="button" onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-slate-400 hover:text-error">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }}
                    onFocus={() => setShowPatientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPatientDropdown(false), 200)}
                    placeholder="Search patients..."
                    className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                  />
                  {showPatientDropdown && filteredPatients.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-surface-container-high/50 max-h-48 overflow-y-auto">
                      {filteredPatients.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSelectedPatient(p); setShowPatientDropdown(false); setPatientSearch(''); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/5 transition-colors"
                        >
                          {p.fullName}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Doctor */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Doctor *</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                required
                className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
              >
                <option value="">Select doctor...</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.fullName} — {d.specialty}</option>
                ))}
              </select>
            </div>

            {/* Treatment Type */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Treatment</label>
              <select
                value={treatmentTypeId}
                onChange={(e) => handleTreatmentChange(e.target.value)}
                className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
              >
                <option value="">General (no specific treatment)</option>
                {treatmentTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.defaultDurationMin}min)</option>
                ))}
              </select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Time *</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={hour}
                    onChange={(e) => setHour(Number(e.target.value))}
                    className="flex-1 bg-surface-container-low rounded-lg py-2.5 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                  >
                    {HOURS.map(h => (
                      <option key={h} value={h}>{fmtHourLabel(h)}</option>
                    ))}
                  </select>
                  <span className="text-slate-400 font-bold">:</span>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(Number(e.target.value))}
                    className="w-20 bg-surface-container-low rounded-lg py-2.5 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                  >
                    {MINUTES.map(m => (
                      <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Duration (minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={5}
                max={480}
                className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special instructions..."
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
                {isPending ? 'Creating...' : 'Create Appointment'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}