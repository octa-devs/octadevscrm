import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { admin } from '@/lib/crm';

export const dynamic = 'force-dynamic';

const MAX_BODY = 4000;
const GENERAL = 'general';

const norm = (s: string) => String(s || '').trim().toLowerCase();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * A room is either the shared 'general' or a DM. DM keys are derived from the
 * caller's own address — never accepted from them — so knowing two other
 * people's emails is not enough to read their thread.
 */
function roomFor(me: string, partner: string | null) {
  if (!partner) return GENERAL;
  const pair = [me, partner].sort();
  return `dm:${pair[0]}|${pair[1]}`;
}

/** `null` = shared room, a string = that DM, `undefined` = reject the input. */
function partnerFrom(value: unknown, me: string): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  const partner = norm(String(value));
  if (partner === me || !EMAIL.test(partner)) return undefined;
  return partner;
}

export async function GET(req: NextRequest) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const me = norm(user.email);
  const partner = partnerFrom(new URL(req.url).searchParams.get('partner'), me);
  if (partner === undefined) return NextResponse.json({ error: 'Unknown recipient.' }, { status: 400 });

  const { data, error } = await admin()
    .from('chat_team_messages')
    .select('id, author_email, author_username, body, created_at')
    .eq('room_key', roomFor(me, partner ?? null))
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: (data || []).reverse() });
}

export async function POST(req: NextRequest) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const payload = (raw && typeof raw === 'object' ? raw : {}) as { body?: unknown; partner?: unknown };

  const me = norm(user.email);
  const partner = partnerFrom(payload.partner, me);
  if (partner === undefined) return NextResponse.json({ error: 'Unknown recipient.' }, { status: 400 });

  const body = String(payload.body ?? '').trim().slice(0, MAX_BODY);
  if (!body) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });

  const { data, error } = await admin()
    .from('chat_team_messages')
    .insert({
      room_key: roomFor(me, partner),
      author_email: user.email,
      author_username: user.username,
      body,
    })
    .select('id, author_email, author_username, body, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
