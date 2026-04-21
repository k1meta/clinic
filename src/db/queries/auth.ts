import { createClient } from "@/lib/supabase-server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Hardcoded demo clinic ID — matches seed data.
// Used as fallback when Supabase Auth user has no mapped clinic.
export const DEMO_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

export async function getClinicId(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Look up the user's clinic_id from our users table
      const [dbUser] = await db
        .select({ clinicId: users.clinicId })
        .from(users)
        .where(eq(users.email, user.email!))
        .limit(1);

      if (dbUser?.clinicId) {
        return dbUser.clinicId;
      }
    }
  } catch {
    // Fall through to demo ID
  }

  return DEMO_CLINIC_ID;
}