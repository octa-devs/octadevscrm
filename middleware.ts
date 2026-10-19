import { createServerClient } from '@supabase/ssr';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Legacy page routes now redirect into the static HTML app in /app/. The
 * React app still exists in the repo, but the product is hand-written HTML,
 * CSS and JS; the Next.js layer survives as the API the static app talks to.
 */
const LEGACY_ROUTES: [string, string][] = [
  ['/dashboard/crm/leads', '/app/data.html?entity=leads'],
  ['/dashboard/crm/contacts', '/app/data.html?entity=contacts'],
  ['/dashboard/crm/deals', '/app/data.html?entity=deals'],
  ['/dashboard/crm/tasks', '/app/data.html?entity=tasks'],
  ['/dashboard/chat', '/app/chat.html'],
  ['/dashboard/website', '/app/website.html'],
  ['/dashboard/users', '/app/users.html'],
  ['/dashboard', '/app/dashboard.html'],
];

/**
 * Verified locally against Supabase's JWKS. Zero network calls on the hot
 * path unless a session genuinely needs refreshing.
 *
 * Built lazily, so importing this module without env vars (a fresh CI build)
 * cannot throw `Invalid URL` at `new URL(undefined)`.
 */
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function jwks() {
  if (!_jwks) {
    const url = process.env.SUPABASE_JWKS_URL;
    if (!url) throw new Error('SUPABASE_JWKS_URL is not set.');
    _jwks = createRemoteJWKSet(new URL(url));
  }
  return _jwks;
}

/**
 * The permission floor applied before the `roles` table has been migrated.
 * Kept in sync with BUILTIN_FALLBACK in lib/auth (duplicated here because
 * middleware runs in the edge runtime, which cannot import app-server-only
 * modules).
 */
const FALLBACK: Record<string, string[]> = {
  admin: ['crm.read', 'crm.write', 'chat.inbox', 'chat.team', 'website.manage'],
  employee: ['crm.read', 'crm.write', 'chat.inbox', 'chat.team'],
};

let _permT = 0;
let _permMap: Record<string, string[]> = { ...FALLBACK };

/**
 * Roles mapping for page gating, cached briefly. Read with the visitor's own
 * session client (anonymous reads are not possible), so a missing RLS policy
 * simply keeps the fallback in place.
 */
async function supaHasPerm(supabase: ReturnType<typeof createServerClient>, role: string, perm: string): Promise<boolean> {
  if (role === 'super_admin') return true;
  if (Date.now() - _permT > 30_000) {
    try {
      const { data, error } = await supabase.from('roles').select('key, permissions');
      if (!error && Array.isArray(data)) {
        const map: Record<string, string[]> = { ...FALLBACK };
        for (const r of data) map[r.key] = Array.isArray(r.permissions) ? r.permissions : [];
        _permMap = map;
        _permT = Date.now();
      }
    } catch {
      // Table not migrated yet: the floor decides. Deploy-safe.
    }
  }
  const perms = _permMap[role] ?? [];
  return perms.includes('*') || perms.includes(perm);
}

/**
 * Missing env degrades to "not signed in", never to a 500 from this edge
 * function — that is what MIDDLEWARE_INVOCATION_FAILED looks like on a fresh
 * deploy whose vars have not been added yet.
 */
async function readSession(request: NextRequest): Promise<{ role: string; supabase: ReturnType<typeof createServerClient> } | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[auth] middleware: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.');
    return null;
  }

  // A response that can carry refreshed cookies, so a session lives as long as
  // Supabase says, not just until the access token expires.
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    if (!process.env.SUPABASE_JWKS_URL || !process.env.SUPABASE_URL) return null;
    const { payload } = await jwtVerify(session.access_token, jwks(), {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
    });
    return { role: String((payload as any).app_metadata?.role ?? 'employee'), supabase };
  } catch (err) {
    console.error('[auth] middleware readSession failed:', err);
    return null;
  }
}

/**
 * Page gates. The server-side APIs are authoritative regardless — this just
 * keeps people off pages they cannot use. A session client is returned by
 * readSession, so the roles lookup rides on the visitor's own identity.
 */
const PAGE_PERMS: [string, string[]][] = [
  ['/app/users.html', ['people.manage', 'roles.manage']],
  ['/app/roles.html', ['roles.manage']],
  ['/app/website.html', ['website.manage']],
  ['/app/chat.html', ['chat.inbox', 'chat.team']],
  ['/app/data.html', ['crm.read']],
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const to = (dest: string) => NextResponse.redirect(new URL(dest, request.url));

  // 1. Legacy routes land on the new app.
  for (const [from, dest] of LEGACY_ROUTES) {
    if (path === from || path.startsWith(from + '/')) return to(dest);
  }
  if (path === '/') return to('/app/dashboard.html');
  if (path === '/login') return to('/app/login.html');

  // 2. The static app: everything except its login page wants a session.
  if (path.startsWith('/app/')) {
    if (path === '/app/login.html') {
      // Nobody sees a login form they do not need.
      const session = await readSession(request);
      if (session) return to('/app/dashboard.html');
      return NextResponse.next();
    }

    const session = await readSession(request);
    if (!session) return to('/app/login.html');

    for (const [page, perms] of PAGE_PERMS) {
      if (path !== page) continue;
      const allowed = await Promise.all(perms.map((p) => supaHasPerm(session.supabase, session.role, p)));
      if (!allowed.some(Boolean)) return to('/app/dashboard.html');
      break;
    }
    return NextResponse.next();
  }

  // 3. Everything else (API routes guard themselves; /api/auth/session is
  //    deliberately callable by an anonymous browser that just signed in).
  return NextResponse.next();
}

export const config = {
  // Assets and APIs skip the middleware entirely: static files resolve faster
  // and /api/* routes own their own auth via verifySession.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|app/assets|api/|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|txt|xml)$).*)',
  ],
};
