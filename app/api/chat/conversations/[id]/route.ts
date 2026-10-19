import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { admin } from '@/lib/crm';
import { BRAND, notifyDiscord } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 4000;

const FIELDS = 'id, visitor_name, visitor_email, first_page, last_page, status, unread_team, unread_visitor, last_message_at, created_at';

type Ctx = { params: { id: string } };

/** One thread's messages, plus the visitor's context. Opening it marks it read. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const db = admin();
  const { data: conversation, error } = await db
    .from('chat_conversations')
    .select(FIELDS)
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: messages } = await db
    .from('chat_messages')
    .select('id, sender, author_email, author_name, body, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(500);

  // Having the thread on screen *is* the team reading it.
  if (conversation.unread_team) {
    await db.from('chat_conversations').update({ unread_team: 0 }).eq('id', id);
    conversation.unread_team = 0;
  }

  return NextResponse.json({ conversation, messages: messages || [] });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const raw = await req.json().catch(() => null);
  const payload = (raw && typeof raw === 'object' ? raw : {}) as { body?: unknown; status?: unknown };

  const db = admin();
  const { data: current } = await db.from('chat_conversations').select('id, status').eq('id', id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const patch: Record<string, any> = {};
  let message: any = null;

  if (typeof payload.body === 'string') {
    const body = payload.body.trim().slice(0, MAX_BODY);
    if (!body) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });

    const { data, error } = await db
      .from('chat_messages')
      .insert({
        conversation_id: id,
        sender: 'team',
        author_email: user.email,
        author_name: user.email,
        body,
      })
      .select('id, sender, author_email, author_name, body, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    message = data;
  }

  if (payload.status === 'open' || payload.status === 'closed') {
    patch.status = payload.status;
    if (payload.status === 'closed') patch.unread_team = 0;
    if (payload.status === 'open') patch.unread_visitor = 0;
  }

  if (Object.keys(patch).length) {
    const { error } = await db.from('chat_conversations').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: conversation } = await db.from('chat_conversations').select(FIELDS).eq('id', id).maybeSingle();

  if (message) {
    await notifyDiscord({
      title: 'Team replied to a visitor',
      color: BRAND.ok,
      timestamp: message.created_at,
      fields: [
        { name: 'Visitor', value: conversation?.visitor_name || conversation?.visitor_email || 'Unknown', inline: true },
        { name: 'Sent by', value: user.email, inline: true },
        { name: 'Message', value: message.body.slice(0, 200) || '—' },
      ],
    });
  }

  return NextResponse.json({ conversation, message });
}
