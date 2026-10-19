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
 * Missing env degrades to "not signed in", never to a 500 from this edge
 * function — that is what MIDDLEWARE_INVOCATION_FAILED looks like on a fresh
 * deploy whose vars have not been added yet.
 */
async function readSession(request: NextRequest): Promise<{ role: string } | null> {
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
    return { role: String((payload as any).app_metadata?.role ?? 'employee') };
  } catch (err) {
    console.error('[auth] middleware readSession failed:', err);
    return null;
  }
}

const SUPER_ONLY = ['/app/users.html', '/app/website.html'];

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
    if (SUPER_ONLY.includes(path) && session.role !== 'super_admin') return to('/app/dashboard.html');
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
