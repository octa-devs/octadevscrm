import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

/**
 * The static /app/login.html signs people in against Supabase Auth directly
 * (passwords never touch this server) and then calls here once with the
 * session it received. setSession writes the exact `sb-<ref>-auth-token`
 * cookies the middleware and every API route read, so a static page and the
 * server share one identity.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const access_token = body?.access_token;
  const refresh_token = body?.refresh_token;
  if (typeof access_token !== 'string' || typeof refresh_token !== 'string') {
    return NextResponse.json({ error: 'Missing session tokens.' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll: () => [],
        setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  );

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });
  return response;
}

/** Sign out of this device. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  const ref = (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://x.supabase.co').hostname.split('.')[0] || '').trim();
  if (ref) {
    [`sb-${ref}-auth-token`, `sb-${ref}-auth-token.0`, `sb-${ref}-auth-token.1`, `sb-${ref}-auth-token.2`, `sb-${ref}-auth-token.3`, `sb-${ref}-auth-token-code-verifier`]
      .forEach((name) => response.cookies.delete(name));
  }
  return response;
}
