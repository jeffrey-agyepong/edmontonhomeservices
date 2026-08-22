// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

/*
 * Site and base can be set here or passed as environment variables, which is
 * what a CI deploy usually wants:
 *
 *   SITE=https://example.com npm run build
 *   SITE=https://example.com BASE=/directory/ npm run build   (subdirectory)
 */

/*
 * Keystatic's /keystatic admin route is server-rendered (it writes to the
 * filesystem), which this static site has no adapter for. Only mount it
 * under `astro dev` — a production `astro build` stays fully static, and
 * the route simply doesn't exist in the deployed output. Checked against
 * argv directly (rather than defineConfig's function-form `command`
 * callback) since that callback isn't reliably invoked by this Astro
 * version's persistent dev-server daemon.
 */
const isDev = process.argv.includes('dev');

export default defineConfig({
  site: process.env.SITE || 'https://example.com',
  base: process.env.BASE || '/',
  trailingSlash: 'ignore',
  integrations: [sitemap(), react(), ...(isDev ? [keystatic()] : [])],
  vite: {
    plugins: [tailwindcss()],
  },
});
