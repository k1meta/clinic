'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { clinics, users } from '@/db/schema';
import { createClient } from '@/lib/supabase-server';
import { DEMO_CLINIC_ID } from '@/db/queries/auth';
import { eq } from 'drizzle-orm';

const bootstrapSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
});

export async function bootstrapAdmin(input: { email: string; fullName: string }) {
  const parsed = bootstrapSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Invalid admin profile data.' };
  }

  const { email, fullName } = parsed.data;

  try {
    const [existingClinic] = await db
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.id, DEMO_CLINIC_ID))
      .limit(1);

    if (!existingClinic) {
      await db.insert(clinics).values({
        id: DEMO_CLINIC_ID,
        name: 'Primary Care Center',
        slug: 'primary-care',
        timezone: 'Europe/Sarajevo',
        phone: '+387 33 123 456',
        settings: {
          workHours: { start: 8, end: 17 },
          aiMessaging: true,
          aiCalls: false,
          testPhoneNumber: '',
          googleReviewUrl: '',
        },
      });
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      await db
        .update(users)
        .set({ role: 'admin', fullName, isActive: true, updatedAt: new Date() })
        .where(eq(users.email, email));
    } else {
      await db.insert(users).values({
        clinicId: DEMO_CLINIC_ID,
        email,
        fullName,
        role: 'admin',
        isActive: true,
      });
    }

    return { success: true as const };
  } catch {
    return { error: 'Failed to set up admin account. Please contact support.' };
  }
}

export async function verifyUserAfterLogin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: 'Not signed in.' };
  }

  const [dbUser] = await db
    .select({
      role: users.role,
      fullName: users.fullName,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);

  if (!dbUser) {
    const metadataRole = user.user_metadata?.role as string | undefined;
    const isAdminSignup = metadataRole === 'admin';

    if (isAdminSignup) {
      const fullName =
        (user.user_metadata?.full_name as string) ||
        user.email?.split('@')[0] ||
        'Clinic Admin';
      const bootstrap = await bootstrapAdmin({ email: user.email, fullName });
      if (bootstrap.error) {
        await supabase.auth.signOut();
        return { error: bootstrap.error };
      }
      const [created] = await db
        .select({ role: users.role, fullName: users.fullName, isActive: users.isActive })
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);
      if (!created?.isActive) {
        await supabase.auth.signOut();
        return { error: 'Your account is not active. Contact your clinic admin.' };
      }
      return { success: true as const, fullName: created.fullName, role: created.role };
    }

    await supabase.auth.signOut();
    return {
      error: 'Your account is not set up yet. Contact your clinic admin for an invite.',
    };
  }

  if (!dbUser.isActive) {
    await supabase.auth.signOut();
    return {
      error: 'Your account is not active. Contact your clinic admin.',
    };
  }

  return { success: true as const, fullName: dbUser.fullName, role: dbUser.role };
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signInAndVerify(input: { email: string; password: string }) {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Invalid email or password.' };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.trim(),
    password: parsed.data.password,
  });

  if (signInError) {
    return { error: signInError.message };
  }

  const verify = await verifyUserAfterLogin();

  if ('error' in verify && verify.error) {
    return { error: verify.error };
  }

  if ('success' in verify && verify.success) {
    await supabase.auth.updateUser({
      data: { full_name: verify.fullName, role: verify.role },
    });
    redirect('/');
  }

  return { error: 'Login failed. Please try again.' };
}
