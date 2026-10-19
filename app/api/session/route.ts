import { NextResponse } from 'next/server';
import { verifySession, effectivePermissions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Who is signed in, from the CRM's POV — including what they're allowed to
 * do. The static HTML app calls this to paint identities, show or hide rail
 * items and degrade pages gracefully; middleware already refused anonymous
 * requests, and every API route re-checks server-side.
 */
export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  const permissions = await effectivePermissions(user);
  return NextResponse.json({
    user: { email: user.email, role: user.role, username: user.username, permissions },
  });
}
