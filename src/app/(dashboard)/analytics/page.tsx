export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/db/queries/auth';
import {
  getTodayAppointmentCount,
  getNoShowRate,
  getWeeklyOccupancy,
  getMonthlyRevenue,
} from '@/db/queries/appointments';
import { getEngagementMetrics } from '@/db/queries/engagement-analytics';
import { getRoiMetrics } from '@/db/queries/roi-analytics';
import MetricCard from '@/components/MetricCard';
import { redirect } from 'next/navigation';

export default async function AnalyticsPage() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    redirect('/');
  }

  const clinicId = admin.clinicId;

  const [todayCount, noShowRate, weeklyOccupancy, monthlyRevenue, engagement, roi] = await Promise.all([
    getTodayAppointmentCount(clinicId),
    getNoShowRate(clinicId),
    getWeeklyOccupancy(clinicId),
    getMonthlyRevenue(clinicId),
    getEngagementMetrics(clinicId),
    getRoiMetrics(clinicId),
  ]);

  const bam = (minor: number) => `${Math.round(minor / 100)} BAM`;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-3xl font-headline font-extrabold tracking-tight text-on-surface">
          Analytics
        </h1>
        <p className="text-on-surface-variant mt-1 text-sm">
          Revenue, performance, and clinic occupancy insights.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface-variant">
            Revenue Engine (ROI) &middot; This Month
          </h2>
          <span className="text-[10px] text-on-surface-variant">Estimates from attributable activity</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            icon="smart_toy"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="AI / online bookings"
            value={bam(roi.aiBookedRevenue)}
            sub={`${roi.aiBookedCount} booked by automation`}
            subColor="text-on-surface-variant"
            subIcon="event_available"
          />
          <MetricCard
            icon="autorenew"
            iconBg="bg-green-500/15"
            iconColor="text-green-400"
            label="Re-engagement revenue"
            value={bam(roi.reEngagementRevenue)}
            sub={`${roi.reEngagementCount} win-back visits`}
            subColor="text-on-surface-variant"
            subIcon="redo"
          />
          <MetricCard
            icon="savings"
            iconBg="bg-amber-500/10"
            iconColor="text-amber-600"
            label="No-show cost avoided (est.)"
            value={bam(roi.noShowAvoidedEstimate)}
            sub={`${roi.noShowRateCurrent}% now vs ${roi.noShowBaseline}% baseline`}
            subColor={roi.noShowRateCurrent <= roi.noShowBaseline ? 'text-green-400' : 'text-tertiary'}
            subIcon="trending_down"
          />
          <MetricCard
            icon="call"
            iconBg="bg-tertiary/10"
            iconColor="text-tertiary"
            label="After-hours calls handled"
            value={String(roi.afterHoursCalls)}
            sub={`Avg ticket ${bam(roi.avgTicket)}`}
            subColor="text-on-surface-variant"
            subIcon="nightlight"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface-variant">
          Revenue
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MetricCard
            icon="payments"
            iconBg="bg-green-500/15"
            iconColor="text-green-400"
            label="Revenue This Month"
            value={`${(monthlyRevenue.paid / 100).toFixed(0)} BAM`}
            sub={
              monthlyRevenue.pending > 0
                ? `${(monthlyRevenue.pending / 100).toFixed(0)} BAM pending`
                : 'All collected'
            }
            subColor={monthlyRevenue.pending > 0 ? 'text-amber-400' : 'text-green-400'}
            subIcon={monthlyRevenue.pending > 0 ? 'schedule' : 'check_circle'}
          />
          <MetricCard
            icon="account_balance_wallet"
            iconBg="bg-amber-500/10"
            iconColor="text-amber-600"
            label="Pending Collection"
            value={`${(monthlyRevenue.pending / 100).toFixed(0)} BAM`}
            sub={monthlyRevenue.pending > 0 ? 'Outstanding this month' : 'Nothing outstanding'}
            subColor={monthlyRevenue.pending > 0 ? 'text-amber-400' : 'text-green-400'}
            subIcon={monthlyRevenue.pending > 0 ? 'warning' : 'check_circle'}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface-variant">
          Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MetricCard
            icon="person_cancel"
            iconBg="bg-tertiary/10"
            iconColor="text-tertiary"
            label="No-Show Rate (30d)"
            value={`${noShowRate}%`}
            sub={noShowRate < 5 ? 'On target' : 'Needs attention'}
            subColor={noShowRate < 5 ? 'text-green-400' : 'text-tertiary'}
            subIcon={noShowRate < 5 ? 'trending_down' : 'trending_up'}
          />
          <MetricCard
            icon="event_available"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="Today's Appointments"
            value={String(todayCount)}
            sub="Scheduled for today"
            subColor="text-on-surface-variant"
            subIcon="today"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface-variant">
          Engagement (30d)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MetricCard
            icon="send"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="Messages sent"
            value={String(engagement.messagesSent30d)}
            sub={`${engagement.messagesFailed30d} failed`}
            subColor={engagement.messagesFailed30d > 0 ? 'text-amber-400' : 'text-green-400'}
            subIcon="mark_email_read"
          />
          <MetricCard
            icon="rate_review"
            iconBg="bg-amber-500/10"
            iconColor="text-amber-600"
            label="Review requests"
            value={String(engagement.reviewRequests30d)}
            sub={`${engagement.totalReviews} total reviews · ${engagement.avgReviewRating} avg`}
            subColor="text-on-surface-variant"
            subIcon="star"
          />
          <MetricCard
            icon="campaign"
            iconBg="bg-green-500/15"
            iconColor="text-green-400"
            label="Campaign messages"
            value={String(engagement.campaignMessages30d)}
            sub={`${engagement.reEngagement30d} re-engagement sends`}
            subColor="text-on-surface-variant"
            subIcon="autorenew"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface-variant">
          Occupancy
        </h2>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-headline font-extrabold text-base text-on-surface">Weekly Occupancy</h3>
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary" /> Scheduled
              </div>
            </div>
          </div>
          <div className="flex items-end justify-between h-36 gap-2">
            {weeklyOccupancy.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full bg-surface-container-low rounded-t-md relative h-full flex flex-col justify-end">
                  {d.pct > 0 ? (
                    <div
                      className="w-full bg-primary/20 rounded-t-md group-hover:bg-primary transition-colors relative"
                      style={{ height: `${Math.max(d.pct, 4)}%` }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-primary/60 group-hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                        {d.count}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-[2px] bg-surface-container-high rounded-t-md" />
                  )}
                </div>
                <span className="text-[9px] font-bold text-on-surface-variant">{d.day.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
