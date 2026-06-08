'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import Link from 'next/link';
import { bootstrapAdmin } from '@/app/actions/auth';

export default function SignUpPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role: 'admin' } },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        const bootstrap = await bootstrapAdmin({ email, fullName });
        if (bootstrap.error) {
          setError(bootstrap.error);
          return;
        }
        await supabase.auth.updateUser({
          data: { full_name: fullName, role: 'admin' },
        });
        window.location.assign('/');
        return;
      }

      setConfirmationSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span
                className="material-symbols-outlined text-primary text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                medical_services
              </span>
              <span className="text-2xl font-headline font-bold text-primary tracking-tighter">
                ClinicOS
              </span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-surface-container-high/50 text-center space-y-4">
            <span className="material-symbols-outlined text-green-500 text-5xl">mark_email_read</span>
            <h2 className="text-lg font-headline font-bold">Check your email</h2>
            <p className="text-sm text-on-surface-variant">
              We sent a confirmation link to <strong className="text-on-surface">{email}</strong>.
              After confirming, sign in to your account. Your admin profile will be created on first sign-in.
            </p>
            <Link
              href="/sign-in"
              className="inline-block mt-4 text-sm text-primary font-bold hover:underline"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span
              className="material-symbols-outlined text-primary text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              medical_services
            </span>
            <span className="text-2xl font-headline font-bold text-primary tracking-tighter">
              ClinicOS
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">Create clinic admin account</p>
          <p className="text-xs text-on-surface-variant mt-1">Staff accounts are created by your admin via invite.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-surface-container-high/50 space-y-5">
          {error && (
            <div className="p-3 bg-error/10 text-error text-sm rounded-lg font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/20 border-none font-body"
              placeholder="Dr. Jane Smith"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/20 border-none font-body"
              placeholder="owner@clinic.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-low rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-primary/20 border-none font-body"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 clinical-gradient text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Admin Account'}
          </button>

          <p className="text-center text-xs text-on-surface-variant pt-2">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-primary font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
