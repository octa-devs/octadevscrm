import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Who is signed in, from the CRM's POV. The static HTML app calls this to
 * paint identities and role gates; middleware already refused anonymous
 * requests to the pages, so a null user here means the session cookie died
 * mid-navigation.
 */
export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({
    user: { email: user.email, role: user.role, username: user.username },
  });
}
