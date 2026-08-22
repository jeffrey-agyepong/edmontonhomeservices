import type { CollectionEntry } from 'astro:content';

export type Listing = CollectionEntry<'listings'>;
export type SortKey = 'top' | 'newest' | 'name';

export const SORTS: Record<SortKey, string> = {
  top: 'A–Z',
  newest: 'Newest',
  name: 'A–Z',
};

/**
 * Order listings.
 *
 * There's no independent rating data to rank by, so `top` and `name` both
 * sort alphabetically — the only honest ordering available without one.
 */
export function sortListings(items: Listing[], key: SortKey): Listing[] {
  const out = [...items];

  switch (key) {
    case 'newest':
      // Without dates from an API, id order is the closest honest proxy.
      return out.reverse();

    case 'top':
    case 'name':
    default:
      return out.sort((a, b) => a.data.name.localeCompare(b.data.name));
  }
}
