import { NextRequest, NextResponse } from 'next/server';
import { requireSuper } from '@/lib/auth';
import { admin } from '@/lib/crm';

export async function GET() {
  if (!(await requireSuper())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data, error } = await admin().from('team_members').select('*').order('sort_order', { ascending: true });
  return NextResponse.json(error ? { error: error.message } : data || []);
}

export async function POST(req: NextRequest) {
  if (!(await requireSuper())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data, error } = await admin().from('team_members').insert(await req.json()).select().single();
  return NextResponse.json(error ? { error: error.message } : data, { status: error ? 500 : 200 });
}

export async function PUT(req: NextRequest) {
  if (!(await requireSuper())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, ...rest } = await req.json();
  const { data, error } = await admin().from('team_members').update(rest).eq('id', id).select().single();
  return NextResponse.json(error ? { error: error.message } : data, { status: error ? 500 : 200 });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireSuper())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  const { error } = await admin().from('team_members').delete().eq('id', id);
  return NextResponse.json(error ? { error: error.message } : { ok: true }, { status: error ? 500 : 200 });
}
