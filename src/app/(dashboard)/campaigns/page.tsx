export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/db/queries/auth';
import { getCampaigns } from '@/app/actions/campaigns';
import CampaignWizard from '@/components/CampaignWizard';

export default async function CampaignsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/');
  }

  const campaigns = await getCampaigns();

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-4xl">
      <div className="mb-10">
        <nav className="flex mb-2 space-x-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span>Engagement</span>
          <span>/</span>
          <span className="text-primary">Campaigns</span>
        </nav>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
          SMS &amp; Email Campaigns
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          One-off broadcasts to segmented patients — promos, seasonal offers, announcements.
        </p>
      </div>

      <CampaignWizard campaigns={campaigns} />
    </div>
  );
}
