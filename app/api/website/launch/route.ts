import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/auth';
import { admin } from '@/lib/crm';

export async function GET() {
  if (!(await requirePerm('website.manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data, error } = await admin().from('launch_settings').select('*').eq('id', 'launch_config').single();
  return NextResponse.json(error ? { error: error.message } : data, { status: error ? 500 : 200 });
}

export async function PUT(req: NextRequest) {
  if (!(await requirePerm('website.manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data, error } = await admin().from('launch_settings').update(await req.json()).eq('id', 'launch_config').select().single();
  return NextResponse.json(error ? { error: error.message } : data, { status: error ? 500 : 200 });
}
