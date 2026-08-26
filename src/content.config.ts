import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import type { Loader } from 'astro/loaders';
import { promises as fsPromises } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * Two ways to get content, chosen by whether DIRECTORY_API is set.
 *
 *   unset  →  the JSON files in src/content/ — edit them, commit, redeploy.
 *   set    →  fetched from a running c00d Directory at build time.
 *
 * The second is why this exists: a directory is inherently dynamic (people
 * submit listings, clicks get counted), and a static site cannot do that on its
 * own. Point this at an installation that can, and you get a fast static front
 * end over a live dataset. Rebuild to publish changes.
 */

/*
 * Free-tier listing fields, plus two independent paid add-ons:
 *
 *   premium    — unlocks the photo gallery (real `gallery` photos if
 *                supplied, else an auto-generated placeholder), the
 *                quote-request form, the "Edmonton Verified" badge, the
 *                custom "Why Choose Us" section, and a dofollow outbound
 *                link on the listing's own page — see the Advertise page's
 *                Premium Partner tier.
 *   sponsored  — places the listing in the homepage "Local Spotlight"
 *                section (see Sponsors.astro). Independent of `premium` —
 *                a business can buy either, both, or neither.
 */
const listingSchema = z.object({
  name: z.string(),
  category: z.string().nullable().optional(),
  neighborhood: z.string().default(''),
  phone: z.string().default(''),
  email: z.string().default(''),
  website: z.string().url(),
  description: z.string().default(''),
  // Premium-only pitch shown in its own "Why Choose Us" section.
  why_choose_us: z.string().default(''),
  photo: z.string().default(''),
  gallery: z.array(z.string()).default([]),
  hours: z.string().default(''),
  years_in_business: z.number().nullable().default(null),
  licensed_insured: z.boolean().default(false),
  address: z.string().default(''),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  sponsored: z.boolean().default(false),
  services: z.array(z.string()).default([]),
  premium: z.boolean().default(false),
  // Hand-curated, real reviews (never scraped or fabricated) — shown on the
  // listing page if present, otherwise it falls back to the "no reviews
  // yet" empty state with the submission form.
  reviews: z
    .array(
      z.object({
        name: z.string(),
        location: z.string().default(''),
        rating: z.number().min(1).max(5),
        text: z.string(),
      }),
    )
    .default([]),
  // A snapshot of the business's real public Google rating, looked up and
  // recorded manually — not fetched live (this is a static site with no
  // Google Places API key configured). Leave both null rather than guess
  // when a rating can't be verified.
  google_rating: z.number().min(0).max(5).nullable().default(null),
  google_review_count: z.number().int().nullable().default(null),
  // Not the source of truth for routing — Keystatic doesn't persist this
  // field's value back into the file (it only uses it to name the file),
  // so `entry.id` (always present, and equal to the filename) is what
  // every consumer keys off of. Kept optional here only so a file missing
  // it doesn't fail validation; see src/lib/categories.ts and friends.
  slug: z.string().optional(),
});

const categorySchema = z.object({
  name: z.string(),
  // See the comment on listingSchema.slug — not the source of truth for
  // routing, `entry.id` is.
  slug: z.string().optional(),
  description: z.string().default(''),
  // Shown on the /categories page's card grid (CategoryBox.astro). Empty
  // by default — no per-category photo data exists yet, so the card
  // falls back to its decorative placeholder box until this is set.
  image: z.string().default(''),
  order: z.number().default(0),
});

/* Editable pages — about, privacy, terms. Body is trusted HTML from the
 * directory's own admin, the same content the PHP site renders. */
const pageSchema = z.object({
  title: z.string(),
  slug: z.string().optional(),
  body: z.string().default(''),
  inFooter: z.boolean().default(true),
  order: z.number().default(0),
});

/*
 * The About page's own copy (hero, "why we started" section, photo, stat
 * card). Keystatic edits this as a singleton — one JSON file, no slug — so
 * editors touch this exact schema rather than the freeform HTML `pages`
 * collection above, which about.astro doesn't render. The credit link to
 * J.A Web Design at the bottom of the section is deliberately NOT part of
 * this schema; it's hardcoded in about.astro so its rel="noopener
 * noreferrer" and styling can't be broken from the CMS.
 */
const aboutSchema = z.object({
  heroTitle: z.string().default('About Us'),
  heroDescription: z.string().default(''),
  badgeLabel: z.string().default('Locally Rooted'),
  sectionHeading: z.string().default(''),
  paragraph1: z.string().default(''),
  paragraph2: z.string().default(''),
  imageUrl: z.string().default(''),
  statPercent: z.string().default(''),
  statCaption: z.string().default(''),
});

/**
 * Reads a single JSON file as one content entry with a fixed id, for
 * Keystatic singletons (a single file, not a directory of many). `glob()`
 * doesn't fit here — it's built for a directory of many slugged entries.
 */
function singletonLoader(id: string, relPath: string): Loader {
  return {
    name: `singleton-${id}`,
    load: async ({ store, parseData, config, watcher, logger }) => {
      const filePath = fileURLToPath(new URL(relPath, config.root));

      async function sync() {
        let raw: string;
        try {
          raw = await fsPromises.readFile(filePath, 'utf-8');
        } catch {
          logger.warn(`${id}: no file at ${relPath}, using schema defaults`);
          raw = '{}';
        }
        const data = await parseData({ id, data: JSON.parse(raw) });
        store.set({ id, data });
      }

      await sync();
      watcher?.add(filePath);
      watcher?.on('change', (changedPath) => {
        if (changedPath === filePath) sync();
      });
    },
  };
}

const about = defineCollection({
  loader: singletonLoader('about', './src/content/about/index.json'),
  schema: aboutSchema,
});

/** Trailing slashes and a missing scheme are the two easy ways to mistype this. */
function apiBase(): string | null {
  const raw = import.meta.env.DIRECTORY_API ?? process.env.DIRECTORY_API;
  if (!raw) return null;

  const trimmed = String(raw).trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Pull every page of a c00d Directory collection endpoint.
 *
 * The API caps per_page at 100, so a directory larger than that needs paging —
 * getting this wrong silently truncates the site to its first hundred entries.
 */
async function fetchAll(base: string, path: string): Promise<any[]> {
  const out: any[] = [];
  let page = 1;

  for (;;) {
    const res = await fetch(
      `${base}${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
    );
    if (!res.ok) {
      throw new Error(`${path} returned ${res.status}`);
    }

    const body = await res.json();
    const rows = Array.isArray(body.data) ? body.data : [];
    out.push(...rows);

    const pages = body.meta?.pages ?? 1;
    if (page >= pages || rows.length === 0) break;
    page++;
  }

  return out;
}

function directoryLoader(kind: 'listings' | 'categories' | 'pages'): Loader {
  return {
    name: `c00d-directory-${kind}`,
    load: async ({ store, logger, parseData, generateDigest }) => {
      const base = apiBase();

      if (!base) {
        logger.info(
          `${kind}: using local JSON (set DIRECTORY_API to fetch instead)`,
        );
        return;
      }

      logger.info(`${kind}: fetching from ${base}`);
      store.clear();

      const rows = await fetchAll(base, `/api/v1/${kind}`);

      for (const row of rows) {
        let mapped: Record<string, unknown>;

        if (kind === 'listings') {
          mapped = {
            name: row.name,
            slug: row.slug,
            website: row.website ?? row.url,
            description: row.description ?? '',
            why_choose_us: row.why_choose_us ?? '',
            category: row.category?.slug ?? undefined,
            neighborhood: row.neighborhood ?? '',
            phone: row.phone ?? '',
            email: row.email ?? '',
            photo: row.photo ?? '',
            gallery: Array.isArray(row.gallery) ? row.gallery : [],
            hours: row.hours ?? '',
            years_in_business: row.years_in_business ?? null,
            licensed_insured: Boolean(row.licensed_insured),
            address: row.address ?? '',
            latitude: row.latitude ?? null,
            longitude: row.longitude ?? null,
            services: Array.isArray(row.services) ? row.services : [],
            premium: Boolean(row.premium),
            sponsored: Boolean(row.sponsored),
            google_rating: row.google_rating ?? null,
            google_review_count: row.google_review_count ?? null,
            reviews: Array.isArray(row.reviews) ? row.reviews : [],
          };
        } else if (kind === 'categories') {
          mapped = {
            name: row.name,
            slug: row.slug,
            description: row.description ?? '',
            image: row.image ?? '',
            order: 0,
          };
        } else {
          // The collection endpoint omits body — it would bloat a list nobody
          // reads in full — so each page is fetched individually for its HTML.
          const res = await fetch(`${base}/api/v1/pages/${row.slug}`);
          if (!res.ok) {
            logger.warn(`pages: skipping ${row.slug} (${res.status})`);
            continue;
          }
          const full = (await res.json()).data ?? {};
          mapped = {
            title: full.title ?? row.title,
            slug: row.slug,
            body: full.body ?? '',
            inFooter: Boolean(full.in_footer ?? row.in_footer),
            order: Number(full.order ?? row.order ?? 0),
          };
        }

        const data = await parseData({ id: row.slug, data: mapped });
        store.set({ id: row.slug, data, digest: generateDigest(data) });
      }

      logger.info(`${kind}: ${rows.length} loaded`);
    },
  };
}

const listings = defineCollection({
  loader: apiBase()
    ? directoryLoader('listings')
    : glob({ pattern: '**/*.json', base: './src/content/listings' }),
  schema: listingSchema,
});

const categories = defineCollection({
  loader: apiBase()
    ? directoryLoader('categories')
    : glob({ pattern: '**/*.json', base: './src/content/categories' }),
  schema: categorySchema,
});

const pages = defineCollection({
  loader: apiBase()
    ? directoryLoader('pages')
    : glob({ pattern: '**/*.json', base: './src/content/pages' }),
  schema: pageSchema,
});

export const collections = { listings, categories, pages, about };
