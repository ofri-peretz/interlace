'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { CategoryBadge } from '@/components/category-badge';
import {
  prepare,
  rank,
  substringFilter,
  type Ranked,
  type SearchIndex,
} from '@/lib/search';

/**
 * Search + filter across EVERY registry item.
 *
 * ## What changed and why
 *
 * This used to be `name.includes(q) || title.includes(q) || …` over the items
 * already in the page payload. That answers "where is Button" and nothing else:
 * every item's `description` is generated boilerplate, and a substring filter
 * has no notion of a better match, so "empty" returned 30 items in `readdir`
 * order.
 *
 * The vocabulary that makes this registry worth searching is semantic and it is
 * already written down — 220 KB of prose in the component headers, plus the
 * contract facts (state unions, RSC boundary, min-viewport, Base UI owner) that
 * no competing registry publishes at all. `scripts/build-agent-surface.mjs`
 * distils both into a generated `search-index.json`; `@/lib/search` ranks
 * against it. See that module for the alternatives weighed and rejected.
 *
 * ## Loading strategy
 *
 * The index is ~50 KB gzipped, so it is NOT in the page payload — it is fetched
 * on the first sign of intent (focus, keystroke, or the ⌘K shortcut). Until it
 * lands, the old substring filter runs against the server-rendered items, so
 * search is degraded for one round trip rather than broken. If the fetch fails
 * it stays on the fallback and says so; it never renders an empty box.
 *
 * ## Keyboard
 *
 * `⌘K` / `/` focus the field. `ArrowDown` steps from the field into the
 * results and then through them; `ArrowUp` steps back and returns to the field
 * from the first result. `Escape` clears the query and every filter and returns
 * focus to the field. `Enter` on a result opens it — the results are real
 * `<a>` elements, so that is the browser's job, not ours.
 *
 * No combobox ARIA: this is a text field and a list of links, and it is
 * announced as one. A `role="combobox"` with `aria-activedescendant` would be a
 * promise about focus semantics this component does not keep. See
 * `src/__tests__/search-keyboard.test.tsx` — the DS rule is that axe cannot
 * press a key, so the keyboard path is asserted by a test that does.
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

/** Ranked results shown at once. The tail of a long query is noise. */
const RESULT_LIMIT = 30;

type IndexState =
  | { status: 'idle' | 'loading' | 'failed'; index: null }
  | { status: 'ready'; index: SearchIndex };

/** A result row, normalised across the ranked and the fallback path. */
type Row = {
  name: string;
  title: string;
  blurb: string | null;
  categories: string[];
  tier: string | null;
  /** Contract facts worth showing on the card — never invented, always indexed. */
  badges: string[];
};

const CONTRACT_BADGES = new Set(['server', 'client', 'keyboard', 'loading']);

const rankedToRow = (r: Ranked): Row => ({
  name: r.item.name,
  title: r.item.title,
  blurb: r.item.blurb,
  categories: r.item.categories,
  tier: r.item.tier,
  badges: r.item.facets.filter((f) => CONTRACT_BADGES.has(f)),
});

const fallbackToRow = (item: SearchItem): Row => ({
  name: item.name,
  title: item.title,
  blurb: null,
  categories: item.categories ?? [],
  tier: item.meta?.tier ?? null,
  badges: [],
});

export function RegistrySearch({ items, tiers }: Props) {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<string | null>(null);
  const [state, setState] = useState<IndexState>({ status: 'idle', index: null });
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);

  // Fetch once, on the first sign that someone intends to search. `idle` is the
  // only state that starts a request, so focusing the field twice does not.
  const loadIndex = useCallback(() => {
    setState((current) => {
      if (current.status !== 'idle') return current;
      void fetch('/data/search-index.json')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((index: SearchIndex) => setState({ status: 'ready', index }))
        .catch(() => setState({ status: 'failed', index: null }));
      return { status: 'loading', index: null };
    });
  }, []);

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
      loadIndex();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loadIndex]);

  // `prepare` tokenises every item once per index, not once per keystroke.
  const prepared = useMemo(
    () => (state.status === 'ready' ? prepare(state.index) : null),
    [state],
  );

  const trimmed = query.trim();

  const rows = useMemo((): Row[] => {
    const inTier = (t: string | null) => !tier || t === tier;
    if (state.status === 'ready' && prepared) {
      if (!trimmed) {
        return state.index.items.filter((i) => inTier(i.tier)).map((item) =>
          rankedToRow({ item, score: 0, matches: [] }),
        );
      }
      return rank(state.index, prepared, trimmed)
        .filter((r) => inTier(r.item.tier))
        .slice(0, RESULT_LIMIT)
        .map(rankedToRow);
    }
    return substringFilter(items, trimmed)
      .filter((item) => inTier(item.meta?.tier ?? null))
      .map(fallbackToRow);
  }, [items, prepared, state, tier, trimmed]);

  const filtering = trimmed.length > 0 || tier !== null;

  const reset = () => {
    setQuery('');
    setTier(null);
    inputRef.current?.focus();
  };

  /** Roving focus between the field and the result links. */
  const moveFocus = (from: number, delta: number) => {
    const links = resultsRef.current?.querySelectorAll<HTMLAnchorElement>(
      'a[data-search-result]',
    );
    if (!links || links.length === 0) return;
    const next = from + delta;
    if (next < 0) {
      inputRef.current?.focus();
      return;
    }
    links[Math.min(next, links.length - 1)]?.focus();
  };

  const onFieldKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      reset();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(-1, 1);
    }
  };

  const onResultKeyDown =
    (position: number) => (event: ReactKeyboardEvent<HTMLAnchorElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveFocus(position, 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveFocus(position, -1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        reset();
      }
    };

  const status = !filtering
    ? ''
    : `${rows.length} match${rows.length === 1 ? '' : 'es'}` +
      (state.status === 'ready' && trimmed ? ', best first' : '') +
      (state.status === 'loading' && trimmed ? ' — refining…' : '');

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
            onFocus={loadIndex}
            onChange={(event) => {
              loadIndex();
              setQuery(event.target.value);
            }}
            onKeyDown={onFieldKeyDown}
            aria-describedby="registry-search-hint"
            placeholder={`Search ${items.length} components — try “a metric that was never measured”`}
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

      <p id="registry-search-hint" className="text-muted-foreground mt-2 text-xs">
        Search matches the words each component’s own source says about itself —
        its states, its keyboard path, and whether it renders on the server — not
        just its name. Press{' '}
        <kbd className="border-border rounded border px-1 font-mono text-[10px]">
          ⌘K
        </kbd>{' '}
        or <kbd className="border-border rounded border px-1 font-mono text-[10px]">/</kbd>{' '}
        to focus, <kbd className="border-border rounded border px-1 font-mono text-[10px]">↓</kbd>{' '}
        to step into results,{' '}
        <kbd className="border-border rounded border px-1 font-mono text-[10px]">Esc</kbd>{' '}
        to clear.
      </p>

      {/* The grid only renders while filtering — otherwise the categorised
          sections below are the better browse surface. */}
      {filtering ? (
        <div className="mt-6">
          <p role="status" aria-live="polite" className="text-muted-foreground text-sm">
            {status}
          </p>
          <ul
            ref={resultsRef}
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {rows.map((row, position) => (
              <li key={row.name}>
                <Link
                  href={`/c/${row.name}`}
                  data-search-result=""
                  onKeyDown={onResultKeyDown(position)}
                  className="border-border hover:border-primary/60 hover:bg-card focus-visible:border-primary/60 flex h-full flex-col justify-between gap-3 rounded-lg border bg-card/40 p-4 transition-all"
                >
                  <div>
                    <h3 className="font-semibold">{row.title}</h3>
                    <p className="text-muted-foreground mt-1 font-mono text-xs">
                      @interlace/{row.name}
                    </p>
                    {row.blurb ? (
                      <p className="text-muted-foreground mt-2 line-clamp-3 text-xs">
                        {row.blurb}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.categories[0] ? (
                      <CategoryBadge categoryId={row.categories[0]} />
                    ) : null}
                    {row.badges.map((badge) => (
                      <span
                        key={badge}
                        className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[10px]"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {rows.length === 0 ? (
            <p className="text-muted-foreground border-border mt-4 rounded-lg border border-dashed p-8 text-center text-sm">
              Nothing matches “{query}”
              {tier ? ' in that layer' : ''}. Describe what the component has to
              do — “keyboard menu”, “empty list”, “render on the server” — or try
              a category name.
              {state.status === 'failed' ? (
                <>
                  {' '}
                  <span className="block pt-2">
                    (Relevance ranking could not load, so this is a name-only
                    match.)
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
