import { createServerClient } from '@supabase/ssr';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Verified locally against Supabase's JWKS. Zero network calls on the hot
 * path — the previous implementation called supabase.auth.getUser() here,
 * which is an HTTP round-trip to Supabase on every single request.
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

async function readSession(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  if (!process.env.SUPABASE_JWKS_URL) return null;
  try {
    const { payload } = await jwtVerify(session.access_token, jwks(), {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
    });
    return { role: String((payload as any).app_metadata?.role ?? 'employee') };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public routes — never touch auth.
  if (path === '/' || path.startsWith('/login') || path.startsWith('/_next') || path.startsWith('/api/auth')) {
    if (path === '/' || (path.startsWith('/login') && (await readSession(request)))) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const session = await readSession(request);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const needsSuper = path.startsWith('/dashboard/users') || path.startsWith('/dashboard/website');
  if (needsSuper && session.role !== 'super_admin') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
