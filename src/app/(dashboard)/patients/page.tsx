export const dynamic = 'force-dynamic';

import { getClinicContext } from "@/db/queries/auth";
import { getLabelsForClinic } from "@/lib/labels";
import { getPatientsByClinic, getPatientCount, getNewPatientCountThisMonth } from "@/db/queries/patients";
import { getAppointmentsByPatientIds } from "@/db/queries/appointments";
import PatientSearch from "@/components/PatientSearch";
import PatientModal from "@/components/PatientModal";
import PatientProfileModal from "@/components/PatientProfileModal";
import Link from "next/link";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { clinicId, user } = await getClinicContext();
  const canDelete = user.role === 'admin';
  const search = params.q ?? "";
  const status = params.status ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [data, totalPatients, newThisMonth, labels] = await Promise.all([
    getPatientsByClinic(clinicId, { search, status, page, limit: 20 }),
    getPatientCount(clinicId),
    getNewPatientCountThisMonth(clinicId),
    getLabelsForClinic(clinicId),
  ]);

  // Fetch treatment history for all displayed patients
  const patientIds = data.patients.map((p) => p.id);
  const allAppointments = await getAppointmentsByPatientIds(patientIds, clinicId);

  // Group appointments by patient ID
  const appointmentsByPatient = new Map<string, typeof allAppointments>();
  for (const appt of allAppointments) {
    const list = appointmentsByPatient.get(appt.patientId) ?? [];
    list.push(appt);
    appointmentsByPatient.set(appt.patientId, list);
  }

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const statusStyles: Record<string, { color: string; avatarBg: string }> = {
    active: { color: "bg-green-500/15 text-green-400", avatarBg: "bg-primary-fixed text-primary" },
    new: { color: "bg-blue-500/15 text-blue-400", avatarBg: "bg-secondary-fixed text-secondary" },
    inactive: { color: "bg-surface-container-high text-on-surface-variant", avatarBg: "bg-surface-container-highest text-on-surface-variant" },
  };

  const showingStart = (page - 1) * data.limit + 1;
  const showingEnd = Math.min(page * data.limit, data.total);
  const hasNext = page * data.limit < data.total;
  const hasPrev = page > 1;

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (search) sp.set("q", search);
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/patients${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
        <div>
          <nav className="flex mb-2 space-x-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span>Clinical</span>
            <span>/</span>
            <span className="text-primary">Database</span>
          </nav>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">{labels.customers}</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-4">
            <div className="px-5 py-3 bg-surface-container-lowest border border-outline-variant/10 rounded-xl shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Total {labels.customers}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-headline font-extrabold">{totalPatients.toLocaleString()}</span>
              </div>
            </div>
            <div className="px-5 py-3 bg-surface-container-lowest border border-outline-variant/10 rounded-xl shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">New This Month</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-headline font-extrabold">{newThisMonth}</span>
                <span className="text-xs font-bold text-tertiary">Fresh</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-high text-on-surface text-sm font-semibold rounded-lg hover:bg-surface-container-highest transition-colors active:scale-95">
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Import CSV
            </button>
            <PatientModal />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <PatientSearch search={search} status={status} />

      {/* Patient Table */}
      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Name</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">DOB</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Phone</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Email</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Balance</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Balance</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {data.patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-on-surface-variant">
                    No patients found.
                  </td>
                </tr>
              ) : (
                data.patients.map((p) => {
                  const s = statusStyles[p.status] ?? statusStyles.active;
                  return (
                    <tr key={p.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          <div className={`h-10 w-10 rounded-full ${s.avatarBg} flex items-center justify-center font-bold text-xs mr-3`}>
                            {getInitials(p.fullName)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{p.fullName}</p>
                            <p className="text-[11px] text-on-surface-variant">{p.email ?? "--"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-on-surface">{formatDate(p.dob)}</td>
                      <td className="px-6 py-5 text-sm text-on-surface">{p.phone ?? "--"}</td>
                      <td className="px-6 py-5 text-sm text-on-surface">{p.email ?? "--"}</td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.color}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {(() => {
                          const patAppts = appointmentsByPatient.get(p.id) ?? [];
                          const unpaid = patAppts.reduce((sum, a) => a.paymentStatus !== 'paid' && a.paymentStatus !== 'waived' && a.amountCharged ? sum + (a.amountCharged - a.amountPaid) : sum, 0);
                          if (unpaid > 0) return <span className="text-sm font-bold text-amber-600">{(unpaid / 100).toFixed(2)} BAM</span>;
                          return <span className="text-sm text-outline">--</span>;
                        })()}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <PatientProfileModal patient={p} appointments={appointmentsByPatient.get(p.id) ?? []} canDelete={canDelete} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-surface-container-low/30 border-t border-surface-container-low flex items-center justify-between">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            Showing {data.total === 0 ? 0 : showingStart}-{showingEnd} of {data.total.toLocaleString()} patients
          </p>
          <div className="flex gap-2">
            {hasPrev ? (
              <Link href={pageUrl(page - 1)} className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 hover:bg-surface-container-high transition-colors active:scale-95">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </Link>
            ) : (
              <span className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 opacity-30">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </span>
            )}
            {hasNext ? (
              <Link href={pageUrl(page + 1)} className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 hover:bg-surface-container-high transition-colors active:scale-95">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </Link>
            ) : (
              <span className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 opacity-30">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}