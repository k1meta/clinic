import { createClient } from '@supabase/supabase-js';

function assertValidServiceRoleKey(key: string) {
  const looksPlaceholder =
    key.toLowerCase().includes('your_') || !key.startsWith('eyJ') || key.length < 100;

  if (looksPlaceholder) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. In Supabase Dashboard go to Project Settings → API, copy the service_role key into .env.local, then restart the dev server.'
    );
  }

  if (key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY must be the service_role key, not the anon key. Update .env.local and restart the dev server.'
    );
  }
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  assertValidServiceRoleKey(key);

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
