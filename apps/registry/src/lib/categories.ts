/**
 * Category definitions for the registry index.
 *
 * The ASSIGNMENT of a component to a category is NOT here — it lives in
 * `registry-categories.json`, which `scripts/build-registry.mjs` reads to
 * stamp a `categories` array onto every emitted registry item. This module
 * only supplies the human-readable titles/descriptions and reads the same
 * file, so the site and the published JSON can never disagree.
 *
 * Two axes, both present in an item's `categories` array:
 *   - intent ("what am I trying to do") — form / overlay / marketing / …
 *   - tier   ("which layer of the DS")  — primitive / pattern / template / …
 */

import data from '../../registry-categories.json';

export type Category = {
  id: string;
  title: string;
  description: string;
};

/** Intent categories, in display order. */
export const CATEGORIES: Category[] = data.categories;

/** Tier categories (the 5-layer DS architecture), in display order. */
export const TIER_CATEGORIES: Category[] = data.tierCategories;

const ALL = [...CATEGORIES, ...TIER_CATEGORIES];
const BY_ID = new Map(ALL.map((c) => [c.id, c]));

export const categoryById = (id: string): Category | undefined => BY_ID.get(id);

const TIER_IDS = new Set(TIER_CATEGORIES.map((c) => c.id));

/** The intent category of an item, from its published `categories` array. */
export function intentCategoryOf(item: { categories?: string[] }): string {
  return item.categories?.find((c) => !TIER_IDS.has(c)) ?? 'other';
}

/** The DS-layer category of an item, from its published `categories` array. */
export function tierCategoryOf(item: { categories?: string[] }): string | null {
  return item.categories?.find((c) => TIER_IDS.has(c)) ?? null;
}

export function groupByCategory<T extends { name: string; categories?: string[] }>(
  items: T[],
  axis: 'intent' | 'tier' = 'intent',
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const c of axis === 'intent' ? CATEGORIES : TIER_CATEGORIES) {
    groups.set(c.id, []);
  }
  for (const item of items) {
    const id = axis === 'intent' ? intentCategoryOf(item) : tierCategoryOf(item);
    if (id) groups.get(id)?.push(item);
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}
