import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-server';

/*
 * IMPORTANT — this only actually runs for on-demand (server-rendered)
 * pages. Astro's default output mode (`static`, see astro.config.mjs)
 * prerenders every page to a plain HTML file at build time unless that
 * page opts out with `export const prerender = false`. A prerendered page
 * is just a static file by the time someone visits it — there's no request
 * for this middleware to intercept.
 *
 * So: every page under /dashboard, once built, MUST have
 * `export const prerender = false` at the top, or this gate silently does
 * nothing once deployed. `astro dev` won't reveal that mistake — the dev
 * server runs everything on demand regardless of `prerender`, so a missing
 * flag only shows up in production. Test this in a Netlify preview deploy,
 * not just locally.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, cookies, redirect } = context;
  const base = import.meta.env.BASE_URL;
  const dashboardPrefix = `${base}dashboard`.replace(/\/+/g, '/');

  if (!url.pathname.startsWith(dashboardPrefix)) {
    return next();
  }

  const supabase = createSupabaseServerClient({ request, cookies });

  // TEMP DEBUG — remove once the redirect loop is sorted out. Raw incoming
  // Cookie header, so we can see whether the browser sent any sb-* cookies
  // back at all on this /dashboard request.
  console.log(
    '[middleware] incoming Cookie header:',
    request.headers.get('cookie'),
  );

  // getUser() (not getSession()) deliberately — getSession() just reads
  // the session out of cookies and trusts it, which means a forged or
  // stale cookie would pass. getUser() re-checks with Supabase's Auth
  // server on every call, so this is the one that actually verifies the
  // visitor is who the cookie claims. This is Supabase's own guidance for
  // anywhere a session is used to gate access, not just a style choice.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // TEMP DEBUG — remove once the redirect loop is sorted out.
  console.log('[middleware] getUser() user:', user?.id ?? null);
  console.log('[middleware] getUser() error:', error?.message ?? null);

  if (!user) {
    const loginUrl = `${base}login`.replace(/\/+/g, '/');
    return redirect(loginUrl);
  }

  // Hand the already-verified user to the page via Astro.locals, so a page
  // under /dashboard can read Astro.locals.user directly instead of
  // re-running its own getUser() check — the one above is already the
  // real gate; this just makes its result reachable.
  context.locals.user = user;

  return next();
});
