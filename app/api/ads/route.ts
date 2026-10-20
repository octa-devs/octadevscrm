import { NextRequest, NextResponse } from 'next/server';
import { verifySession, userHas } from '@/lib/auth';
import { readEntity, writeEntity, genId, admin } from '@/lib/crm';

export const dynamic = 'force-dynamic';

/**
 * The notice board. Any signed-in team member can post; everyone can read;
 * an ad can be taken down by whoever posted it, or by anyone who manages
 * people (which includes super users). Stored as one JSON file alongside the
 * CRM entities, so no extra migration is needed.
 *
 * Media: poster images live in the public `ad-media` bucket (uploaded via
 * /api/ads/media); videos are YouTube/Vimeo embeds, never uploaded files.
 */
const MAX_ADS = 200;
const AD_TAGS = ['Offer', 'Looking for', 'Service', 'Announcement'] as const;
const MEDIA_BUCKET = 'ad-media';

type Ad = {
  id: string;
  title: string;
  body: string;
  link: string;
  tag: string;
  image: string;
  video: string;
  created_at: string;
  created_by: string;
  created_by_name: string;
};

const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

/** Only absolute http(s) links — never javascript: or data:. */
function safeLink(raw: string): string | null {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Turn a YouTube or Vimeo link into its embed form. Anything else is
 * rejected — arbitrary embeds would be an XSS hole.
 */
function videoToEmbed(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      const m = u.pathname.match(/^\/(embed|shorts)\/([\w-]+)/);
      return m ? `https://www.youtube.com/embed/${m[2]}` : null;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Poster images must come from our own public bucket — no hotlinked <img>. */
function safeImage(raw: string): string | null {
  if (!raw) return '';
  const base = process.env.SUPABASE_URL!.replace(/\/$/, '');
  return raw.startsWith(`${base}/storage/v1/object/public/${MEDIA_BUCKET}/`) ? raw : null;
}

const newestFirst = (a: Ad, b: Ad) => String(b.created_at).localeCompare(String(a.created_at));

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ads = (await readEntity('ads')).sort(newestFirst).slice(0, MAX_ADS);
  const canModerate = user.role === 'super_admin' || (await userHas(user, 'people.manage'));
  return NextResponse.json({ ads, canModerate, tags: AD_TAGS });
}

export async function POST(req: NextRequest) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const title = clean(body?.title, 90);
  const text = clean(body?.body, 2000);
  const tag = AD_TAGS.includes(body?.tag) ? body.tag : AD_TAGS[0];
  const link = safeLink(clean(body?.link, 500));
  const image = safeImage(clean(body?.image, 500));
  const video = videoToEmbed(clean(body?.video, 300));

  if (title.length < 3) return NextResponse.json({ error: 'Give the ad a title (at least 3 characters).' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'Write a few words about what you are posting.' }, { status: 400 });
  if (link === null) return NextResponse.json({ error: 'That link does not look like a web address — use http:// or https://.' }, { status: 400 });
  if (image === null) return NextResponse.json({ error: 'That poster image is not from this portal.' }, { status: 400 });
  if (video === null) return NextResponse.json({ error: 'Videos must be a YouTube or Vimeo link.' }, { status: 400 });

  const ad: Ad = {
    id: genId(),
    title,
    body: text,
    link,
    tag,
    image,
    video,
    created_at: new Date().toISOString(),
    created_by: user.email,
    created_by_name: user.username,
  };

  const ads = await readEntity('ads');
  ads.unshift(ad);
  // The board is a notice board, not an archive: keep the newest slice.
  await writeEntity('ads', ads.slice(0, MAX_ADS));
  return NextResponse.json({ ad });
}

export async function DELETE(req: NextRequest) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Which ad?' }, { status: 400 });

  const ads = await readEntity('ads');
  const ad = ads.find((a) => a.id === id) as Ad | undefined;
  if (!ad) return NextResponse.json({ error: 'That ad is already gone.' }, { status: 404 });

  const mine = String(ad.created_by).toLowerCase() === String(user.email).toLowerCase();
  if (!mine && !(await userHas(user, 'people.manage'))) {
    return NextResponse.json({ error: 'Only the person who posted it — or a manager — can take this down.' }, { status: 403 });
  }

  await writeEntity('ads', ads.filter((a) => a.id !== id));

  // Best-effort: the poster image outlives the ad otherwise.
  if (ad.image) {
    const prefix = `${process.env.SUPABASE_URL!.replace(/\/$/, '')}/storage/v1/object/public/${MEDIA_BUCKET}/`;
    const path = ad.image.startsWith(prefix) ? ad.image.slice(prefix.length) : null;
    if (path) await admin().storage.from(MEDIA_BUCKET).remove([path]).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
