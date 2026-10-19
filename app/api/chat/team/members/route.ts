import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { admin } from '@/lib/crm';

export const dynamic = 'force-dynamic';

/**
 * The people you can address by username. Deliberately narrower than
 * /api/users (which is super-user only and exposes sign-in history): this
 * returns only what a room needs to render a name and open a thread.
 */
export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await admin().auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const me = String(user.email).toLowerCase();
  const members = (data?.users || [])
    .filter((u) => u.email)
    .map((u) => {
      const explicit = typeof u.user_metadata?.username === 'string' ? u.user_metadata.username.trim() : '';
      return {
        email: u.email as string,
        username: explicit || (u.email as string).split('@')[0],
        role: (u.app_metadata?.role as string) || 'employee',
        is_me: String(u.email).toLowerCase() === me,
      };
    })
    .sort((a, b) => a.username.localeCompare(b.username));

  return NextResponse.json({ members });
}
