/**
 * One-time migration: reads every business listing out of the Keystatic
 * content collection (src/content/listings/*.json) and inserts it into
 * Supabase's `businesses` table.
 *
 * Not part of the live app — this only runs when you invoke it directly:
 *
 *   node scripts/migrate-to-supabase.ts             (dry run — prints a
 *                                                     summary and a sample
 *                                                     of mapped records,
 *                                                     writes nothing)
 *   node scripts/migrate-to-supabase.ts --confirm    (actually inserts)
 *
 * Field mapping, Keystatic -> Supabase (see full explanation in chat):
 *   filename (not the internal `slug` field) -> slug
 *   name                                     -> name
 *   category                                 -> category   (still the
 *                                                            category
 *                                                            slug, e.g.
 *                                                            "electricians"
 *                                                            — not resolved
 *                                                            to a display
 *                                                            name)
 *   neighborhood                             -> neighborhood
 *   phone                                    -> phone
 *   website                                  -> website
 *   description                              -> description
 *   photo                                    -> photo_url
 *   hours                                    -> hours
 *   years_in_business                        -> years_in_business
 *   licensed_insured                         -> licensed_insured
 *   address                                  -> address
 *   latitude                                 -> latitude
 *   longitude                                -> longitude
 *   google_rating                            -> google_rating
 *   google_review_count                      -> google_review_count
 *   (always false)                           -> premium
 *   (always null)                            -> owner_id
 *
 * Not migrated yet (present in Keystatic, not in the target column list —
 * tell me if any of these should be added):
 *   email, why_choose_us, gallery, sponsored, services, reviews
 */

import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// .env has PUBLIC_SUPABASE_URL, .env.local has the service_role key. Two
// separate files on purpose — .env's contents end up readable by the
// browser (see astro.config.mjs / any PUBLIC_ variable), the service_role
// key must never go anywhere near client code, so it lives somewhere the
// app itself doesn't even load from.
process.loadEnvFile(path.join(process.cwd(), '.env'));
process.loadEnvFile(path.join(process.cwd(), '.env.local'));

const LISTINGS_DIR = path.join(process.cwd(), 'src/content/listings');

interface KeystaticListing {
  name: string;
  category?: string | null;
  neighborhood?: string;
  phone?: string;
  website: string;
  description?: string;
  photo?: string;
  hours?: string;
  years_in_business?: number | null;
  licensed_insured?: boolean;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  google_rating?: number | null;
  google_review_count?: number | null;
}

interface BusinessRow {
  slug: string;
  name: string;
  category: string | null;
  neighborhood: string | null;
  phone: string | null;
  website: string;
  description: string | null;
  photo_url: string | null;
  hours: string | null;
  years_in_business: number | null;
  licensed_insured: boolean;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  google_review_count: number | null;
  premium: false;
  owner_id: null;
}

/** Fallback only — every existing file already has a usable filename. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Blank strings are how "no value" is represented in the Keystatic files;
 * null is how it should be represented in Postgres. */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapListing(fileSlug: string, data: KeystaticListing): BusinessRow {
  return {
    // The filename is the real id Keystatic and the rest of this site key
    // off of — content.config.ts documents the JSON's own internal `slug`
    // field as unreliable (Keystatic doesn't keep it in sync), so it's
    // deliberately ignored here even on the files that still have it.
    slug: fileSlug || slugify(data.name),
    name: data.name,
    category: emptyToNull(data.category),
    neighborhood: emptyToNull(data.neighborhood),
    phone: emptyToNull(data.phone),
    website: data.website,
    description: emptyToNull(data.description),
    photo_url: emptyToNull(data.photo),
    hours: emptyToNull(data.hours),
    years_in_business: data.years_in_business ?? null,
    licensed_insured: Boolean(data.licensed_insured),
    address: emptyToNull(data.address),
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    google_rating: data.google_rating ?? null,
    google_review_count: data.google_review_count ?? null,
    premium: false,
    owner_id: null,
  };
}

function loadRows(): BusinessRow[] {
  const files = readdirSync(LISTINGS_DIR).filter((f) => f.endsWith('.json'));

  return files.map((file) => {
    const fileSlug = file.replace(/\.json$/, '');
    const raw = readFileSync(path.join(LISTINGS_DIR, file), 'utf-8');
    const data = JSON.parse(raw) as KeystaticListing;
    return mapListing(fileSlug, data);
  });
}

async function main() {
  const rows = loadRows();
  const isConfirmed = process.argv.includes('--confirm');

  console.log(`Found ${rows.length} businesses in src/content/listings/.\n`);
  console.log('Sample of mapped records (first 3):\n');
  for (const row of rows.slice(0, 3)) {
    console.log(JSON.stringify(row, null, 2));
  }

  if (!isConfirmed) {
    console.log(
      `\nDry run only — nothing was written to Supabase. Check the mapping ` +
        `above (all ${rows.length}, not just the sample, by editing this ` +
        `script to log the full array if you want to see every one), then ` +
        `run:\n\n  node scripts/migrate-to-supabase.ts --confirm\n\nto ` +
        `insert all ${rows.length} rows for real.`,
    );
    return;
  }

  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '\nMissing PUBLIC_SUPABASE_URL (.env) or SUPABASE_SERVICE_ROLE_KEY ' +
        '(.env.local) — set both before running with --confirm.',
    );
    process.exitCode = 1;
    return;
  }

  // service_role bypasses row-level security, which is exactly what a
  // one-time bulk-insert script needs (nothing is logged in yet to own
  // these rows) and exactly why this key must never reach the browser —
  // unlike the publishable key, it can read and write anything.
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const succeeded: string[] = [];
  const failed: { name: string; slug: string; error: string }[] = [];

  // One insert per row, not a single bulk insert of the whole array — a
  // bulk insert is one Postgres statement, so a single bad row (a
  // duplicate slug, for instance) would fail the entire batch with one
  // opaque error instead of reporting which specific businesses succeeded
  // and which didn't, which is what was asked for.
  for (const row of rows) {
    const { error } = await supabase.from('businesses').insert(row);
    if (error) {
      failed.push({ name: row.name, slug: row.slug, error: error.message });
    } else {
      succeeded.push(row.name);
    }
  }

  console.log(`\nInserted ${succeeded.length} of ${rows.length} businesses.`);

  if (failed.length > 0) {
    console.log(`\n${failed.length} failed:`);
    for (const f of failed) {
      console.log(`  - ${f.name} (${f.slug}): ${f.error}`);
    }
    process.exitCode = 1;
  }
}

main();
