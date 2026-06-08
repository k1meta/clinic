import { db } from '@/db';
import { messages, reviews } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export async function getEngagementMetrics(clinicId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [msgStats] = await db
    .select({
      sent: sql<number>`cast(count(*) filter (where ${messages.status} in ('sent','delivered','read')) as int)`,
      failed: sql<number>`cast(count(*) filter (where ${messages.status} = 'failed') as int)`,
      reviewRequests: sql<number>`cast(count(*) filter (where ${messages.type} = 'review_request') as int)`,
      reEngagement: sql<number>`cast(count(*) filter (where ${messages.type} = 're_engagement') as int)`,
      campaigns: sql<number>`cast(count(*) filter (where ${messages.type} = 'campaign') as int)`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.clinicId, clinicId),
        eq(messages.direction, 'outbound'),
        gte(messages.createdAt, thirtyDaysAgo),
      ),
    );

  const [reviewStats] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      avgRating: sql<number>`coalesce(avg(${reviews.rating}), 0)`,
    })
    .from(reviews)
    .where(eq(reviews.clinicId, clinicId));

  return {
    messagesSent30d: msgStats?.sent ?? 0,
    messagesFailed30d: msgStats?.failed ?? 0,
    reviewRequests30d: msgStats?.reviewRequests ?? 0,
    reEngagement30d: msgStats?.reEngagement ?? 0,
    campaignMessages30d: msgStats?.campaigns ?? 0,
    totalReviews: reviewStats?.total ?? 0,
    avgReviewRating: Math.round((reviewStats?.avgRating ?? 0) * 10) / 10,
  };
}
