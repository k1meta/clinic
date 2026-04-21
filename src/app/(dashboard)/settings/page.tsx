export const dynamic = 'force-dynamic';

import { getClinicId } from '@/db/queries/auth';
import { getAllDoctorsByClinic } from '@/db/queries/doctors';
import { getAllTreatmentTypesByClinic } from '@/db/queries/treatment-types';
import { getClinicSettings } from '@/db/queries/clinics';
import AddDoctorForm from '@/components/AddDoctorForm';
import AddTreatmentForm from '@/components/AddTreatmentForm';
import DoctorList from '@/components/DoctorList';
import TreatmentList from '@/components/TreatmentList';
import WorkHoursForm from '@/components/WorkHoursForm';
import AiSettingsToggle from '@/components/AiSettingsToggle';
import TestPhoneForm from '@/components/TestPhoneForm';

function formatHour(h: number) {
  if (h === 0) return '12:00 AM';
  if (h < 12) return h + ':00 AM';
  if (h === 12) return '12:00 PM';
  return (h - 12) + ':00 PM';
}

export default async function SettingsPage() {
  const clinicId = await getClinicId();

  const [doctors, treatments, settings] = await Promise.all([
    getAllDoctorsByClinic(clinicId),
    getAllTreatmentTypesByClinic(clinicId),
    getClinicSettings(clinicId),
  ]);

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-10">
        <nav className="flex mb-2 space-x-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span>Clinic</span>
          <span>/</span>
          <span className="text-primary">Settings</span>
        </nav>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your clinic&apos;s schedule, doctors, treatments, and AI features.</p>
      </div>

      {/* Work Hours */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined">schedule</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface">Work Hours</h2>
              <p className="text-[11px] text-slate-400">
                Currently {formatHour(settings.workHours.start)} &ndash; {formatHour(settings.workHours.end)} &middot; Calendar grid adjusts automatically
              </p>
            </div>
          </div>
          <WorkHoursForm currentStart={settings.workHours.start} currentEnd={settings.workHours.end} />
        </div>
      </div>

      {/* AI Settings */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">smart_toy</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface">AI Features</h2>
              <p className="text-[11px] text-slate-400">
                Control how AI handles incoming messages and phone calls for your clinic.
              </p>
            </div>
          </div>
          <AiSettingsToggle aiMessaging={settings.aiMessaging} aiCalls={settings.aiCalls} />
        </div>
      </div>

      {/* Test Phone */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
              <span className="material-symbols-outlined">phone_iphone</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface">Test Messaging</h2>
              <p className="text-[11px] text-slate-400">
                Save your phone number and send a test message to verify WhatsApp or SMS delivery.
              </p>
            </div>
          </div>
          <TestPhoneForm currentPhone={settings.testPhoneNumber} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Doctors Section */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-surface-container-high/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">stethoscope</span>
              </div>
              <div>
                <h2 className="font-headline font-bold text-lg text-on-surface">Doctors</h2>
                <p className="text-[11px] text-slate-400">
                  {doctors.filter(d => d.isActive).length} active &middot; {doctors.filter(d => !d.isActive).length} inactive
                </p>
              </div>
            </div>
            <AddDoctorForm />
          </div>
          <div className="px-6 py-2">
            <DoctorList doctors={doctors} />
          </div>
        </div>

        {/* Treatments Section */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-surface-container-high/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">healing</span>
              </div>
              <div>
                <h2 className="font-headline font-bold text-lg text-on-surface">Treatments</h2>
                <p className="text-[11px] text-slate-400">{treatments.length} treatment{treatments.length !== 1 ? 's' : ''} configured</p>
              </div>
            </div>
            <AddTreatmentForm />
          </div>
          <div className="px-6 py-2">
            <TreatmentList treatments={treatments} />
          </div>
        </div>
      </div>
    </div>
  );
}
