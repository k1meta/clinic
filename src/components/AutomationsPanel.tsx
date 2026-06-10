'use client';

import { useState, useTransition } from 'react';
import {
  toggleAutomation,
  updateAutomationTemplate,
  updateAutomationChannel,
} from '@/app/actions/automations';
import type { AutomationTypeName } from '@/db/schema/automations';

export type AutomationRow = {
  id: string;
  type: AutomationTypeName;
  isEnabled: boolean;
  channel: string;
  templateContent: string;
};

const AUTOMATION_META: Record<
  AutomationTypeName,
  { label: string; description: string; variables: string; templateLocked?: boolean }
> = {
  reminder_48h: {
    label: '48h Appointment Reminder',
    description: 'WhatsApp template with confirm / cancel / reschedule buttons, sent 48 hours before the appointment.',
    variables: '{{patient_name}}, {{date}}, {{time}}, {{doctor}}',
    templateLocked: true,
  },
  reminder_2h: {
    label: '2h SMS Nudge',
    description: 'SMS fallback when the patient has not confirmed via WhatsApp within 2 hours of the appointment.',
    variables: '{{patient_name}}, {{date}}, {{time}}, {{doctor}}',
  },
  post_visit: {
    label: 'Post-Visit Thank You',
    description: 'Sent the day after a completed visit.',
    variables: '{{patient_name}}, {{clinic_name}}',
  },
  re_engagement: {
    label: 'Re-Engagement',
    description: 'Weekly scan for patients inactive 6+ months. Tries WhatsApp, then SMS, then email.',
    variables: '{{patient_name}}, {{clinic_name}}',
  },
  review_request: {
    label: 'Google Review Request',
    description: 'Sent after a patient\'s first completed visit. WhatsApp template primary; SMS/email fallback if needed.',
    variables: '{{patient_name}}, {{review_url}}',
    templateLocked: true,
  },
};

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp only' },
  { value: 'sms', label: 'SMS only' },
  { value: 'email', label: 'Email only' },
  { value: 'whatsapp,sms,email', label: 'WhatsApp → SMS → Email cascade' },
  { value: 'whatsapp,sms', label: 'WhatsApp → SMS cascade' },
  { value: 'sms,email', label: 'SMS → Email cascade' },
];

export default function AutomationsPanel({ automations }: { automations: AutomationRow[] }) {
  const [rows, setRows] = useState(automations);
  const [isPending, startTransition] = useTransition();
  const [savedId, setSavedId] = useState<string | null>(null);

  function flash(id: string) {
    setSavedId(id);
    setTimeout(() => setSavedId(null), 2000);
  }

  function handleToggle(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isEnabled: !r.isEnabled } : r)));
    startTransition(async () => {
      await toggleAutomation(id);
      flash(id);
    });
  }

  function handleChannelChange(id: string, channel: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, channel } : r)));
    startTransition(async () => {
      await updateAutomationChannel(id, channel);
      flash(id);
    });
  }

  function handleTemplateSave(id: string, templateContent: string) {
    startTransition(async () => {
      await updateAutomationTemplate(id, templateContent);
      flash(id);
    });
  }

  return (
    <div className="space-y-6">
      {rows.map((row) => {
        const meta = AUTOMATION_META[row.type];
        return (
          <div
            key={row.id}
            className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-surface-container-low flex items-start justify-between gap-4">
              <div>
                <h3 className="font-headline font-bold text-lg text-on-surface">{meta.label}</h3>
                <p className="text-[11px] text-on-surface-variant mt-1 max-w-xl">{meta.description}</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(row.id)}
                disabled={isPending}
                aria-label={`Toggle ${meta.label}`}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  row.isEnabled ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    row.isEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Channel
                  </label>
                  <select
                    value={row.channel}
                    onChange={(e) => handleChannelChange(row.id, e.target.value)}
                    disabled={isPending || meta.templateLocked}
                    className="form-control mt-1 disabled:opacity-60"
                  >
                    {CHANNEL_OPTIONS.filter((o) =>
                      meta.templateLocked ? o.value.startsWith('whatsapp') : true,
                    ).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {meta.templateLocked && (
                    <p className="text-[10px] text-on-surface-variant mt-1">
                      Meta-approved WhatsApp template required for this funnel.
                    </p>
                  )}
                </div>
              </div>

              {!meta.templateLocked && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Message template
                  </label>
                  <p className="text-[10px] text-on-surface-variant mb-1">Variables: {meta.variables}</p>
                  <textarea
                    defaultValue={row.templateContent}
                    rows={3}
                    className="form-control font-mono"
                    onBlur={(e) => {
                      if (e.target.value !== row.templateContent) {
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, templateContent: e.target.value } : r,
                          ),
                        );
                        handleTemplateSave(row.id, e.target.value);
                      }
                    }}
                  />
                </div>
              )}

              {savedId === row.id && (
                <p className="text-xs text-green-400 font-medium">Saved</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
