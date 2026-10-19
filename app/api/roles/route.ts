import { NextRequest, NextResponse } from 'next/server';
import { verifySession, requirePerm, userHas, rolePermissionsMap, invalidatePermissionCache, PERMISSIONS, BUILTIN_FALLBACK, type SessionUser } from '@/lib/auth';
import { admin } from '@/lib/crm';

export const dynamic = 'force-dynamic';

const VALID_PERMS = new Set(PERMISSIONS.map((p) => p.key));
const slugify = (name: string) =>
  String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const cleanPerms = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.map(String).filter((p) => VALID_PERMS.has(p)))] : [];

/** Which keys already exist — table rows first, built-in floor underneath. */
async function existingKeys(): Promise<Set<string>> {
  const map = await rolePermissionsMap();
  return new Set(Object.keys(map));
}

/** How many accounts hold each role. Only counted for people who manage this area. */
async function countsByRole(caller: SessionUser): Promise<Record<string, number> | null> {
  if (!user_has_manage(caller)) return null;
  const { data, error } = await admin().auth.admin.listUsers({ perPage: 500 });
  if (error) return null;
  const counts: Record<string, number> = {};
  for (const u of data?.users ?? []) {
    const key = (u.app_metadata?.role as string) || 'employee';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function user_has_manage(user: SessionUser): Promise<boolean> {
  return (await userHas(user, 'roles.manage')) || (await userHas(user, 'people.manage'));
}

/** GET — the role list for the People dropdown and the Roles page. */
export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await admin()
    .from('roles')
    .select('key, name, description, permissions, is_builtin')
    .order('is_builtin', { ascending: false })
    .order('name');

  let roles;
  if (!error && Array.isArray(data) && data.length) {
    roles = data;
  } else {
    // Table not migrated yet (or empty): show the built-in floor so the
    // People page's dropdown keeps working.
    roles = [
      { key: 'super_admin', name: 'Super user', description: 'Full control.', permissions: [], is_builtin: true },
      ...Object.entries(BUILTIN_FALLBACK).map(([key, perms]) =>
        ({ key, name: key === 'admin' ? 'Admin' : 'Employee', description: '', permissions: perms, is_builtin: true })),
    ];
  }

  const counts = await countsByRole(user);
  return NextResponse.json({ roles, counts, permissions: PERMISSIONS });
}

/** POST — create a custom role. */
export async function POST(req: NextRequest) {
  if (!(await requirePerm('roles.manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Give the role a name.' }, { status: 400 });

  const key = slugify(body?.key || name);
  if (key.length < 2) return NextResponse.json({ error: 'The name turns into the role key. Try a longer name.' }, { status: 400 });
  if (await existingKeys().then((s) => s.has(key))) {
    return NextResponse.json({ error: `A role with key "${key}" already exists.` }, { status: 409 });
  }

  const { error } = await admin().from('roles').insert({
    key,
    name,
    description: String(body?.description ?? '').slice(0, 200),
    permissions: cleanPerms(body?.permissions),
    is_builtin: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidatePermissionCache();
  return NextResponse.json({ ok: true, key });
}

/** PUT — update a role's details and permissions. Built-ins are editable except super_admin. */
export async function PUT(req: NextRequest) {
  if (!(await requirePerm('roles.manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const key = String(body?.key ?? '');
  if (!key) return NextResponse.json({ error: 'Which role?' }, { status: 400 });
  if (key === 'super_admin') return NextResponse.json({ error: 'Super user is always full-control and cannot be edited.' }, { status: 400 });
  if (!(await existingKeys()).has(key)) return NextResponse.json({ error: 'Unknown role.' }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 40);
  if (typeof body.description === 'string') patch.description = body.description.slice(0, 200);
  if (body.permissions !== undefined) {
    const perms = cleanPerms(body.permissions);
    // A manager must never lock the whole team out: whoever can edit roles
    // necessarily holds roles.manage, so they keep a way back in.
    const caller = (await verifySession())!;
    if (caller.role === key && !(await userHas(caller, 'people.manage'))) perms.push('roles.manage');
    patch.permissions = [...new Set(perms)];
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const { error } = await admin().from('roles').update(patch).eq('key', key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidatePermissionCache();
  return NextResponse.json({ ok: true });
}

/** DELETE — remove a custom role. Built-ins stay. Users must be reassigned first. */
export async function DELETE(req: NextRequest) {
  const user = await requirePerm('roles.manage');
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const key = new URL(req.url).searchParams.get('id');
  if (!key || key === 'super_admin') return NextResponse.json({ error: 'Not deletable.' }, { status: 400 });

  const rows = await existingKeys();
  if (!rows.has(key)) return NextResponse.json({ error: 'Unknown role.' }, { status: 404 });

  const { data: tableRow } = await admin().from('roles').select('is_builtin').eq('key', key).maybeSingle();
  if (tableRow?.is_builtin) return NextResponse.json({ error: 'Built-in roles cannot be deleted. Edit their permissions instead.' }, { status: 400 });

  const { data: listing } = await admin().auth.admin.listUsers({ perPage: 500 });
  const holders = (listing?.users ?? []).filter((u) => ((u.app_metadata?.role as string) || 'employee') === key);
  if (holders.length) {
    return NextResponse.json({ error: `${holders.length} account${holders.length === 1 ? '' : 's'} still use this role. Reassign them in People first.` }, { status: 409 });
  }

  const { error } = await admin().from('roles').delete().eq('key', key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidatePermissionCache();
  return NextResponse.json({ ok: true });
}
