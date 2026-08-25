import { createBrowserClient } from '@supabase/ssr';

/**
 * A Supabase client for use in the browser (inside a page's <script> tag).
 * Not asked for directly, but required by step 5: signInWithOtp() has to
 * run client-side, in the visitor's own browser, so it needs its own client
 * instance — the server client in supabase-server.ts only runs on our
 * server and can't be imported into browser code.
 *
 * createBrowserClient (rather than plain supabase-js's createClient) stores
 * the session in cookies instead of localStorage, so the server-side client
 * above can read the same session back out on the next request.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
