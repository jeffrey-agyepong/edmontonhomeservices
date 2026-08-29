import { createClient } from '@supabase/supabase-js';

/**
 * A plain, unauthenticated Supabase client for contexts that have no
 * request to read a session from — namely `getStaticPaths()` and other
 * page frontmatter that runs once at build time, not per-visitor. Every
 * read through this client is scoped by RLS exactly like an anonymous
 * visitor's would be (see the "Public can view approved businesses"
 * policy) — it never sees anything a logged-out visitor couldn't.
 */
export function createSupabaseAnonClient() {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
