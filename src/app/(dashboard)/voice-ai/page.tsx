export const dynamic = 'force-dynamic';

import { getClinicId } from '@/db/queries/auth';
import { getClinicSettings } from '@/db/queries/clinics';
import { getCallStatsThisWeek, getOpenCallbacks, getRecentCallsByClinic } from '@/db/queries/calls';
import { getVoiceNumbersByClinic } from '@/db/queries/voice-numbers';
import CallbackList from '@/components/CallbackList';
import CallTranscriptPanel from '@/components/CallTranscriptPanel';
import ForwardingGuide from '@/components/ForwardingGuide';

export default async function VoiceAIPage() {
  const clinicId = await getClinicId();
  const [settings, stats, recent, callbacks, numbers] = await Promise.all([
    getClinicSettings(clinicId),
    getCallStatsThisWeek(clinicId),
    getRecentCallsByClinic(clinicId, 20),
    getOpenCallbacks(clinicId),
    getVoiceNumbersByClinic(clinicId),
  ]);

  return (
    <div className="p-8 overflow-y-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black font-headline tracking-tight text-on-surface">
            Voice AI Control Center
          </h2>
          <p className="text-on-surface-variant mt-1">
            AI se javlja na pozive koje ne stignete primiti i zakazuje, pomjera ili otkazuje termine.
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
                  <span className={`w-2 h-2 rounded-full ${settings.aiCalls ? 'bg-green-500' : 'bg-outline'}`}></span>
                  <span className={`text-xs font-semibold ${settings.aiCalls ? 'text-green-400' : 'text-on-surface-variant'}`}>
                    {settings.aiCalls ? 'AKTIVAN' : 'ISKLJUCEN'}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant">
              {settings.aiCalls ? 'ON' : 'OFF'} (Settings)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
            <div className="p-5 bg-surface-container-low rounded-lg flex flex-col gap-1">
              <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider">Booking Resolution Rate (7d)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-on-surface">{stats.resolutionRate}%</span>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-3">
                <div className="bg-primary h-full rounded-full" style={{ width: `${stats.resolutionRate}%` }}></div>
              </div>
            </div>
            <div className="p-5 bg-surface-container-low rounded-lg flex flex-col gap-1">
              <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider">Total Calls This Week</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-on-surface">{stats.total}</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-2">{stats.resolved} calls zavrsilo uspjesnim zakazivanjem.</p>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 glass-card p-6 rounded-xl ai-spark-border flex flex-col shadow-sm">
          <h3 className="font-headline font-bold text-on-surface mb-3">Transcripts</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Select any call below to read the full conversation.
          </p>
          <p className="text-xs text-on-surface-variant mt-4">
            {recent.filter((c) => c.transcript?.trim()).length} of {recent.length} recent calls have transcripts.
          </p>
        </div>

        <CallbackList callbacks={callbacks} timeZone={settings.timezone} />

        <ForwardingGuide numbers={numbers.filter((n) => n.isActive).map((n) => n.e164)} />

        <CallTranscriptPanel calls={recent} />
      </div>
    </div>
  );
}
