export const dynamic = 'force-dynamic';

import { getClinicId } from "@/db/queries/auth";
import { getAppointmentsByDate } from "@/db/queries/appointments";
import { getDoctorsByClinic } from "@/db/queries/doctors";
import { getTreatmentTypesByClinic } from "@/db/queries/treatment-types";
import { getAllPatients } from "@/db/queries/patients";
import { getClinicSettings } from "@/db/queries/clinics";
import AppointmentModal from "@/components/AppointmentModal";
import AppointmentStatusMenu from "@/components/AppointmentStatusMenu";
import Link from "next/link";

const ROW_HEIGHT_PX = 96;
const PX_PER_MIN = ROW_HEIGHT_PX / 60;

const STATUS_STYLES: Record<string, { bg: string; border: string; textColor: string; badge?: string; badgeBg?: string }> = {
  confirmed: { bg: "bg-primary-fixed", border: "border-primary", textColor: "text-on-primary-fixed-variant" },
  arrived:   { bg: "bg-secondary-fixed", border: "border-secondary", textColor: "text-on-secondary-fixed-variant", badge: "Arrived", badgeBg: "bg-green-100 text-green-700" },
  completed: { bg: "bg-surface-container-high", border: "border-slate-400", textColor: "text-slate-600" },
  no_show:   { bg: "bg-error/10", border: "border-error", textColor: "text-error" },
  cancelled: { bg: "bg-surface-container-high", border: "border-slate-300", textColor: "text-slate-400" },
};

function formatDateParam(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatHourLabel(h: number) {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

function formatTime(date: Date) {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const clinicId = await getClinicId();

  const today = new Date();
  const selectedDate = params.date ? new Date(params.date + 'T00:00:00') : today;
  if (isNaN(selectedDate.getTime())) selectedDate.setTime(today.getTime());
  const dateStr = formatDateParam(selectedDate);

  const prevDate = new Date(selectedDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(selectedDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const [appointmentsRaw, doctors, treatmentTypes, patientsList, settings] = await Promise.all([
    getAppointmentsByDate(clinicId, selectedDate),
    getDoctorsByClinic(clinicId),
    getTreatmentTypesByClinic(clinicId),
    getAllPatients(clinicId),
    getClinicSettings(clinicId),
  ]);

  const dateLabel = selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const isToday = formatDateParam(selectedDate) === formatDateParam(today);

  // --- Dynamic grid range: configured work hours + auto-extend for out-of-hours appointments ---
  let gridStart = settings.workHours.start;
  let gridEnd = settings.workHours.end;

  for (const apt of appointmentsRaw) {
    const s = new Date(apt.startsAt);
    const e = new Date(apt.endsAt);
    const startH = s.getHours();
    const endH = e.getHours() + (e.getMinutes() > 0 ? 1 : 0);
    if (startH < gridStart) gridStart = startH;
    if (endH > gridEnd) gridEnd = endH;
  }

  const TIME_SLOTS: string[] = [];
  for (let h = gridStart; h < gridEnd; h++) {
    TIME_SLOTS.push(formatHourLabel(h));
  }
  const GRID_START_HOUR = gridStart;

  // Group appointments by doctor
  const byDoctor = new Map<string, typeof appointmentsRaw>();
  for (const doc of doctors) byDoctor.set(doc.id, []);
  for (const apt of appointmentsRaw) {
    const list = byDoctor.get(apt.doctor.id);
    if (list) list.push(apt);
  }

  function getPosition(startsAt: Date, endsAt: Date) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const minutesSinceStart = (start.getHours() - GRID_START_HOUR) * 60 + start.getMinutes();
    const durationMin = (end.getTime() - start.getTime()) / 60000;
    return {
      top: Math.max(0, minutesSinceStart * PX_PER_MIN),
      height: Math.max(24, durationMin * PX_PER_MIN),
    };
  }

  function formatDuration(startsAt: Date, endsAt: Date) {
    const dur = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000;
    return `${dur}m`;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface">
      {/* Calendar Header */}
      <div className="px-8 py-6 flex flex-col gap-6 bg-surface-container-lowest">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-headline font-extrabold tracking-tight">{dateLabel}</h2>
            <div className="flex items-center bg-surface-container-low rounded-lg p-1">
              <Link href={`/calendar?date=${formatDateParam(prevDate)}`} className="p-1.5 hover:bg-white rounded-md transition-all">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </Link>
              <Link href="/calendar" className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${isToday ? 'bg-primary text-white shadow-sm' : 'bg-white shadow-sm'}`}>
                Today
              </Link>
              <Link href={`/calendar?date=${formatDateParam(nextDate)}`} className="p-1.5 hover:bg-white rounded-md transition-all">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {doctors.slice(0, 3).map((doc) => {
                const initials = doc.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2);
                return (
                  <div key={doc.id} className="w-8 h-8 rounded-full bg-primary-fixed border-2 border-white flex items-center justify-center text-[10px] font-bold text-primary">
                    {initials}
                  </div>
                );
              })}
              {doctors.length > 3 && (
                <div className="w-8 h-8 rounded-full bg-surface-container-high border-2 border-white flex items-center justify-center text-[10px] font-bold">
                  +{doctors.length - 3}
                </div>
              )}
            </div>
            <AppointmentModal
              doctors={doctors}
              treatmentTypes={treatmentTypes}
              patients={patientsList}
              defaultDate={dateStr}
            />
          </div>
        </div>
      </div>

      {/* Calendar Grid + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto no-scrollbar relative">
          {/* Grid Labels */}
          <div className="sticky top-0 z-20 grid bg-surface-container-low/95 backdrop-blur-sm border-b border-outline-variant/10" style={{ gridTemplateColumns: `100px repeat(${doctors.length}, 1fr)` }}>
            <div className="p-4"></div>
            {doctors.map((doc) => (
              <div key={doc.id} className="p-4 text-center border-l border-outline-variant/10">
                <p className="text-sm font-bold">{doc.fullName}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">{doc.specialty}</p>
              </div>
            ))}
          </div>

          {/* Calendar Content */}
          <div className="relative" style={{ gridTemplateColumns: `100px repeat(${doctors.length}, 1fr)`, display: "grid" }}>
            <div className="flex flex-col">
              {TIME_SLOTS.map((t, idx) => {
                const slotHour = GRID_START_HOUR + idx;
                const isOutside = slotHour < settings.workHours.start || slotHour >= settings.workHours.end;
                return (
                  <div key={t} className={`h-24 p-4 text-right border-r border-outline-variant/10 ${isOutside ? 'bg-slate-50/80' : ''}`}>
                    <span className={`text-xs font-medium ${isOutside ? 'text-slate-300 italic' : 'text-slate-400'}`}>{t}</span>
                    {isOutside && <p className="text-[8px] text-slate-300 mt-0.5">After hours</p>}
                  </div>
                );
              })}
            </div>

            {doctors.map((doc) => {
              const docAppointments = byDoctor.get(doc.id) ?? [];
              return (
                <div key={doc.id} className="relative border-r border-outline-variant/10 bg-white/50">
                  <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateRows: `repeat(${TIME_SLOTS.length}, 1fr)` }}>
                    {TIME_SLOTS.map((_, i) => {
                      const slotHour = GRID_START_HOUR + i;
                      const isOutside = slotHour < settings.workHours.start || slotHour >= settings.workHours.end;
                      return (
                        <div key={i} className={`border-b border-outline-variant/5 ${isOutside ? 'bg-slate-50/60' : ''}`}></div>
                      );
                    })}
                  </div>
                  {docAppointments.map((apt) => {
                    const pos = getPosition(apt.startsAt, apt.endsAt);
                    const style = STATUS_STYLES[apt.status] ?? STATUS_STYLES.confirmed;
                    const timeStr = formatTime(apt.startsAt);
                    return (
                      <AppointmentStatusMenu key={apt.id} appointmentId={apt.id} currentStatus={apt.status}>
                        <div
                          className={`absolute left-2 right-2 ${style.bg} border-l-4 ${style.border} rounded-lg p-2 shadow-sm z-10 cursor-pointer hover:scale-[1.02] transition-transform`}
                          style={{ top: `${pos.top}px`, height: `${pos.height}px` }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="min-w-0">
                              <p className={`text-[11px] font-bold ${style.textColor} truncate`}>
                                <span className="opacity-70">{timeStr}</span> &mdash; {apt.patient.fullName}
                              </p>
                              <p className={`text-[9px] ${style.textColor} opacity-70`}>
                                {apt.treatmentType?.name ?? "Appointment"} &bull; {formatDuration(apt.startsAt, apt.endsAt)}
                                {apt.amountCharged != null && (
                                  <span className={`ml-1 inline-flex items-center font-bold ${apt.paymentStatus === 'paid' ? 'text-green-600' : apt.paymentStatus === 'waived' ? 'text-slate-400' : apt.paymentStatus === 'partial' ? 'text-blue-600' : 'text-amber-600'}`}>
                                    &bull; {apt.paymentStatus === 'partial' ? `${(apt.amountPaid / 100).toFixed(0)}/${(apt.amountCharged / 100).toFixed(0)}` : (apt.amountCharged / 100).toFixed(0)} BAM {apt.paymentStatus === 'paid' ? '\u2713' : apt.paymentStatus === 'waived' ? '~' : ''}
                                  </span>
                                )}
                              </p>
                            </div>
                            {style.badge && (
                              <span className={`${style.badgeBg} text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tighter shrink-0`}>
                                {style.badge}
                              </span>
                            )}
                          </div>
                          {apt.notes && pos.height > 48 && (
                            <div className="mt-1 p-1 bg-white/40 rounded text-[9px] font-medium italic truncate">
                              &quot;{apt.notes}&quot;
                            </div>
                          )}
                        </div>
                      </AppointmentStatusMenu>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Waiting List Sidebar */}
        <aside className="w-80 bg-surface-container-low border-l border-outline-variant/10 p-6 overflow-y-auto no-scrollbar hidden lg:block">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Waiting List</h3>
            <span className="bg-surface-container-high text-slate-500 text-[10px] font-black px-2 py-0.5 rounded-full">0</span>
          </div>
          <p className="text-sm text-slate-400 text-center py-8">No patients on the waiting list.</p>
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <span className="text-xs font-bold text-primary">AI Intelligence</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Waiting list automation will suggest optimal slot fills when cancellations occur.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}