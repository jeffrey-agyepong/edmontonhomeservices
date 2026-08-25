// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import netlify from '@astrojs/netlify';

/*
 * Site and base can be set here or passed as environment variables, which is
 * what a CI deploy usually wants:
 *
 *   SITE=https://example.com npm run build
 *   SITE=https://example.com BASE=/directory/ npm run build   (subdirectory)
 */

/*
 * Keystatic's /keystatic admin route is server-rendered (it writes to the
 * filesystem). Only mount it under `astro dev` — the admin UI has no
 * business being part of a production deploy. Checked against argv
 * directly (rather than defineConfig's function-form `command` callback)
 * since that callback isn't reliably invoked by this Astro version's
 * persistent dev-server daemon.
 */
const isDev = process.argv.includes('dev');

export default defineConfig({
  site: process.env.SITE || 'https://example.com',
  base: process.env.BASE || '/',
  trailingSlash: 'ignore',
  /*
   * 'static' is the modern equivalent of what used to be called 'hybrid':
   * every page is prerendered to a plain HTML file at build time UNLESS
   * that page opts out with `export const prerender = false`, in which
   * case the adapter below serves it on demand instead (as a Netlify
   * Function). Astro dropped the 'hybrid' output value years ago — 'static'
   * has had this exact opt-out behavior ever since, so this is the correct
   * setting for "static by default, server-rendered where I ask for it."
   * The adapter is what makes `prerender = false` possible at all; without
   * one, `astro build` refuses to emit any on-demand route.
   */
  output: 'static',
  adapter: netlify(),
  integrations: [sitemap(), react(), ...(isDev ? [keystatic()] : [])],
  vite: {
    plugins: [tailwindcss()],
  },
});
