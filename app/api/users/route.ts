import { NextRequest, NextResponse } from 'next/server';
import { requirePerm, roleExists } from '@/lib/auth';
import { admin } from '@/lib/crm';

/**
 * Supabase's listUsers is a network round-trip (~430ms) and this list barely
 * changes. Cache it in-process and invalidate on every mutation below, so a
 * super user always sees their own change immediately but repeat loads are
 * instant.
 */
let _usersCache: { at: number; rows: any[] } | null = null;
const USERS_TTL_MS = 60_000;

/** The handle chat displays: a username from user_metadata, else the email local part. */
const handle = (u: { email?: string | null; user_metadata?: any }) =>
  (typeof u.user_metadata?.username === 'string' ? u.user_metadata.username.trim() : '') ||
  (u.email || '').split('@')[0] ||
  'member';

export async function GET() {
  if (!(await requirePerm('people.manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (_usersCache && Date.now() - _usersCache.at < USERS_TTL_MS) return NextResponse.json(_usersCache.rows);

  const { data, error } = await admin().auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const users = (data?.users || []).map((u) => ({
    id: u.id,
    email: u.email,
    username: handle(u),
    role: (u.app_metadata?.role as string) || (u.user_metadata?.role as string) || 'employee',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  }));
  _usersCache = { at: Date.now(), rows: users };
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  if (!(await requirePerm('people.manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  if (!body.email || !body.password) return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  const role = body.role || 'employee';
  if (!(await roleExists(role))) return NextResponse.json({ error: `Unknown role "${role}".` }, { status: 400 });
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const { data, error } = await admin().auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { role, ...(username ? { username } : {}) },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  _usersCache = null;
  return NextResponse.json({ id: data.user?.id, email: data.user?.email });
}

export async function PUT(req: NextRequest) {
  const me = await requirePerm('people.manage');
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  if (body.role && !(await roleExists(String(body.role)))) {
    return NextResponse.json({ error: `Unknown role "${body.role}".` }, { status: 400 });
  }
  // Changing your own role while it is your only way to manage people is how
  // teams get locked out. Refuse it; a second manager can do it instead.
  if (body.id === me.id && body.role && body.role !== me.role) {
    return NextResponse.json({ error: "You can't change your own role. Ask another manager to do it." }, { status: 400 });
  }
  const updates: Record<string, any> = {};
  if (body.email) updates.email = body.email;
  if (body.password) updates.password = body.password;
  if (body.role) updates.app_metadata = { role: body.role };
  if (body.role || typeof body.username === 'string') {
    // Merge rather than replace: setting a role must never drop the username.
    const { data: existing } = await admin().auth.admin.getUserById(body.id);
    const meta: Record<string, any> = { ...((existing?.user?.user_metadata as any) || {}) };
    if (body.role) meta.role = body.role;
    if (typeof body.username === 'string') {
      const username = body.username.trim();
      if (username) meta.username = username;
      else delete meta.username;
    }
    updates.user_metadata = meta;
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const { error } = await admin().auth.admin.updateUserById(body.id, updates);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  _usersCache = null;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const me = await requirePerm('people.manage');
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (id === me.id) return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  const { error } = await admin().auth.admin.deleteUser(id!);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  _usersCache = null;
  return NextResponse.json({ ok: true });
}
