import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
