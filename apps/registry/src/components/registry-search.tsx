'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CategoryBadge } from '@/components/category-badge';

/**
 * Search + filter across EVERY registry item.
 *
 * All 120 items ship in the page payload already (they're what the grid below
 * renders), so filtering is a plain client-side pass — no index, no API route,
 * no fetch. `⌘K` / `/` focuses the field, matching the convention every
 * registry site has trained users on.
 */

export type SearchItem = {
  name: string;
  title: string;
  description: string;
  categories?: string[];
  meta?: { tier: string };
};

type Props = {
  items: SearchItem[];
  /** [id, title] for the tier filter chips, in display order. */
  tiers: Array<[string, string]>;
};

const matches = (item: SearchItem, q: string) =>
  item.name.includes(q) ||
  item.title.toLowerCase().includes(q) ||
  item.description.toLowerCase().includes(q) ||
  (item.categories ?? []).some((c) => c.includes(q));

export function RegistrySearch({ items, tiers }: Props) {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typingElsewhere =
        event.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
      const isShortcut =
        (event.key === 'k' && (event.metaKey || event.ctrlKey)) ||
        (event.key === '/' && !typingElsewhere);
      if (!isShortcut) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!tier || item.meta?.tier === tier) && (!q || matches(item, q)),
    );
  }, [items, query, tier]);

  const filtering = query.trim().length > 0 || tier !== null;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="registry-search" className="sr-only">
            Search components
          </label>
          <input
            ref={inputRef}
            id="registry-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${items.length} components…`}
            className="border-border bg-card/40 focus-visible:border-primary/60 w-full rounded-lg border py-2.5 pl-4 pr-16 text-sm outline-none"
          />
          <kbd
            aria-hidden
            className="border-border text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[10px]"
          >
            ⌘K
          </kbd>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by layer">
          {tiers.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tier === id}
              onClick={() => setTier(tier === id ? null : id)}
              className={
                tier === id
                  ? 'border-primary/60 bg-primary/10 text-primary rounded-full border px-3 py-1 text-xs transition-colors'
                  : 'border-border bg-card/40 text-muted-foreground hover:text-foreground rounded-full border px-3 py-1 text-xs transition-colors'
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* The grid only renders while filtering — otherwise the categorised
          sections below are the better browse surface. */}
      {filtering ? (
        <div className="mt-6">
          <p aria-live="polite" className="text-muted-foreground text-sm">
            {results.length} match{results.length === 1 ? '' : 'es'}
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item) => (
              <li key={item.name}>
                <Link
                  href={`/c/${item.name}`}
                  className="border-border hover:border-primary/60 hover:bg-card flex h-full flex-col justify-between gap-3 rounded-lg border bg-card/40 p-4 transition-all"
                >
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-muted-foreground mt-1 font-mono text-xs">
                      @interlace/{item.name}
                    </p>
                  </div>
                  {item.categories?.[0] ? (
                    <div>
                      <CategoryBadge categoryId={item.categories[0]} />
                    </div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          {results.length === 0 ? (
            <p className="text-muted-foreground border-border mt-4 rounded-lg border border-dashed p-8 text-center text-sm">
              Nothing matches “{query}”
              {tier ? ' in that layer' : ''}. Try a category name — every item
              is tagged with one.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
