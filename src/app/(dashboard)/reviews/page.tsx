export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/db/queries/auth';
import { getReviewsByClinic, getReviewStats } from '@/db/queries/reviews';
import ReviewsPanel from '@/components/ReviewsPanel';

export default async function ReviewsPage() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    redirect('/');
  }

  const [reviews, stats] = await Promise.all([
    getReviewsByClinic(admin.clinicId),
    getReviewStats(admin.clinicId),
  ]);

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-4xl">
      <div className="mb-10">
        <nav className="flex mb-2 space-x-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span>Engagement</span>
          <span>/</span>
          <span className="text-primary">Reviews</span>
        </nav>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
          Review Manager
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Track Google reviews, draft replies with AI, and measure your review funnel.
        </p>
      </div>

      <ReviewsPanel reviews={reviews} stats={stats} />
    </div>
  );
}
