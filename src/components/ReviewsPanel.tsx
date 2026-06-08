'use client';

import { useState, useTransition } from 'react';
import {
  importReview,
  generateReviewReplyDraft,
  updateReviewReplyDraft,
  markReviewReplyPosted,
} from '@/app/actions/reviews';

export type ReviewRow = {
  id: string;
  author: string;
  rating: number;
  content: string | null;
  replyDraft: string | null;
  replyPostedAt: Date | null;
  createdAt: Date;
};

type Props = {
  reviews: ReviewRow[];
  stats: { total: number; avgRating: number; pendingReplies: number };
};

export default function ReviewsPanel({ reviews, stats }: Props) {
  const [rows, setRows] = useState(reviews);
  const [isPending, startTransition] = useTransition();
  const [importForm, setImportForm] = useState({ author: '', rating: 5, content: '' });

  function handleImport(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await importReview({
        author: importForm.author,
        rating: importForm.rating,
        content: importForm.content || undefined,
      });
      if (res.success) {
        setImportForm({ author: '', rating: 5, content: '' });
        window.location.reload();
      }
    });
  }

  function handleGenerateDraft(id: string) {
    startTransition(async () => {
      const res = await generateReviewReplyDraft(id);
      if (res.success && res.draft) {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, replyDraft: res.draft! } : r)),
        );
      }
    });
  }

  function handleSaveDraft(id: string, draft: string) {
    startTransition(async () => {
      await updateReviewReplyDraft(id, draft);
    });
  }

  function handleMarkPosted(id: string) {
    startTransition(async () => {
      await markReviewReplyPosted(id);
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, replyPostedAt: new Date() } : r)),
      );
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total reviews</p>
          <p className="text-2xl font-headline font-extrabold text-on-surface mt-1">{stats.total}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Average rating</p>
          <p className="text-2xl font-headline font-extrabold text-on-surface mt-1">{stats.avgRating} / 5</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Draft replies</p>
          <p className="text-2xl font-headline font-extrabold text-on-surface mt-1">{stats.pendingReplies}</p>
        </div>
      </div>

      <form onSubmit={handleImport} className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-headline font-bold text-lg">Import Google review</h2>
        <p className="text-[11px] text-on-surface-variant">
          Paste reviews manually until Google Business Profile API sync is connected.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            required
            placeholder="Reviewer name"
            value={importForm.author}
            onChange={(e) => setImportForm((f) => ({ ...f, author: e.target.value }))}
            className="rounded-lg border border-surface-container-high px-3 py-2 text-sm"
          />
          <select
            value={importForm.rating}
            onChange={(e) => setImportForm((f) => ({ ...f, rating: Number(e.target.value) }))}
            className="rounded-lg border border-surface-container-high px-3 py-2 text-sm"
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n} stars</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Import
          </button>
        </div>
        <textarea
          placeholder="Review text (optional)"
          value={importForm.content}
          onChange={(e) => setImportForm((f) => ({ ...f, content: e.target.value }))}
          rows={2}
          className="w-full rounded-lg border border-surface-container-high px-3 py-2 text-sm"
        />
      </form>

      <div className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No reviews yet. Review requests are sent after first completed visits.</p>
        ) : (
          rows.map((review) => (
            <div key={review.id} className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-on-surface">{review.author}</p>
                  <p className="text-amber-500 text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
                  {review.content && <p className="text-sm text-on-surface-variant mt-2">{review.content}</p>}
                </div>
                <span className="text-[10px] text-on-surface-variant">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerateDraft(review.id)}
                    disabled={isPending}
                    className="text-xs font-semibold text-primary hover:underline disabled:opacity-60"
                  >
                    Generate AI reply
                  </button>
                  {review.replyDraft && !review.replyPostedAt && (
                    <button
                      type="button"
                      onClick={() => handleMarkPosted(review.id)}
                      disabled={isPending}
                      className="text-xs font-semibold text-green-400 hover:underline disabled:opacity-60"
                    >
                      Mark as posted on Google
                    </button>
                  )}
                </div>
                {review.replyDraft && (
                  <textarea
                    defaultValue={review.replyDraft}
                    rows={3}
                    className="w-full rounded-lg border border-surface-container-high px-3 py-2 text-sm"
                    onBlur={(e) => {
                      if (e.target.value !== review.replyDraft) {
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === review.id ? { ...r, replyDraft: e.target.value } : r,
                          ),
                        );
                        handleSaveDraft(review.id, e.target.value);
                      }
                    }}
                  />
                )}
                {review.replyPostedAt && (
                  <p className="text-xs text-green-400">Reply posted</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
