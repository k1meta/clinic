export const dynamic = 'force-dynamic';

import { getClinicId } from '@/db/queries/auth';
import { getUpcomingAppointments } from '@/db/queries/appointments';
import { getDoctorsByClinic } from '@/db/queries/doctors';
import { getTreatmentTypesByClinic } from '@/db/queries/treatment-types';
import { getAllPatients } from '@/db/queries/patients';
import AppointmentModal from '@/components/AppointmentModal';

export default async function OverviewPage() {
  const clinicId = await getClinicId();

  const [upcoming, doctors, treatmentTypes, patientsList] = await Promise.all([
    getUpcomingAppointments(clinicId, 5),
    getDoctorsByClinic(clinicId),
    getTreatmentTypesByClinic(clinicId),
    getAllPatients(clinicId),
  ]);

  function formatTime(date: Date) {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  const statusStyles: Record<string, string> = {
    arrived: 'bg-green-500/15 text-green-400',
    confirmed: 'bg-primary/10 text-primary',
    completed: 'bg-surface-container-high text-on-surface-variant',
    no_show: 'bg-error/10 text-error',
    cancelled: 'bg-surface-container-high text-outline',
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-headline font-extrabold tracking-tight text-on-surface">
            Clinic Overview
          </h1>
          <p className="text-on-surface-variant mt-1 text-sm">
            Today&apos;s schedule at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-surface-container-lowest text-primary text-xs font-bold rounded-lg transition-all active:scale-95 border border-primary/10">
            Export Report
          </button>
          <AppointmentModal
            doctors={doctors}
            treatmentTypes={treatmentTypes}
            patients={patientsList}
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-headline font-extrabold text-lg text-on-surface">Upcoming Appointments</h3>
          <a className="text-xs font-bold text-primary hover:underline" href="/calendar">
            View Calendar
          </a>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-8 text-center">No upcoming appointments</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                <th className="pb-4 px-2">Patient</th>
                <th className="pb-4 px-2">Treatment</th>
                <th className="pb-4 px-2">Time</th>
                <th className="pb-4 px-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/30">
              {upcoming.map((apt) => (
                <tr key={apt.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-[10px]">
                        {getInitials(apt.patient.fullName)}
                      </div>
                      <span className="text-sm font-bold">{apt.patient.fullName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-sm text-on-surface-variant">
                    {apt.treatmentType?.name ?? 'General'}
                  </td>
                  <td className="py-4 px-2 text-sm font-medium">{formatTime(apt.startsAt)}</td>
                  <td className="py-4 px-2 text-right">
                    <span
                      className={`px-3 py-1 ${statusStyles[apt.status] ?? 'bg-surface-container-high text-on-surface-variant'} text-[10px] font-bold rounded-full capitalize`}
                    >
                      {apt.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
