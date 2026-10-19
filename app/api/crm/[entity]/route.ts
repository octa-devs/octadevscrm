import { NextRequest, NextResponse } from 'next/server';
import { verifySession, userHas } from '@/lib/auth';
import { readEntity, writeEntity, genId } from '@/lib/crm';

const ALLOWED = ['leads', 'contacts', 'deals', 'tasks'];

async function guard(entity: string, edit = false) {
  if (!ALLOWED.includes(entity)) return NextResponse.json({ error: 'Bad entity' }, { status: 400 });
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (edit && !(await userHas(user, 'crm.write'))) {
    return NextResponse.json({ error: 'You can look at records, but not change them.' }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: { entity: string } }) {
  const bad = await guard(params.entity);
  if (bad) return bad;
  return NextResponse.json(await readEntity(params.entity));
}

export async function POST(req: NextRequest, { params }: { params: { entity: string } }) {
  const bad = await guard(params.entity, true);
  if (bad) return bad;
  const user = (await verifySession())!;
  const body = await req.json();
  const items = await readEntity(params.entity);
  const newItem = { id: genId(), created_at: new Date().toISOString(), created_by: user.email, ...body };
  items.unshift(newItem);
  await writeEntity(params.entity, items);
  return NextResponse.json(newItem);
}

export async function PUT(req: NextRequest, { params }: { params: { entity: string } }) {
  const bad = await guard(params.entity, true);
  if (bad) return bad;
  const body = await req.json();
  const items = await readEntity(params.entity);
  const idx = items.findIndex((i) => i.id === body.id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  items[idx] = { ...items[idx], ...body, updated_at: new Date().toISOString() };
  await writeEntity(params.entity, items);
  return NextResponse.json(items[idx]);
}

export async function DELETE(req: NextRequest, { params }: { params: { entity: string } }) {
  const bad = await guard(params.entity, true);
  if (bad) return bad;
  const id = new URL(req.url).searchParams.get('id');
  const items = await readEntity(params.entity);
  await writeEntity(params.entity, items.filter((i) => i.id !== id));
  return NextResponse.json({ ok: true });
}
