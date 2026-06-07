import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  if (process.env.ENABLE_LOGIN_PROFILES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const rows = await db
      .select({
        email: users.email,
        fullName: users.fullName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.isActive, true));

    const profiles = rows.sort((a, b) => {
      const rankA = a.role === 'admin' ? 1 : 2;
      const rankB = b.role === 'admin' ? 1 : 2;
      if (rankA !== rankB) return rankA - rankB;
      return String(a.fullName || '').localeCompare(String(b.fullName || ''));
    });

    return NextResponse.json({ profiles });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
