import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { admin } from '@/lib/crm';

export const dynamic = 'force-dynamic';

/**
 * Inbox list. Deliberately does NOT select `visitor_token` — that value is the
 * visitor's only credential, and the CRM has no reason to hold it.
 */
export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = admin();
  const { data: rows, error } = await db
    .from('chat_conversations')
    .select('id, visitor_name, visitor_email, last_page, status, unread_team, unread_visitor, last_message_at, created_at')
    .order('last_message_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const conversations = rows || [];
  if (!conversations.length) return NextResponse.json({ conversations: [] });

  // A second read gives every row its latest line, so the list reads like an
  // inbox rather than a table. Ordered desc, the first hit per id is the newest.
  const { data: messages } = await db
    .from('chat_messages')
    .select('conversation_id, sender, body, created_at')
    .in('conversation_id', conversations.map((c: any) => c.id))
    .order('created_at', { ascending: false })
    .limit(600);

  const preview = new Map<string, any>();
  for (const m of messages || []) {
    if (!preview.has(m.conversation_id)) preview.set(m.conversation_id, m);
  }

  return NextResponse.json({
    conversations: conversations.map((c: any) => ({ ...c, last_message: preview.get(c.id) || null })),
  });
}
