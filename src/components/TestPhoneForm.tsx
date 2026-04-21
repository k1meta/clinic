'use client';

import { useState, useTransition } from 'react';
import { updateTestPhone, sendTestMessage } from '@/app/actions/clinic-settings';

interface Props {
  currentPhone: string;
}

export default function TestPhoneForm({ currentPhone }: Props) {
  const [phone, setPhone] = useState(currentPhone);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleSave() {
    setStatus(null);
    startTransition(async () => {
      const result = await updateTestPhone({ phone: phone.trim() });
      if ('error' in result && result.error) {
        setStatus({ type: 'error', text: result.error });
      } else {
        setStatus({ type: 'success', text: 'Phone number saved' });
        setTimeout(() => setStatus(null), 3000);
      }
    });
  }

  function handleSendTest(channel: 'whatsapp' | 'sms') {
    setSendStatus(null);
    startTransition(async () => {
      const result = await sendTestMessage({ channel });
      if ('error' in result && result.error) {
        setSendStatus({ type: 'error', text: result.error });
      } else if ('message' in result && result.message) {
        setSendStatus({ type: 'success', text: result.message });
        setTimeout(() => setSendStatus(null), 5000);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Phone input + save */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs font-semibold text-on-surface mb-1 block">
            Test Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+38761123456"
            className="w-full px-3 py-2 rounded-lg border border-surface-container-high bg-surface-container-lowest text-sm text-on-surface placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            E.164 format with country code (e.g. +38761123456)
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 h-[38px]"
        >
          {isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      {status && (
        <p className={"text-xs font-medium " + (status.type === 'error' ? 'text-red-600' : 'text-green-600')}>
          {status.text}
        </p>
      )}

      {/* Send test buttons */}
      <div className="pt-2 border-t border-surface-container-high/30">
        <p className="text-xs font-semibold text-on-surface mb-2">Send Test Message</p>
        <div className="flex gap-3">
          <button
            onClick={() => handleSendTest('whatsapp')}
            disabled={isPending || !phone.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366]/10 text-[#25D366] text-sm font-semibold hover:bg-[#25D366]/20 transition-colors disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </button>
          <button
            onClick={() => handleSendTest('sms')}
            disabled={isPending || !phone.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-600 text-sm font-semibold hover:bg-blue-500/20 transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">sms</span>
            SMS
          </button>
        </div>
      </div>

      {sendStatus && (
        <p className={"text-xs font-medium " + (sendStatus.type === 'error' ? 'text-red-600' : 'text-green-600')}>
          {sendStatus.text}
        </p>
      )}
    </div>
  );
}
