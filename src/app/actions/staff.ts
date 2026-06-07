'use server';

import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and, ne, asc } from 'drizzle-orm';
import { requireAdmin } from '@/db/queries/auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

const createStaffSchema = z.object({
  email: z.string().email('Invalid email'),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateCredentialsSchema = z
  .object({
    userId: z.string().uuid('Invalid user'),
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email'),
    password: z.string().optional(),
  })
  .refine((data) => !data.password || data.password.length >= 6, {
    message: 'Password must be at least 6 characters',
    path: ['password'],
  });

async function findAuthUserByEmail(email: string) {
  const supabaseAdmin = createAdminClient();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }

    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

export async function getStaffMembers() {
  const admin = await requireAdmin();

  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.clinicId, admin.clinicId))
    .orderBy(asc(users.createdAt));
}

export async function createStaffMember(input: { email: string; fullName: string; password: string }) {
  const admin = await requireAdmin();
  const parsed = createStaffSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(', ') };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { fullName, password } = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { error: 'A user with this email already exists.' };
  }

  try {
    await db.insert(users).values({
      clinicId: admin.clinicId,
      email,
      fullName,
      role: 'staff',
      isActive: true,
    });
  } catch {
    return { error: 'Failed to create staff record.' };
  }

  try {
    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'staff',
        clinic_id: admin.clinicId,
      },
    });

    if (error) {
      await db.delete(users).where(eq(users.email, email));
      return { error: error.message };
    }
  } catch (e) {
    await db.delete(users).where(eq(users.email, email));
    const message = e instanceof Error ? e.message : 'Failed to create login account.';
    return { error: message };
  }

  revalidatePath('/settings');
  return { success: true };
}

export async function deactivateStaffMember(userId: string) {
  const admin = await requireAdmin();

  if (userId === admin.id) {
    return { error: 'You cannot deactivate your own account.' };
  }

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.clinicId, admin.clinicId)))
    .limit(1);

  if (!target) {
    return { error: 'Staff member not found.' };
  }

  if (target.role === 'admin') {
    return { error: 'Cannot deactivate an admin account.' };
  }

  await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, userId));

  revalidatePath('/settings');
  return { success: true };
}

export async function reactivateStaffMember(userId: string) {
  const admin = await requireAdmin();

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.clinicId, admin.clinicId), ne(users.role, 'admin')))
    .limit(1);

  if (!target) {
    return { error: 'Staff member not found.' };
  }

  await db
    .update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, userId));

  revalidatePath('/settings');
  return { success: true };
}

export async function deleteStaffMember(userId: string) {
  const admin = await requireAdmin();

  if (userId === admin.id) {
    return { error: 'You cannot remove your own account.' };
  }

  const [target] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.clinicId, admin.clinicId)))
    .limit(1);

  if (!target) {
    return { error: 'Staff member not found.' };
  }

  if (target.role === 'admin') {
    return { error: 'Cannot remove an admin account.' };
  }

  try {
    const authUser = await findAuthUserByEmail(target.email);
    if (authUser) {
      const supabaseAdmin = createAdminClient();
      const { error } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      if (error) {
        return { error: error.message };
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to remove login account.';
    return { error: message };
  }

  await db.delete(users).where(eq(users.id, userId));

  revalidatePath('/settings');
  return { success: true };
}

export async function updateStaffCredentials(input: {
  userId: string;
  fullName: string;
  email: string;
  password?: string;
}) {
  const admin = await requireAdmin();
  const parsed = updateCredentialsSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(', ') };
  }

  const { userId, fullName, password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  if (userId === admin.id) {
    return { error: 'Use Account Security to change your own credentials.' };
  }

  const [target] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.clinicId, admin.clinicId)))
    .limit(1);

  if (!target) {
    return { error: 'Staff member not found.' };
  }

  if (target.role === 'admin') {
    return { error: 'Cannot edit credentials for an admin account.' };
  }

  if (email !== target.email.toLowerCase()) {
    const [emailTaken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (emailTaken) {
      return { error: 'A user with this email already exists.' };
    }
  }

  try {
    const authUser = await findAuthUserByEmail(target.email);
    if (!authUser) {
      return { error: 'No login account found for this staff member.' };
    }

    const supabaseAdmin = createAdminClient();
    const authUpdate: {
      email?: string;
      password?: string;
      user_metadata: { full_name: string; role: string };
    } = {
      user_metadata: { full_name: fullName, role: 'staff' },
    };

    if (email !== target.email.toLowerCase()) {
      authUpdate.email = email;
    }

    if (password) {
      authUpdate.password = password;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, authUpdate);

    if (error) {
      return { error: error.message };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update login account.';
    return { error: message };
  }

  await db
    .update(users)
    .set({ fullName, email, updatedAt: new Date() })
    .where(eq(users.id, userId));

  revalidatePath('/settings');
  return { success: true };
}
