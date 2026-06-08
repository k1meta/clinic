'use client';

import { useState, useTransition } from 'react';
import { updateAiSettings } from '@/app/actions/clinic-settings';

interface Props {
  aiMessaging: boolean;
  aiCalls: boolean;
}

export default function AiSettingsToggle({ aiMessaging, aiCalls }: Props) {
  const [messaging, setMessaging] = useState(aiMessaging);
  const [calls, setCalls] = useState(aiCalls);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleToggle(field: 'aiMessaging' | 'aiCalls') {
    const newMessaging = field === 'aiMessaging' ? !messaging : messaging;
    const newCalls = field === 'aiCalls' ? !calls : calls;
    setMessaging(newMessaging);
    setCalls(newCalls);

    startTransition(async () => {
      await updateAiSettings({ aiMessaging: newMessaging, aiCalls: newCalls });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      {/* AI Messaging */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-on-surface">AI Message Handling</p>
          <p className="text-[11px] text-on-surface-variant">
            When enabled, AI automatically handles structured patient replies (confirm, cancel, reschedule) via WhatsApp.
          </p>
        </div>
        <button
          onClick={() => handleToggle('aiMessaging')}
          disabled={isPending}
          className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " + (messaging ? 'bg-primary' : 'bg-surface-container-highest')}
        >
          <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (messaging ? 'translate-x-6' : 'translate-x-1')} />
        </button>
      </div>

      {/* AI Calls (future) */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-on-surface">AI Call Handling</p>
          <p className="text-[11px] text-on-surface-variant">
            When enabled, AI answers incoming phone calls, checks availability, and books appointments. (Coming soon)
          </p>
        </div>
        <button
          onClick={() => handleToggle('aiCalls')}
          disabled={isPending}
          className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " + (calls ? 'bg-primary' : 'bg-surface-container-highest')}
        >
          <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (calls ? 'translate-x-6' : 'translate-x-1')} />
        </button>
      </div>

      {saved && (
        <p className="text-xs text-green-400 font-medium">Settings saved</p>
      )}
    </div>
  );
}
