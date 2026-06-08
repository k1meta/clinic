'use server';

import { z } from 'zod';
import { db } from '@/db';
import { reviews } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '@/db/queries/auth';
import { getReviewById } from '@/db/queries/reviews';
import { generateResponse } from '@/lib/ai/llm';
import { revalidatePath } from 'next/cache';

const importSchema = z.object({
  author: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  content: z.string().max(5000).optional(),
  externalReviewId: z.string().max(200).optional(),
});

export async function importReview(input: z.infer<typeof importSchema>) {
  const { clinicId } = await requireAdmin();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const [row] = await db
    .insert(reviews)
    .values({
      clinicId,
      author: parsed.data.author,
      rating: parsed.data.rating,
      content: parsed.data.content ?? null,
      externalReviewId: parsed.data.externalReviewId ?? null,
      source: 'google',
    })
    .returning({ id: reviews.id });

  revalidatePath('/reviews');
  revalidatePath('/analytics');
  return { success: true, id: row.id };
}

export async function generateReviewReplyDraft(reviewId: string) {
  const { clinicId } = await requireAdmin();
  const review = await getReviewById(clinicId, reviewId);
  if (!review) return { error: 'Review not found' };

  const systemPrompt =
    'You write short, warm, professional replies to Google reviews for a local service business. ' +
    'Keep replies under 80 words. Thank the reviewer. Do not invent facts. Respond in the same language as the review.';

  const userMessage = `Rating: ${review.rating}/5\nAuthor: ${review.author}\nReview: ${review.content ?? '(no text)'}\n\nWrite a reply draft.`;

  const draft = await generateResponse(systemPrompt, userMessage, 200);

  await db
    .update(reviews)
    .set({ replyDraft: draft.trim(), updatedAt: new Date() })
    .where(and(eq(reviews.id, reviewId), eq(reviews.clinicId, clinicId)));

  revalidatePath('/reviews');
  return { success: true, draft: draft.trim() };
}

export async function updateReviewReplyDraft(reviewId: string, replyDraft: string) {
  const { clinicId } = await requireAdmin();

  await db
    .update(reviews)
    .set({ replyDraft: replyDraft.trim(), updatedAt: new Date() })
    .where(and(eq(reviews.id, reviewId), eq(reviews.clinicId, clinicId)));

  revalidatePath('/reviews');
  return { success: true };
}

export async function markReviewReplyPosted(reviewId: string) {
  const { clinicId } = await requireAdmin();

  await db
    .update(reviews)
    .set({ replyPostedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(reviews.id, reviewId), eq(reviews.clinicId, clinicId)));

  revalidatePath('/reviews');
  return { success: true };
}
