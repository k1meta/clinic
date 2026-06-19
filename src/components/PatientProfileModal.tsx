'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordPayment, bulkPayBalance, waivePayment } from '@/app/actions/appointments';
import { updatePatient, deletePatient } from '@/app/actions/patients';
import { getReferralLink } from '@/app/actions/referrals';

type AppointmentHistory = {
  id: string;
  patientId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  notes: string | null;
  amountCharged: number | null;
  amountPaid: number;
  paymentStatus: string;
  doctor: { fullName: string };
  treatmentType: { name: string | null } | null;
};

type Patient = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
  emergencyContact: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
};

function formatDate(d: string | null) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d: Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function getDurationMin(start: Date, end: Date) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

const statusStyles: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400',
  new: 'bg-blue-500/15 text-blue-400',
  inactive: 'bg-surface-container-high text-on-surface-variant',
};

const apptStatusStyles: Record<string, { bg: string; dot: string }> = {
  completed: { bg: 'bg-green-500/10 border-green-500/30', dot: 'bg-green-500' },
  confirmed: { bg: 'bg-blue-500/10 border-blue-500/30', dot: 'bg-blue-500' },
  arrived: { bg: 'bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-500' },
  no_show: { bg: 'bg-red-500/10 border-red-500/30', dot: 'bg-red-500' },
  cancelled: { bg: 'bg-surface-container-low border-outline-variant/50', dot: 'bg-outline' },
};

const paymentBadgeStyles: Record<string, string> = {
  paid: 'bg-green-500/15 text-green-400',
  partial: 'bg-blue-500/15 text-blue-400',
  pending: 'bg-amber-500/15 text-amber-400',
  waived: 'bg-surface-container-high text-on-surface-variant',
};

function PaymentForm({ appointmentId, remaining, onDone }: { appointmentId: string; remaining: number; onDone: () => void }) {
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) { setError('Enter a valid amount'); return; }
    if (cents > remaining) { setError(`Max ${formatPrice(remaining)} BAM`); return; }
    startTransition(async () => {
      const result = await recordPayment(appointmentId, cents);
      if (result.error) { setError(result.error); return; }
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <div className="relative flex-1">
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={(remaining / 100).toFixed(2)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full pl-3 pr-12 py-1.5 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          disabled={isPending}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-on-surface-variant">BAM</span>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? '...' : 'Pay'}
      </button>
      <button
        type="button"
        onClick={onDone}
        disabled={isPending}
        className="px-2 py-1.5 text-xs text-on-surface-variant hover:text-on-surface-variant transition-colors"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
      {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
    </form>
  );
}

function BulkPayForm({ patientId, totalOutstanding, onDone }: { patientId: string; totalOutstanding: number; onDone: () => void }) {
  const [amount, setAmount] = useState((totalOutstanding / 100).toFixed(2));
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) { setError('Enter a valid amount'); return; }
    if (cents > totalOutstanding) { setError(`Max ${formatPrice(totalOutstanding)} BAM`); return; }
    startTransition(async () => {
      const result = await bulkPayBalance(patientId, cents);
      if (result.error) { setError(result.error); return; }
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={(totalOutstanding / 100).toFixed(2)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full pl-3 pr-12 py-1.5 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          disabled={isPending}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-on-surface-variant">BAM</span>
      </div>
      <button
        type="button"
        onClick={() => setAmount((totalOutstanding / 100).toFixed(2))}
        className="px-2 py-1.5 text-[10px] font-bold text-primary hover:underline"
      >
        Pay All
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? '...' : 'Pay'}
      </button>
      <button type="button" onClick={onDone} disabled={isPending} className="px-2 py-1.5 text-xs text-on-surface-variant hover:text-on-surface-variant">
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
      {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
    </form>
  );
}

export default function PatientProfileModal({
  patient,
  appointments = [],
  canDelete = false,
}: {
  patient: Patient;
  appointments?: AppointmentHistory[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [payingApptId, setPayingApptId] = useState<string | null>(null);
  const [showBulkPay, setShowBulkPay] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [referMsg, setReferMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    setPayingApptId(null);
    setShowBulkPay(false);
    setIsEditing(false);
    setEditError('');
    setDeleteError('');
    dialogRef.current?.close();
  }

  function handleRemove() {
    setDeleteError('');
    const confirmed = confirm(
      `Permanently remove ${patient.fullName}? This cannot be undone. All appointments and messages for this patient will also be deleted.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deletePatient(patient.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  function handleCopyReferral() {
    setReferMsg('');
    startTransition(async () => {
      const res = await getReferralLink(patient.id);
      if ('error' in res || !res.url) {
        setReferMsg('Failed to create link');
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
        setReferMsg('Referral link copied!');
      } catch {
        setReferMsg(res.url);
      }
      setTimeout(() => setReferMsg(''), 4000);
    });
  }

  function handleSaveEdit(formData: FormData) {
    setEditError('');
    startTransition(async () => {
      const result = await updatePatient(patient.id, formData);
      if (result && 'error' in result && result.error) {
        setEditError(result.error);
        return;
      }
      setIsEditing(false);
    });
  }

  // Calculate balance using actual amounts
  const totalCharged = appointments.reduce((sum, a) => sum + (a.amountCharged ?? 0), 0);
  const totalPaid = appointments.reduce((sum, a) => sum + a.amountPaid, 0);
  const totalWaived = appointments.reduce((sum, a) => a.paymentStatus === 'waived' ? sum + (a.amountCharged ?? 0) : sum, 0);
  const balance = totalCharged - totalPaid - totalWaived;

  function handleWaive(appointmentId: string) {
    startTransition(async () => {
      await waivePayment(appointmentId);
    });
  }

  const fields = [
    { label: 'Phone', value: patient.phone, icon: 'call' },
    { label: 'Email', value: patient.email, icon: 'mail' },
    { label: 'Date of Birth', value: formatDate(patient.dob), icon: 'cake' },
    { label: 'Gender', value: patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : null, icon: 'person' },
    { label: 'Address', value: patient.address, icon: 'location_on' },
    { label: 'Emergency Contact', value: patient.emergencyContact, icon: 'emergency' },
  ];

  return (
    <>
      <button
        onClick={open}
        className="text-primary text-xs font-bold hover:underline transition-all"
      >
        View Profile
      </button>

      <dialog
        ref={dialogRef}
        className="backdrop:bg-black/50 bg-transparent p-0 m-auto rounded-2xl max-w-lg w-full"
        onClick={(e) => { if (e.target === dialogRef.current) close(); }}
      >
        <div className="bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-start justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-lg">
                {getInitials(patient.fullName)}
              </div>
              <div>
                <h2 className="font-headline font-bold text-lg">{patient.fullName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusStyles[patient.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                    {patient.status}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Since {new Date(patient.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isEditing && (
                <button
                  onClick={() => { setIsEditing(true); setEditError(''); }}
                  className="p-1 hover:bg-surface-container-low rounded-lg transition-colors text-on-surface-variant hover:text-primary"
                  title="Edit patient details"
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
              )}
              <button onClick={close} className="p-1 hover:bg-surface-container-low rounded-lg transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
          </div>

          {/* Balance Summary */}
          {totalCharged > 0 && (
            <div className="mx-6 mb-3 shrink-0">
              <div className="p-3 bg-surface-container-low rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-primary">account_balance_wallet</span>
                    <span className="text-xs font-bold text-on-surface-variant">Balance</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    {balance > 0 && (
                      <span className="text-amber-600">{formatPrice(balance)} BAM unpaid</span>
                    )}
                    {balance === 0 && totalCharged > 0 && (
                      <span className="text-green-400">All paid</span>
                    )}
                    <span className="text-on-surface-variant">{formatPrice(totalPaid)} paid</span>
                    {totalWaived > 0 && <span className="text-on-surface-variant">{formatPrice(totalWaived)} waived</span>}
                  </div>
                </div>
                {balance > 0 && !showBulkPay && (
                  <button
                    onClick={() => setShowBulkPay(true)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                    Record Payment ({formatPrice(balance)} BAM)
                  </button>
                )}
                {showBulkPay && (
                  <BulkPayForm patientId={patient.id} totalOutstanding={balance} onDone={() => setShowBulkPay(false)} />
                )}
              </div>
            </div>
          )}

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {/* Details (view or edit mode) */}
            {!isEditing ? (
              <>
                <div className="px-6 pb-2">
                  <div className="space-y-0 divide-y divide-surface-container-high/30">
                    {fields.map(f => (
                      <div key={f.label} className="flex items-center gap-3 py-3">
                        <span className="material-symbols-outlined text-on-surface-variant text-lg">{f.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{f.label}</p>
                          <p className="text-sm text-on-surface truncate">{f.value || '\u2014'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {patient.notes && (
                  <div className="mx-6 mb-4 p-3 bg-surface-container-low rounded-lg">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Notes</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{patient.notes}</p>
                  </div>
                )}
              </>
            ) : (
              <form action={handleSaveEdit} className="px-6 pb-4 space-y-3">
                {editError && (
                  <div className="p-2.5 bg-error/10 text-error text-xs rounded-lg font-medium">{editError}</div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    defaultValue={patient.fullName}
                    required
                    className="w-full bg-surface-container-low rounded-lg py-2 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      defaultValue={patient.phone ?? ''}
                      placeholder="+387 61 123 456"
                      className="w-full bg-surface-container-low rounded-lg py-2 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={patient.email ?? ''}
                      placeholder="patient@email.com"
                      className="w-full bg-surface-container-low rounded-lg py-2 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Date of Birth</label>
                    <input
                      type="date"
                      name="dob"
                      defaultValue={patient.dob ?? ''}
                      className="w-full bg-surface-container-low rounded-lg py-2 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Gender</label>
                    <select
                      name="gender"
                      defaultValue={patient.gender ?? ''}
                      className="w-full bg-surface-container-low rounded-lg py-2 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                    >
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Address</label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={patient.address ?? ''}
                    placeholder="123 Main St, City"
                    className="w-full bg-surface-container-low rounded-lg py-2 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    name="emergencyContact"
                    defaultValue={patient.emergencyContact ?? ''}
                    placeholder="Name &mdash; Phone"
                    className="w-full bg-surface-container-low rounded-lg py-2 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={patient.status}
                    className="w-full bg-surface-container-low rounded-lg py-2 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
                  >
                    <option value="new">New</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Notes</label>
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={patient.notes ?? ''}
                    placeholder="Allergies, medical history, etc."
                    className="w-full bg-surface-container-low rounded-lg py-2 px-3 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setIsEditing(false); setEditError(''); }}
                    className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors"
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* Treatment History */}
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-lg">history</span>
                <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Treatment History
                </h3>
                <span className="ml-auto text-[10px] font-bold text-on-surface-variant">
                  {appointments.length} visit{appointments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {appointments.length === 0 ? (
                <div className="py-6 text-center">
                  <span className="material-symbols-outlined text-3xl text-outline mb-1">event_busy</span>
                  <p className="text-sm text-on-surface-variant">No appointment history yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {appointments.map((appt) => {
                    const s = apptStatusStyles[appt.status] ?? apptStatusStyles.confirmed;
                    const duration = getDurationMin(appt.startsAt, appt.endsAt);
                    const remaining = (appt.amountCharged ?? 0) - appt.amountPaid;
                    const canPay = appt.amountCharged != null && appt.paymentStatus !== 'paid' && appt.paymentStatus !== 'waived' && remaining > 0;
                    return (
                      <div key={appt.id} className={`p-3 rounded-xl border ${s.bg} transition-colors`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-on-surface truncate">
                              {appt.treatmentType?.name ?? 'General Visit'}
                            </p>
                            <p className="text-[11px] text-on-surface-variant mt-0.5">
                              Dr. {appt.doctor.fullName} &middot; {duration} min
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold text-on-surface">
                              {formatDateTime(appt.startsAt)}
                            </p>
                            <p className="text-[11px] text-on-surface-variant">
                              {formatTime(appt.startsAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                            {appt.status.replace('_', ' ')}
                          </span>
                          {appt.amountCharged != null && (
                            <span className={`ml-auto px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${paymentBadgeStyles[appt.paymentStatus] ?? paymentBadgeStyles.pending}`}>
                              {appt.paymentStatus === 'partial'
                                ? `${formatPrice(appt.amountPaid)} / ${formatPrice(appt.amountCharged)} BAM`
                                : `${formatPrice(appt.amountCharged)} BAM \u00B7 ${appt.paymentStatus}`}
                            </span>
                          )}
                        </div>
                        {/* Payment progress bar for partial */}
                        {appt.amountCharged != null && appt.paymentStatus === 'partial' && (
                          <div className="mt-2 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.round((appt.amountPaid / appt.amountCharged) * 100)}%` }}></div>
                          </div>
                        )}
                        {/* Payment actions */}
                        {canPay && payingApptId !== appt.id && (
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => setPayingApptId(appt.id)}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-green-400 bg-green-500/10 rounded-md hover:bg-green-500/15 transition-colors"
                            >
                              <span className="material-symbols-outlined text-xs">payments</span>
                              Record Payment
                            </button>
                            <button
                              onClick={() => handleWaive(appt.id)}
                              disabled={isPending}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-on-surface-variant bg-surface-container-low rounded-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-xs">volunteer_activism</span>
                              Waive
                            </button>
                          </div>
                        )}
                        {payingApptId === appt.id && (
                          <PaymentForm appointmentId={appt.id} remaining={remaining} onDone={() => setPayingApptId(null)} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-surface-container-high/30 flex items-center justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyReferral}
                  disabled={isPending}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-bold uppercase tracking-widest border border-primary/30 text-primary rounded-lg hover:bg-primary/5 disabled:opacity-50 transition-colors"
                  title="Copy this patient's referral link"
                >
                  <span className="material-symbols-outlined text-sm">share</span>
                  Referral link
                </button>
                {canDelete && !isEditing && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={isPending}
                    className="px-3 py-2 text-xs font-bold uppercase tracking-widest border border-error text-error rounded-lg hover:bg-error/5 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? 'Removing...' : 'Remove patient'}
                  </button>
                )}
              </div>
              {referMsg && (
                <p className="mt-2 text-xs font-medium text-primary">{referMsg}</p>
              )}
              {deleteError && (
                <p className="mt-2 text-xs font-medium text-error">{deleteError}</p>
              )}
            </div>
            <button onClick={close} className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors shrink-0">
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}