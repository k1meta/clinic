export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/db/queries/auth';
import { getAllDoctorsByClinic } from '@/db/queries/doctors';
import { getAllTreatmentTypesByClinic } from '@/db/queries/treatment-types';
import { getClinicSettings } from '@/db/queries/clinics';
import { getStaffMembers } from '@/app/actions/staff';
import AddDoctorForm from '@/components/AddDoctorForm';
import AddTreatmentForm from '@/components/AddTreatmentForm';
import DoctorList from '@/components/DoctorList';
import TreatmentList from '@/components/TreatmentList';
import WorkHoursForm from '@/components/WorkHoursForm';
import AiSettingsToggle from '@/components/AiSettingsToggle';
import TestPhoneForm from '@/components/TestPhoneForm';
import RunReminderScanButton from '@/components/RunReminderScanButton';
import GoogleReviewUrlForm from '@/components/GoogleReviewUrlForm';
import TeamPanel from '@/components/TeamPanel';
import ChangeOwnPasswordForm from '@/components/ChangeOwnPasswordForm';
import VerticalSettingsForm from '@/components/VerticalSettingsForm';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    redirect('/');
  }

  const clinicId = admin.clinicId;

  const [doctors, treatments, settings, staffMembers] = await Promise.all([
    getAllDoctorsByClinic(clinicId),
    getAllTreatmentTypesByClinic(clinicId),
    getClinicSettings(clinicId),
    getStaffMembers(),
  ]);

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-10">
        <nav className="flex mb-2 space-x-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          <span>Clinic</span>
          <span>/</span>
          <span className="text-primary">Settings</span>
        </nav>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">Settings</h1>
        <p className="text-sm text-on-surface-variant mt-1">Manage your clinic&apos;s schedule, doctors, treatments, and AI features.</p>
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
              <p className="text-[11px] text-on-surface-variant">
                WhatsApp and the phone AI only offer appointments inside these hours.
              </p>
            </div>
          </div>
          <WorkHoursForm current={settings.weekHours} />
        </div>
      </div>

      {/* Business vertical */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined">storefront</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface">Business type</h2>
              <p className="text-[11px] text-on-surface-variant">
                Tailors automation copy and UI labels for your industry (clinic, salon, vet, etc.).
              </p>
            </div>
          </div>
          <VerticalSettingsForm vertical={settings.vertical} />
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
              <p className="text-[11px] text-on-surface-variant">
                Control how AI handles incoming messages and phone calls for your clinic.
              </p>
            </div>
          </div>
          <AiSettingsToggle aiMessaging={settings.aiMessaging} aiCalls={settings.aiCalls} />
        </div>
      </div>

      {/* Google review (first visit WhatsApp) */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined">reviews</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface">Google reviews</h2>
              <p className="text-[11px] text-on-surface-variant">
                After a patient&apos;s first completed appointment, we can send one WhatsApp message (with delay) asking for a review. Requires an approved WhatsApp template (see docs).
              </p>
            </div>
          </div>
          <GoogleReviewUrlForm currentUrl={settings.googleReviewUrl} />
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
              <p className="text-[11px] text-on-surface-variant">
                Save your phone number and send a test message to verify WhatsApp or SMS delivery.
              </p>
            </div>
          </div>
          <TestPhoneForm currentPhone={settings.testPhoneNumber} />
        </div>
      </div>

      {/* Reminder Scan */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">notifications_active</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface">Reminder Scan</h2>
              <p className="text-[11px] text-on-surface-variant">
                Manually trigger the 48 h / 2 h / post-visit reminder scanners.
              </p>
            </div>
          </div>
          <RunReminderScanButton />
        </div>
      </div>

      {/* Account Security */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">lock</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface">Account Security</h2>
              <p className="text-[11px] text-on-surface-variant">
                Change your admin login password. You will need your current password to confirm.
              </p>
            </div>
          </div>
          <ChangeOwnPasswordForm adminEmail={admin.email} />
        </div>
      </div>

      {/* Team */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined">groups</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface">Team</h2>
              <p className="text-[11px] text-on-surface-variant">
                Add staff with login credentials and manage their name, email, or password. They sign in via the Staff portal.
              </p>
            </div>
          </div>
          <TeamPanel members={staffMembers} currentUserId={admin.id} />
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
                <p className="text-[11px] text-on-surface-variant">
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
                <p className="text-[11px] text-on-surface-variant">{treatments.length} treatment{treatments.length !== 1 ? 's' : ''} configured</p>
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
