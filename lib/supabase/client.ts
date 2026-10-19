import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Fallbacks only keep *build-time prerendering* from throwing: a page that
  // statically renders this client component cannot know the real project.
  // With proper env vars set (always true in production) the real values win.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.invalid',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
  );
}