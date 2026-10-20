import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { admin, genId } from '@/lib/crm';

export const dynamic = 'force-dynamic';

/**
 * Poster images for notice-board ads. Files land in a public bucket so the
 * <img> tags need no signed URLs; the bucket is created on first upload.
 */
const BUCKET = 'ad-media';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

let _bucketReady: Promise<void> | null = null;
function ensureBucket() {
  if (!_bucketReady) {
    _bucketReady = admin()
      .storage.listBuckets()
      .then(async ({ data }) => {
        if (!data?.find((b) => b.name === BUCKET)) {
          await admin().storage.createBucket(BUCKET, { public: true });
        }
      })
      .catch(() => {});
  }
  return _bucketReady;
}

export async function POST(req: NextRequest) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No image attached.' }, { status: 400 });
  }

  const ext = TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP or GIF images can be used.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That image is over 5 MB — pick a smaller one.' }, { status: 400 });
  }

  await ensureBucket();
  const path = `${user.id}/${genId()}${ext}`;
  const { error } = await admin().storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error('[ads] image upload failed:', error.message);
    return NextResponse.json({ error: 'The image could not be uploaded. Try again.' }, { status: 502 });
  }

  const base = process.env.SUPABASE_URL!.replace(/\/$/, '');
  return NextResponse.json({ url: `${base}/storage/v1/object/public/${BUCKET}/${path}` });
}
