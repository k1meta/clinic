export default function VoiceAIPage() {
  return (
    <div className="p-8 overflow-y-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black font-headline tracking-tight text-on-surface">
            Voice AI Control Center
          </h2>
          <p className="text-slate-500 mt-1">
            Manage your intelligent clinic assistant and patient communication flows.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest text-primary text-sm font-semibold rounded-lg shadow-sm hover:bg-surface transition-colors active:scale-95">
            <span className="material-symbols-outlined text-sm">history</span> View Activity Log
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg shadow-md hover:opacity-90 transition-all active:scale-95">
            <span className="material-symbols-outlined text-sm">add</span> New Automation
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* AI Status Card */}
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
                  <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                  <span className="text-xs font-semibold text-slate-500">NOT CONFIGURED</span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-3 p-1 pl-4 pr-1 bg-surface-container-high rounded-full border border-outline-variant/20 active:scale-95 transition-transform">
              <span className="text-xs font-bold text-slate-400">OFF</span>
              <div className="w-10 h-6 bg-slate-300 rounded-full relative">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
              </div>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
            <div className="p-5 bg-surface-container-low rounded-lg flex flex-col gap-1">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Average Resolution Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-300">--%</span>
              </div>
              <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-3">
                <div className="bg-surface-container-highest h-full rounded-full" style={{ width: "0%" }}></div>
              </div>
            </div>
            <div className="p-5 bg-surface-container-low rounded-lg flex flex-col gap-1">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Calls This Week</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-300">0</span>
              </div>
              <div className="flex gap-1 mt-4 items-end h-8">
                {[0, 0, 0, 0, 0, 0, 0].map((_, i) => (
                  <div key={i} className="flex-1 rounded-t bg-surface-container-high" style={{ height: "4px" }}></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Preview */}
        <div className="col-span-12 lg:col-span-4 glass-card p-6 rounded-xl ai-spark-border flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-headline font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              Active Transcript
            </h3>
            <span className="text-[10px] font-bold text-slate-400 bg-surface-container-high px-2 py-0.5 rounded-full">INACTIVE</span>
          </div>
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">call_end</span>
              <p className="text-sm text-slate-400">No active calls</p>
              <p className="text-xs text-slate-300 mt-1">Voice AI will be available after Vapi configuration</p>
            </div>
          </div>
        </div>

        {/* Automation Cards */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "notification_important", iconBg: "bg-indigo-50 text-indigo-600", title: "Appointment Reminders", desc: "Automated SMS and email reminders sent 24h prior to visit.", enabled: false },
            { icon: "medical_information", iconBg: "bg-teal-50 text-teal-600", title: "Post-Visit Follow-up", desc: "Inquires about recovery and collects patient satisfaction data.", enabled: false },
            { icon: "loop", iconBg: "bg-orange-50 text-orange-600", title: "Re-engagement", desc: "Contact patients who haven't visited in 6+ months.", enabled: false },
          ].map((card) => (
            <div key={card.title} className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-transparent hover:border-primary/10 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-10 h-10 rounded-lg ${card.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <span className="material-symbols-outlined">{card.icon}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked={card.enabled} />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <h4 className="font-bold text-on-surface mb-1">{card.title}</h4>
              <p className="text-xs text-slate-500 mb-6">{card.desc}</p>
              <button className="w-full py-2 px-4 rounded-lg bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container-high transition-colors">
                Edit Template
              </button>
            </div>
          ))}
        </div>

        {/* Call Log */}
        <div className="col-span-12 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between border-b border-surface-container-low">
            <h3 className="font-headline font-bold text-on-surface">Recent Call Log</h3>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                <span className="material-symbols-outlined text-xl">filter_list</span>
              </button>
              <button className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                <span className="material-symbols-outlined text-xl">download</span>
              </button>
            </div>
          </div>
          <div className="px-6 py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">phone_in_talk</span>
            <p className="text-sm text-slate-400">No calls recorded yet</p>
            <p className="text-xs text-slate-300 mt-1">Call logs will appear here once Voice AI is activated</p>
          </div>
        </div>
      </div>
    </div>
  );
}
