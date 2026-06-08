'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase-browser';

type ChangeOwnPasswordFormProps = {
  adminEmail: string;
};

export default function ChangeOwnPasswordForm({ adminEmail }: ChangeOwnPasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    startTransition(async () => {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: currentPassword,
      });

      if (verifyError) {
        setError('Current password is incorrect.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {error && (
        <p className="text-sm font-medium text-error">{error}</p>
      )}
      {success && (
        <p className="text-sm font-medium text-green-400">Password updated successfully.</p>
      )}

      <div>
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
          Current Password
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
          required
          autoComplete="current-password"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
          New Password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
          Confirm New Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm border-none focus:ring-2 focus:ring-primary/20 font-body"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md active:scale-95 transition-all disabled:opacity-50"
      >
        {isPending ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  );
}
