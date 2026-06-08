'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signInAndVerify } from '@/app/actions/auth';
import ThemeToggle from '@/components/ThemeToggle';

const LAST_LOGIN_EMAIL_KEY = 'lastLoginEmail';

type LoginProfile = {
  email: string;
  fullName: string;
  role: 'admin' | 'staff';
};

function roleRank(role: string) {
  return role === 'admin' ? 1 : 2;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState('');
  const [profiles, setProfiles] = useState<LoginProfile[]>([]);

  useEffect(() => {
    const savedEmail = localStorage.getItem(LAST_LOGIN_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
    }

    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/auth/login-profiles');
        if (response.status === 404) {
          return;
        }
        if (!response.ok) {
          throw new Error('Failed to load profiles');
        }
        const data = await response.json();
        if (!active) return;
        const sorted = (data.profiles || []).sort(
          (a: LoginProfile, b: LoginProfile) => {
            const rankDiff = roleRank(a.role) - roleRank(b.role);
            if (rankDiff !== 0) return rankDiff;
            return String(a.fullName || '').localeCompare(String(b.fullName || ''));
          }
        );
        setProfiles(sorted);
      } catch {
        if (!active) return;
        setProfilesError('Could not load demo profiles.');
      } finally {
        if (active) setProfilesLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signInAndVerify({ email, password });

      if (result?.error) {
        setError(result.error);
        return;
      }

      localStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim());
    } finally {
      setLoading(false);
    }
  }

  function fillCredentials(profile: LoginProfile) {
    setEmail(profile.email);
    setPassword('');
  }

  const showProfilesPanel = profilesLoading || profiles.length > 0 || profilesError;

  return (
    <div className="flex min-h-screen bg-surface relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className={`flex flex-1 ${showProfilesPanel ? 'flex-col lg:flex-row' : 'items-center justify-center'}`}>
        {/* Left: Login Form */}
        <main className={`flex flex-col justify-center p-8 sm:p-12 ${showProfilesPanel ? 'flex-1 lg:max-w-xl' : 'w-full max-w-[440px] mx-auto'}`}>
          <div className="max-w-md w-full mx-auto flex flex-col gap-8">
            <div className="flex flex-col items-center gap-2 text-center lg:items-start lg:text-left">
              <div className="h-12 w-12 rounded-lg bg-surface-container-low flex items-center justify-center mb-2">
                <span
                  className="material-symbols-outlined text-primary text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  medical_services
                </span>
              </div>
              <h1 className="font-headline text-3xl font-black text-primary tracking-tighter">ClinicOS</h1>
              <p className="font-body text-sm text-on-surface-variant">Intelligent Practice Management</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {error && (
                <div className="p-3 bg-error/10 text-error text-sm rounded-lg font-medium">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="font-label text-sm font-semibold text-on-surface" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-[20px]">mail</span>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full bg-surface-container-high border-0 rounded-lg pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all outline-none disabled:opacity-50"
                    placeholder="provider@clinicos.app"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label text-sm font-semibold text-on-surface" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-[20px]">lock</span>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full bg-surface-container-high border-0 rounded-lg pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all outline-none disabled:opacity-50"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-semibold text-sm py-3.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Access Portal'}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </form>

            <div className="pt-2 text-center lg:text-left">
              <p className="text-xs text-on-surface-variant">
                Clinic owner?{' '}
                <Link href="/sign-up" className="text-primary font-semibold hover:underline">
                  Create admin account
                </Link>
              </p>
            </div>

            <div className="pt-4 border-t border-outline-variant/15 flex flex-col items-center lg:items-start gap-1.5">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-tertiary">verified_user</span>
                <span className="font-label text-xs font-medium">Secure Clinical Access</span>
              </div>
            </div>
          </div>
        </main>

        {/* Right: Login Profiles (demo mode) */}
        {showProfilesPanel && (
          <aside className="flex-1 bg-surface-container-low border-t lg:border-t-0 lg:border-l border-outline-variant/15 p-8 sm:p-12 flex flex-col justify-center">
            <div className="max-w-md w-full mx-auto">
              <h2 className="font-headline text-lg font-bold text-on-surface mb-1">Team Profiles</h2>
              <p className="text-sm text-on-surface-variant mb-6">Click to autofill email</p>

              {profilesError ? (
                <p className="text-sm text-on-surface-variant">{profilesError}</p>
              ) : null}

              <div className="space-y-2">
                {profilesLoading ? (
                  <p className="text-sm text-on-surface-variant">Loading profiles...</p>
                ) : (
                  profiles.map((profile) => (
                    <button
                      key={profile.email}
                      type="button"
                      onClick={() => fillCredentials(profile)}
                      disabled={loading}
                      className="w-full text-left p-4 bg-surface-container-lowest border border-outline-variant/20 hover:border-primary hover:bg-surface-container-highest transition-colors group rounded-lg disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-label text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                          {profile.fullName}
                        </p>
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {profile.role}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1">{profile.email}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
