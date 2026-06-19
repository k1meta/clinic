'use client';

import { useState, useTransition } from 'react';
import { updateDepositSettings } from '@/app/actions/clinic-settings';
import type { PaymentGateway } from '@/db/queries/clinics';

interface Props {
  depositEnabled: boolean;
  depositAmount: number; // minor units (BAM*100)
  paymentGateway: PaymentGateway;
  noShowBaseline: number; // 0..1
}

export default function DepositSettingsForm({
  depositEnabled,
  depositAmount,
  paymentGateway,
  noShowBaseline,
}: Props) {
  const [enabled, setEnabled] = useState(depositEnabled);
  const [amount, setAmount] = useState(Math.round(depositAmount / 100));
  const [gateway, setGateway] = useState<PaymentGateway>(paymentGateway);
  const [baselinePct, setBaselinePct] = useState(Math.round(noShowBaseline * 100));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    startTransition(async () => {
      const result = await updateDepositSettings({
        depositEnabled: enabled,
        depositAmountBam: amount,
        paymentGateway: gateway,
        noShowBaselinePct: baselinePct,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-on-surface">Require a booking deposit</p>
          <p className="text-[11px] text-on-surface-variant">
            Optional. Off by default &mdash; most clients pay cash. When on, new bookings can be asked for a deposit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          disabled={isPending}
          className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (enabled ? 'bg-primary' : 'bg-surface-container-highest')}
        >
          <span className={'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' + (enabled ? 'translate-x-6' : 'translate-x-1')} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Deposit (BAM)</label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            disabled={!enabled}
            className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Payment method</label>
          <select
            value={gateway}
            onChange={(e) => setGateway(e.target.value as PaymentGateway)}
            disabled={!enabled}
            className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body disabled:opacity-50"
          >
            <option value="none">Cash / manual (default)</option>
            <option value="monri">Monri (online card)</option>
            <option value="wspay">WSPay (online card)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">No-show baseline %</label>
          <input
            type="number"
            min={0}
            max={100}
            value={baselinePct}
            onChange={(e) => setBaselinePct(Number(e.target.value))}
            className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
          />
        </div>
      </div>
      <p className="text-[11px] text-on-surface-variant">
        No-show baseline is used only for the ROI &ldquo;cost avoided&rdquo; estimate on the Analytics page.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md active:scale-95 transition-all disabled:opacity-50"
        >
          {isPending ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </button>
        {error && <p className="text-error text-xs font-medium">{error}</p>}
      </div>
    </form>
  );
}
