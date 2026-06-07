export const dynamic = 'force-dynamic';

import { getClinicId } from '@/db/queries/auth';
import { getClinicSettings } from '@/db/queries/clinics';
import { getCallStatsThisWeek, getRecentCallsByClinic } from '@/db/queries/calls';

function formatDuration(durationSec: number | null) {
  if (!durationSec || durationSec <= 0) return '--';
  const min = Math.floor(durationSec / 60);
  const sec = durationSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export default async function VoiceAIPage() {
  const clinicId = await getClinicId();
  const [settings, stats, recent] = await Promise.all([
    getClinicSettings(clinicId),
    getCallStatsThisWeek(clinicId),
    getRecentCallsByClinic(clinicId, 12),
  ]);

  return (
    <div className="p-8 overflow-y-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black font-headline tracking-tight text-on-surface">
            Voice AI Control Center
          </h2>
          <p className="text-slate-500 mt-1">
            Real-time AI pozivi — Retell (BCS) i ElevenLabs (English) za zakazivanje, pomjeranje i otkazivanje.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest p-6 rounded-xl relative overflow-hidden flex flex-col gap-8 shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-primary-container/10 text-primary">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
              </div>
              <div>
                <h3 className="text-lg font-bold font-headline">AI Call Handler Status</h3>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${settings.aiCalls ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                  <span className={`text-xs font-semibold ${settings.aiCalls ? 'text-green-600' : 'text-slate-500'}`}>
                    {settings.aiCalls ? 'AKTIVAN' : 'ISKLJUCEN'}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-surface-container-high text-slate-500">
              {settings.aiCalls ? 'ON' : 'OFF'} (Settings)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
            <div className="p-5 bg-surface-container-low rounded-lg flex flex-col gap-1">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Booking Resolution Rate (7d)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-700">{stats.resolutionRate}%</span>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-3">
                <div className="bg-primary h-full rounded-full" style={{ width: `${stats.resolutionRate}%` }}></div>
              </div>
            </div>
            <div className="p-5 bg-surface-container-low rounded-lg flex flex-col gap-1">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Calls This Week</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-700">{stats.total}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">{stats.resolved} calls zavrsilo uspjesnim zakazivanjem.</p>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 glass-card p-6 rounded-xl ai-spark-border flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline font-bold text-on-surface">Latest Transcript</h3>
          </div>
          {recent[0]?.transcript ? (
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto no-scrollbar">{recent[0].transcript}</p>
          ) : (
            <div className="flex-1 flex items-center justify-center py-12 text-center">
              <div>
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">call_end</span>
                <p className="text-sm text-slate-400">No transcripts yet</p>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-12 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-surface-container-low">
            <h3 className="font-headline font-bold text-on-surface">Recent Call Log</h3>
          </div>
          {recent.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">phone_in_talk</span>
              <p className="text-sm text-slate-400">No calls recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-container-low">
              {recent.map((call) => (
                <div key={call.id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">
                      {call.patient?.fullName ?? call.fromNumber ?? 'Unknown caller'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {call.provider} • {call.outcome ?? 'no_outcome'} • {call.status} • {call.direction}
                      {call.startedAt ? ` • ${new Date(call.startedAt).toLocaleString('bs-BA')}` : ''}
                    </p>
                    {call.summary && <p className="text-xs text-slate-600 mt-2">{call.summary}</p>}
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-surface-container-low px-2 py-1 rounded shrink-0">
                    {formatDuration(call.durationSec ?? null)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
