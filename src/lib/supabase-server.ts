import { createServerClient } from '@supabase/ssr';
import type { APIContext } from 'astro';

/**
 * A Supabase client for use in server-side Astro code — middleware, API
 * routes, and pages with `export const prerender = false`. It reads the
 * logged-in user's session from cookies on the incoming request, and writes
 * any refreshed session back as cookies on the outgoing response.
 *
 * This Astro version's `context.cookies` can only fetch one named cookie at
 * a time (`cookies.get(name)`), but Supabase's client needs to see every
 * cookie on the request at once (`getAll`). So `getAll` here parses the raw
 * `Cookie` request header directly instead — same end result, just read a
 * different way. `setAll` doesn't have that problem: it hands each cookie
 * to `cookies.set()`, which Astro already supports natively.
 */
export function createSupabaseServerClient({
  request,
  cookies,
}: Pick<APIContext, 'request' | 'cookies'>) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        const header = request.headers.get('cookie') ?? '';
        return header
          .split(';')
          .map((pair) => pair.trim())
          .filter(Boolean)
          .map((pair) => {
            const [name, ...rest] = pair.split('=');
            return { name, value: decodeURIComponent(rest.join('=')) };
          });
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.set(name, value, options);
        }
      },
    },
  });
}
