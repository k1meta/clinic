import { createClient } from '@/lib/supabase-server';
import { db } from '@/db';
import { users, clinics } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const DEMO_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

export type UserRole = 'admin' | 'staff';

export type DbUser = {
  id: string;
  clinicId: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
};

export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getDbUser(): Promise<DbUser | null> {
  const user = await getSession();
  if (!user?.email) return null;

  const [dbUser] = await db
    .select({
      id: users.id,
      clinicId: users.clinicId,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);

  if (!dbUser || !dbUser.isActive) return null;
  return dbUser as DbUser;
}

export async function requireAuth(): Promise<DbUser> {
  const dbUser = await getDbUser();
  if (!dbUser) {
    throw new Error('Unauthorized');
  }
  return dbUser;
}

export async function requireAdmin(): Promise<DbUser> {
  const dbUser = await requireAuth();
  if (dbUser.role !== 'admin') {
    throw new Error('Forbidden');
  }
  return dbUser;
}

export async function getClinicId(): Promise<string> {
  const dbUser = await requireAuth();
  return dbUser.clinicId;
}

export async function getClinicContext(): Promise<{ clinicId: string; clinicName: string; user: DbUser }> {
  const dbUser = await requireAuth();
  const [clinic] = await db
    .select({ name: clinics.name })
    .from(clinics)
    .where(eq(clinics.id, dbUser.clinicId))
    .limit(1);

  return {
    clinicId: dbUser.clinicId,
    clinicName: clinic?.name ?? 'Clinic',
    user: dbUser,
  };
}
