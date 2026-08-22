import { getCollection, type CollectionEntry } from 'astro:content';

export type Category = CollectionEntry<'categories'>;
export type Listing = CollectionEntry<'listings'>;

export interface PopulatedCategory {
  category: Category;
  listings: Listing[];
}

/**
 * Categories that have at least one listing, sorted the way the admin
 * ordered them (falling back to name). This is the single source every
 * homepage section (the "Explore by Category" teaser, the full per-category
 * grid, and the footer's category list) pulls from, so they can't drift out
 * of sync with each other the way a separately hardcoded list can.
 */
export async function getPopulatedCategories(): Promise<PopulatedCategory[]> {
  const [categories, listings] = await Promise.all([
    getCollection('categories'),
    getCollection('listings'),
  ]);

  return categories
    .map((category) => ({
      category,
      listings: listings.filter((l) => l.data.category === category.id),
    }))
    .filter((c) => c.listings.length > 0)
    .sort(
      (a, b) =>
        a.category.data.order - b.category.data.order ||
        a.category.data.name.localeCompare(b.category.data.name),
    );
}
