import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { readEntity } from '@/lib/crm';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await verifySession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [leads, contacts, deals, tasks] = await Promise.all([
    readEntity('leads'), readEntity('contacts'), readEntity('deals'), readEntity('tasks'),
  ]);
  return NextResponse.json({ leads: leads.length, contacts: contacts.length, deals: deals.length, tasks: tasks.length });
}
