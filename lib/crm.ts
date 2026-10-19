import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'crm-data';

/**
 * One admin client per process instead of one per request.
 * Creating a client is cheap; keeping the connection warm is not nothing.
 */
let _admin: SupabaseClient | null = null;
export function admin() {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}

/**
 * listBuckets() is a network round-trip (~450ms) and was running on every
 * single read. The bucket either exists or it doesn't — check once.
 */
let _bucketReady: Promise<void> | null = null;
function ensureBucket() {
  if (!_bucketReady) {
    _bucketReady = admin()
      .storage.listBuckets()
      .then(async ({ data }) => {
        if (!data?.find((b) => b.name === BUCKET)) {
          await admin().storage.createBucket(BUCKET, { public: false });
        }
      })
      .catch(() => {});
  }
  return _bucketReady;
}

/**
 * Read-through cache. Supabase Storage costs ~450ms per download; the same
 * list is re-requested constantly while a person clicks around. A short TTL
 * makes navigation instant. Writes invalidate immediately, so a user always
 * sees their own change on the next render.
 */
const TTL_MS = 30_000;
const cache = new Map<string, { items: any[]; at: number }>();

export async function readEntity(entity: string): Promise<any[]> {
  const hit = cache.get(entity);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.items;

  await ensureBucket();
  try {
    const { data, error } = await admin().storage.from(BUCKET).download(`${entity}.json`);
    if (error || !data) {
      if (hit) return hit.items; // fall back to stale rather than blank the UI
      cache.set(entity, { items: [], at: Date.now() });
      return [];
    }
    const items = JSON.parse(await data.text());
    cache.set(entity, { items, at: Date.now() });
    return items;
  } catch {
    return hit ? hit.items : [];
  }
}

export async function writeEntity(entity: string, items: any[]) {
  cache.set(entity, { items, at: Date.now() }); // write-through: visible instantly
  await ensureBucket();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  await admin().storage.from(BUCKET).upload(`${entity}.json`, blob, { upsert: true, contentType: 'application/json' });
}

export function genId() {
  return crypto.randomUUID();
}
