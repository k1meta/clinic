'use client';

import { useState, useTransition } from 'react';
import { updateGoogleReviewUrl } from '@/app/actions/clinic-settings';

interface Props {
  currentUrl: string;
}

export default function GoogleReviewUrlForm({ currentUrl }: Props) {
  const [url, setUrl] = useState(currentUrl);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleSave() {
    setStatus(null);
    startTransition(async () => {
      const result = await updateGoogleReviewUrl({ url: url.trim() });
      if ('error' in result && result.error) {
        setStatus({ type: 'error', text: result.error });
      } else {
        setStatus({ type: 'success', text: 'Review link saved' });
        setTimeout(() => setStatus(null), 3000);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs font-semibold text-on-surface mb-1 block">
            Google review link
          </label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://g.page/r/.../review"
            className="w-full px-3 py-2 rounded-lg border border-surface-container-high bg-surface-container-lowest text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <p className="text-[10px] text-on-surface-variant mt-1">
            HTTPS link from Google Business Profile (Share review form). Used once per patient after their first completed visit.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 h-[38px] shrink-0"
        >
          {isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
      {status && (
        <p className={'text-xs font-medium ' + (status.type === 'error' ? 'text-red-400' : 'text-green-400')}>
          {status.text}
        </p>
      )}
    </div>
  );
}
