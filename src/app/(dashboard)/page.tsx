export const dynamic = 'force-dynamic';

import { getClinicId } from "@/db/queries/auth";
import {
  getTodayAppointmentCount,
  getUpcomingAppointments,
  getNoShowRate,
  getWeeklyOccupancy,
  getMonthlyRevenue,
} from "@/db/queries/appointments";
import { getDoctorsByClinic } from "@/db/queries/doctors";
import { getTreatmentTypesByClinic } from "@/db/queries/treatment-types";
import { getAllPatients } from "@/db/queries/patients";
import AppointmentModal from "@/components/AppointmentModal";

export default async function OverviewPage() {
  const clinicId = await getClinicId();

  const [todayCount, noShowRate, upcoming, weeklyOccupancy, doctors, treatmentTypes, patientsList, monthlyRevenue] = await Promise.all([
    getTodayAppointmentCount(clinicId),
    getNoShowRate(clinicId),
    getUpcomingAppointments(clinicId, 5),
    getWeeklyOccupancy(clinicId),
    getDoctorsByClinic(clinicId),
    getTreatmentTypesByClinic(clinicId),
    getAllPatients(clinicId),
    getMonthlyRevenue(clinicId),
  ]);

  function formatTime(date: Date) {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }

  const statusStyles: Record<string, string> = {
    arrived: "bg-green-100 text-green-700",
    confirmed: "bg-primary/10 text-primary",
    completed: "bg-slate-100 text-slate-600",
    no_show: "bg-error/10 text-error",
    cancelled: "bg-slate-100 text-slate-400",
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-headline font-extrabold tracking-tight text-on-surface">
            Clinic Overview
          </h1>
          <p className="text-on-surface-variant mt-1 text-sm">
            Real-time performance and patient intake management.
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon="event_available"
          iconBg="bg-primary/10"
          iconColor="text-primary"
          label="Today's Appointments"
          value={String(todayCount)}
        />
        <MetricCard
          icon="person_cancel"
          iconBg="bg-tertiary/10"
          iconColor="text-tertiary"
          label="No-Show Rate (30d)"
          value={`${noShowRate}%`}
          sub={noShowRate < 5 ? "On target" : "Needs attention"}
          subColor={noShowRate < 5 ? "text-green-600" : "text-tertiary"}
          subIcon={noShowRate < 5 ? "trending_down" : "trending_up"}
        />
        <MetricCard
          icon="payments"
          iconBg="bg-green-100"
          iconColor="text-green-600"
          label="Revenue This Month"
          value={`${(monthlyRevenue.paid / 100).toFixed(0)} BAM`}
          sub={monthlyRevenue.pending > 0 ? `${(monthlyRevenue.pending / 100).toFixed(0)} BAM pending` : "All collected"}
          subColor={monthlyRevenue.pending > 0 ? "text-amber-600" : "text-green-600"}
          subIcon={monthlyRevenue.pending > 0 ? "schedule" : "check_circle"}
        />
        <MetricCard
          icon="error"
          iconBg="bg-error/10"
          iconColor="text-error"
          label="Active Alerts"
          value="--"
          sub="Coming soon"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column ? Upcoming Appointments */}
        <div className="lg:col-span-2">
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm h-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-headline font-extrabold text-lg text-on-surface">Upcoming Appointments</h3>
              <a className="text-xs font-bold text-primary hover:underline" href="/calendar">View Calendar</a>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No upcoming appointments</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
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
                        {apt.treatmentType?.name ?? "General"}
                      </td>
                      <td className="py-4 px-2 text-sm font-medium">{formatTime(apt.startsAt)}</td>
                      <td className="py-4 px-2 text-right">
                        <span className={`px-3 py-1 ${statusStyles[apt.status] ?? "bg-slate-100 text-slate-600"} text-[10px] font-bold rounded-full capitalize`}>
                          {apt.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column ? Weekly Occupancy + Smart Alerts */}
        <div className="space-y-6">
          {/* Weekly Occupancy */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline font-extrabold text-base text-on-surface">Weekly Occupancy</h3>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary"></div> Scheduled
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between h-36 gap-2">
              {weeklyOccupancy.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full bg-surface-container-low rounded-t-md relative h-full flex flex-col justify-end">
                    {d.pct > 0 ? (
                      <div
                        className="w-full bg-primary/20 rounded-t-md group-hover:bg-primary transition-colors relative"
                        style={{ height: `${Math.max(d.pct, 4)}%` }}
                      >
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-primary/60 group-hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                          {d.count}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-[2px] bg-surface-container-high rounded-t-md"></div>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400">{d.day.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Smart Alerts */}
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col border border-surface-container-high/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline font-extrabold text-base text-on-surface">Smart Alerts</h3>
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            </div>
            <p className="text-sm text-slate-400 py-4 text-center">Alert system will be available in a future update.</p>
            <button className="mt-4 pt-4 w-full text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-primary transition-colors text-center border-t border-surface-container-high/30">
              View Activity History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon, iconBg, iconColor, label, value, sub, subColor, subIcon,
}: {
  icon: string; iconBg: string; iconColor: string; label: string; value: string;
  sub?: string; subColor?: string; subIcon?: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-container-high/50 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${iconColor} text-lg`}>{icon}</span>
        </div>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-headline">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-headline font-black">{value}</span>
        {sub && (
          <span className={`text-[10px] font-bold ${subColor || "text-slate-400"} flex items-center`}>
            {subIcon && <span className="material-symbols-outlined text-xs mr-0.5">{subIcon}</span>}
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}