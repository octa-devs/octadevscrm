import { NextResponse } from 'next/server';
import { verifySession, userHas } from '@/lib/auth';
import { readEntity } from '@/lib/crm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await userHas(user, 'crm.read'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [leads, contacts, deals, tasks] = await Promise.all([
    readEntity('leads'), readEntity('contacts'), readEntity('deals'), readEntity('tasks'),
  ]);
  return NextResponse.json({ leads: leads.length, contacts: contacts.length, deals: deals.length, tasks: tasks.length });
}
