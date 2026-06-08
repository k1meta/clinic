export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/db/queries/auth';
import { getAutomations } from '@/app/actions/automations';
import AutomationsPanel from '@/components/AutomationsPanel';

export default async function AutomationsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/');
  }

  const automations = await getAutomations();

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-4xl">
      <div className="mb-10">
        <nav className="flex mb-2 space-x-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          <span>Engagement</span>
          <span>/</span>
          <span className="text-primary">Automations</span>
        </nav>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
          Customer Engagement Funnels
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Event-driven automations tied to bookings — reminders, follow-ups, re-engagement, and review requests.
        </p>
      </div>

      <AutomationsPanel automations={automations} />
    </div>
  );
}
