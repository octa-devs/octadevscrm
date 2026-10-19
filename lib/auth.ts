import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { admin } from './crm';

export type SessionUser = { id: string; email: string; role: string; username: string };

/** The handle rooms display. `user_metadata.username` wins, else the email local part. */
function usernameFor(email: string, meta: any): string {
  const explicit = typeof meta?.username === 'string' ? meta.username.trim() : '';
  if (explicit) return explicit;
  return email.split('@')[0] || 'member';
}

/**
 * Supabase Auth publishes its signing keys at JWKS_URL. jose caches them
 * in-process, so verification costs ~0ms after the very first request.
 * This replaces supabase.auth.getUser(), which is an HTTP round-trip to
 * Supabase and was costing ~1s on every request.
 *
 * Deliberately built lazily: `new URL(env)` must not run while the module is
 * being imported, or a deploy environment that has not been given its env
 * vars yet — every first CI build — fails before the app can start.
 */
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function jwks() {
  if (!_jwks) {
    const url = process.env.SUPABASE_JWKS_URL;
    if (!url) throw new Error('SUPABASE_JWKS_URL is not set — sessions cannot be verified.');
    _jwks = createRemoteJWKSet(new URL(url));
  }
  return _jwks;
}

/** Missing env is a configuration error, not a "not logged in". Fail loudly once. */
function raiseConfig(): boolean {
  const missing = ['SUPABASE_JWKS_URL', 'SUPABASE_URL'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[auth] Env vars not configured: ${missing.join(', ')}.`);
    return true;
  }
  return false;
}

/** Read + cryptographically verify the session from the request cookies. */
export async function verifySession(): Promise<SessionUser | null> {
  // Same rule as the middleware: unset env is a misconfiguration, not "logged
  // out", so say so loudly in the server logs instead of throwing a 500.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[auth] NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.');
    return null;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  // getSession() parses the cookie locally; it does not hit the network
  // unless the access token has expired and needs refreshing.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  if (raiseConfig()) return null;

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(session.access_token, jwks(), {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
    }));
  } catch {
    return null;
  }

  const appMeta = (payload as any).app_metadata ?? {};
  const userMeta = (payload as any).user_metadata ?? (session.user as any).user_metadata ?? {};
  const email = String(payload.email ?? session.user.email ?? '');
  return {
    id: String(payload.sub),
    email,
    role: String(appMeta.role ?? 'employee'),
    username: usernameFor(email, userMeta),
  };
}

/** Verified session or a redirect to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await verifySession();
  if (!user) {
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }
  return user!;
}

/** Verified super-user session, or null. Never trusts an unverified cookie. */
export async function requireSuper(): Promise<SessionUser | null> {
  const user = await verifySession();
  return user && user.role === 'super_admin' ? user : null;
}

/* ==========================================================================
   Roles & permissions.
   A role is a key (`app_metadata.role`) that maps to a permission list in the
   `roles` table. Until that migration has run, the built-in floor below is
   used instead, so deploying this code first is safe.
   ========================================================================== */

/** The grants each built-in role has even if the roles table is not there yet. */
export const BUILTIN_FALLBACK: Record<string, string[]> = {
  admin: ['crm.read', 'crm.write', 'chat.inbox', 'chat.team', 'website.manage'],
  employee: ['crm.read', 'crm.write', 'chat.inbox', 'chat.team'],
};

/** Every permission the portal understands. The Roles page renders this list. */
export const PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: 'crm.read',    label: 'See CRM records',   description: 'View leads, contacts, deals and tasks.' },
  { key: 'crm.write',   label: 'Edit CRM records',  description: 'Create, edit and delete leads, contacts, deals and tasks.' },
  { key: 'chat.inbox',  label: 'Visitor inbox',     description: 'Read and reply to website visitors.' },
  { key: 'chat.team',   label: 'Team chat',         description: 'Send messages in # general and in DMs.' },
  { key: 'website.manage', label: 'Website content',description: 'Publish and edit projects, team and launch banner on octadevs.fun.' },
  { key: 'people.manage',  label: 'People',         description: "Create accounts, change emails, passwords and who has which role." },
  { key: 'roles.manage',   label: 'Roles',          description: 'Create roles and decide what each one can do.' },
];

export type RoleRow = {
  key: string;
  name: string;
  description: string;
  permissions: string[];
  is_builtin: boolean;
};

let _permCache: { at: number; roles: Record<string, string[]> } | null = null;
const PERM_TTL_MS = 30_000;

/** role key -> permission list. Built-in floor + anything in the roles table. */
export async function rolePermissionsMap(): Promise<Record<string, string[]>> {
  if (_permCache && Date.now() - _permCache.at < PERM_TTL_MS) return _permCache.roles;
  const map: Record<string, string[]> = { ...BUILTIN_FALLBACK };
  try {
    const { data, error } = await admin().from('roles').select('key, permissions');
    if (!error && Array.isArray(data)) {
      for (const r of data) map[r.key] = Array.isArray(r.permissions) ? r.permissions : [];
    }
  } catch {
    // Roles table not migrated yet: the built-in floor applies.
  }
  _permCache = { at: Date.now(), roles: map };
  return map;
}

/** Forget the cached mapping (call after a role definition changes). */
export function invalidatePermissionCache() {
  _permCache = null;
}

function listIncludes(perms: string[], perm: string): boolean {
  return perms.includes('*') || perms.includes(perm);
}

/** True when this user's role grants the permission. Super users always do. */
export async function userHas(user: SessionUser, perm: string): Promise<boolean> {
  if (user.role === 'super_admin') return true;
  const map = await rolePermissionsMap();
  return listIncludes(map[user.role] ?? [], perm);
}

/** Signed in AND allowed, or null. Every guarded API route calls this. */
export async function requirePerm(perm: string): Promise<SessionUser | null> {
  const user = await verifySession();
  if (!user) return null;
  return (await userHas(user, perm)) ? user : null;
}

/** The permission keys a user holds — what /api/session offers the UI. */
export async function effectivePermissions(user: SessionUser): Promise<string[]> {
  if (user.role === 'super_admin') return PERMISSIONS.map((p) => p.key);
  const map = await rolePermissionsMap();
  return map[user.role] ?? [];
}

/** Does this role key exist (built-ins + everything created in the Roles page)? */
export async function roleExists(key: string): Promise<boolean> {
  if (key === 'super_admin') return true;
  const map = await rolePermissionsMap();
  return Object.prototype.hasOwnProperty.call(map, key);
}

