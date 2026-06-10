'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  createCampaign,
  launchCampaign,
  previewCampaignAudience,
} from '@/app/actions/campaigns';

type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  status: string;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
};

type AudiencePreview = {
  count: number;
  members: { id: string; fullName: string }[];
};

type Props = {
  campaigns: CampaignRow[];
};

export default function CampaignWizard({ campaigns }: Props) {
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [form, setForm] = useState({
    name: '',
    channel: 'whatsapp' as 'whatsapp' | 'sms' | 'email',
    templateContent: 'Hi {{patient_name}}, we have a special offer this month. Reply to book!',
    inactiveDays: 90,
    hasEmail: false,
    hasPhone: true,
  });

  useEffect(() => {
    setPreview(null);
  }, [form.inactiveDays, form.hasEmail, form.hasPhone, form.channel]);

  function buildSegmentFilter() {
    const filter: Record<string, unknown> = {};
    if (form.inactiveDays > 0) filter.inactiveDays = form.inactiveDays;
    if (form.hasEmail) filter.hasEmail = true;
    if (form.hasPhone) filter.hasPhone = true;
    return filter;
  }

  function handlePreview() {
    startTransition(async () => {
      const res = await previewCampaignAudience(buildSegmentFilter());
      setPreview(res);
    });
  }

  function handleCreate(andLaunch: boolean) {
    setActionError(null);
    setActionNotice(null);
    startTransition(async () => {
      const res = await createCampaign({
        name: form.name,
        channel: form.channel,
        templateContent: form.templateContent,
        segmentFilter: buildSegmentFilter(),
      });
      if ('error' in res && res.error) {
        setActionError(res.error);
        return;
      }
      if (res.success && res.id) {
        if (andLaunch) {
          const launchRes = await launchCampaign(res.id);
          if ('error' in launchRes && launchRes.error) {
            setActionError(launchRes.error);
            return;
          }
          if ('warning' in launchRes && launchRes.warning) {
            setActionNotice(launchRes.warning);
          }
        }
        window.location.reload();
      }
    });
  }

  function handleLaunch(id: string) {
    setActionError(null);
    setActionNotice(null);
    startTransition(async () => {
      const launchRes = await launchCampaign(id);
      if ('error' in launchRes && launchRes.error) {
        setActionError(launchRes.error);
        return;
      }
      if ('warning' in launchRes && launchRes.warning) {
        setActionNotice(launchRes.warning);
      }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-8">
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-headline font-bold text-lg">New campaign</h2>

        <input
          placeholder="Campaign name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full rounded-lg border border-surface-container-high px-3 py-2 text-sm"
        />

        <select
          value={form.channel}
          onChange={(e) =>
            setForm((f) => ({ ...f, channel: e.target.value as 'whatsapp' | 'sms' | 'email' }))
          }
          className="w-full rounded-lg border border-surface-container-high px-3 py-2 text-sm"
        >
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </select>

        <textarea
          value={form.templateContent}
          onChange={(e) => setForm((f) => ({ ...f, templateContent: e.target.value }))}
          rows={3}
          className="w-full rounded-lg border border-surface-container-high px-3 py-2 text-sm font-mono"
        />
        <p className="text-[10px] text-on-surface-variant">Variables: {'{{patient_name}}'}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="number"
              min={0}
              value={form.inactiveDays}
              onChange={(e) => setForm((f) => ({ ...f, inactiveDays: Number(e.target.value) }))}
              className="w-20 rounded-lg border px-2 py-1"
            />
            <span>Days since last visit (0 = all)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hasPhone}
              onChange={(e) => setForm((f) => ({ ...f, hasPhone: e.target.checked }))}
            />
            Require phone
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hasEmail}
              onChange={(e) => setForm((f) => ({ ...f, hasEmail: e.target.checked }))}
            />
            Require email
          </label>
        </div>

        {preview && (
          <div className="rounded-xl border border-surface-container-high bg-surface-container-low/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-on-surface">
              Audience preview — {preview.count} {preview.count === 1 ? 'patient' : 'patients'}
            </p>
            {preview.count === 0 ? (
              <p className="text-sm text-on-surface-variant">No patients match these filters.</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto space-y-1 text-sm text-on-surface-variant">
                {preview.members.map((member) => (
                  <li key={member.id} className="py-0.5">
                    {member.fullName}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {actionError && (
          <p className="text-sm text-red-400 font-medium">{actionError}</p>
        )}
        {actionNotice && (
          <p className="text-sm text-amber-400 font-medium">{actionNotice}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPending}
            className="rounded-lg border border-primary text-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Preview audience
          </button>
          <button
            type="button"
            onClick={() => handleCreate(false)}
            disabled={isPending || !form.name.trim()}
            className="rounded-lg bg-surface-container-high text-on-surface px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => handleCreate(true)}
            disabled={isPending || !form.name.trim()}
            className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Create &amp; send now
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface-variant">
          Past campaigns
        </h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No campaigns yet.</p>
        ) : (
          campaigns.map((c) => (
            <div
              key={c.id}
              className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-semibold text-on-surface">{c.name}</p>
                <p className="text-[11px] text-on-surface-variant">
                  {c.channel} · {c.status} · sent {c.sentCount} · failed {c.failedCount}
                </p>
              </div>
              {(c.status === 'draft' ||
                c.status === 'scheduled' ||
                (c.status === 'sending' && c.sentCount === 0 && c.failedCount === 0)) && (
                <button
                  type="button"
                  onClick={() => handleLaunch(c.id)}
                  disabled={isPending}
                  className="text-sm font-semibold text-primary hover:underline disabled:opacity-60"
                >
                  {c.status === 'sending' ? 'Retry send' : 'Send now'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
