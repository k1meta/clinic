import { db } from '@/db';
import { reviews } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

export async function getReviewsByClinic(clinicId: string) {
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.clinicId, clinicId))
    .orderBy(desc(reviews.createdAt));
}

export async function getReviewStats(clinicId: string) {
  const [row] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      avgRating: sql<number>`coalesce(avg(${reviews.rating}), 0)`,
      pendingReplies: sql<number>`cast(count(*) filter (where ${reviews.replyDraft} is not null and ${reviews.replyPostedAt} is null) as int)`,
    })
    .from(reviews)
    .where(eq(reviews.clinicId, clinicId));

  return {
    total: row?.total ?? 0,
    avgRating: Math.round((row?.avgRating ?? 0) * 10) / 10,
    pendingReplies: row?.pendingReplies ?? 0,
  };
}

export async function getReviewById(clinicId: string, reviewId: string) {
  const [row] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.clinicId, clinicId)))
    .limit(1);
  return row ?? null;
}
