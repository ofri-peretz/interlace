/**
 * Ranked search over the registry, in ~120 lines and zero dependencies.
 *
 * ## The problem this replaces
 *
 * The old filter was `name.includes(q) || title.includes(q) || description…`
 * over the items already in the page payload. Two things made it useless for
 * anything but recall of a name you already knew:
 *
 *   1. Every item's `description` is generated boilerplate — `"@interlace/ui —
 *      data-state (shadcn-compatible)."` for 100+ of them. There was almost no
 *      text to match against.
 *   2. A substring filter has no notion of *better*. "empty" matched 30 items
 *      in whatever order `readdir` happened to produce.
 *
 * Our strongest vocabulary is semantic and it already exists: 220 KB of prose
 * in the source headers ("a run that returned zero and a run that never
 * happened must not look the same"), plus the contract facts nobody else
 * publishes. `scripts/build-agent-surface.mjs` distils that into
 * `public/data/search-index.json` — a tf-idf-ranked term list per item, a
 * document-frequency table, and the stopword list it used. This module ranks
 * against it.
 *
 * ## Why tf-idf-into-a-generated-index, and not the alternatives
 *
 *   - **A hosted service (Algolia/Orama Cloud)** — a network dependency, an
 *     API key, and a second copy of the catalogue that can silently fall out of
 *     date. The site is otherwise entirely static.
 *   - **A client-side engine (FlexSearch/MiniSearch/Fuse)** — 8–30 KB of
 *     JavaScript to build, at page load, an index we can compute once at build
 *     time. Fuse's fuzzy matching also actively hurts here: on a catalogue of
 *     137 short names, edit-distance matching produces confident nonsense.
 *   - **Hand-authored `keywords` per item** — the tempting option, and the one
 *     that rots. 137 items × someone remembering to add keywords is a list that
 *     is wrong within a month, and it re-authors information the component's
 *     own header already states.
 *
 * So: build-time extraction, generated index, runtime scoring. The index is
 * fetched lazily on first interaction (~50 KB gzipped), and until it lands the
 * component falls back to the old substring filter over the server-rendered
 * items — so search is never *broken*, only briefly less good.
 *
 * ## Scoring
 *
 * Per query term, the best field it hits scores it, weighted by idf so a rare
 * word ("hatch", "unmeasured") beats a common one ("card"). Fields, in order:
 *
 *   name/title (8) > blurb (5) = contract facets (5) > header prose (3)
 *
 * "Contract facets" is the part no competitor could implement: an item's
 * rendering boundary, min-viewport, loading opt-in, Base UI owner and **state
 * union values** are all indexed as searchable vocabulary, so "measured"
 * reaches the components whose state union contains `first-measurement`.
 *
 * Coverage (how many of the query's terms matched at all) multiplies the score
 * on a square root, not linearly: a nine-word natural-language question can
 * only ever match a few terms, and a linear penalty buried every long query
 * under one-word noise.
 */

export type SearchIndexItem = {
  name: string;
  title: string;
  blurb: string;
  tier: string | null;
  categories: string[];
  facets: string[];
  /** Space-joined stems — the item's top tf-idf terms. */
  terms: string;
};

export type SearchIndex = {
  schemaVersion: string;
  docs: number;
  stopwords: string[];
  df: Record<string, number>;
  items: SearchIndexItem[];
};

/**
 * Suffix-stripping stemmer. Its whole job is to make "measure" / "measured" /
 * "measuring" / "measurement" collide, so "a metric that might not have been
 * measured" reaches the component whose state union says `first-measurement`.
 *
 * MUST stay byte-identical in behaviour to `stem` in
 * `scripts/build-agent-surface.mjs`, which stems the index. A drift between the
 * two is silent — queries would simply stop matching — so
 * `src/__tests__/search-ranking.test.ts` asserts the two agree on a word list
 * that exercises every branch.
 */
export const stem = (word: string): string => {
  let w = word.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (
    w.endsWith('s') &&
    !w.endsWith('ss') &&
    !w.endsWith('us') &&
    !w.endsWith('is')
  )
    w = w.slice(0, -1);
  if (w.endsWith('ment') && w.length > 6) w = w.slice(0, -4);
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('edly') && w.length > 6) w = w.slice(0, -4);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  if (w.endsWith('ly') && w.length > 4) w = w.slice(0, -2);
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1);
  return w;
};

/** Split on anything that isn't a letter or digit, then stem. */
export const splitStems = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem)
    .filter((t) => t.length > 2);

/** Which field a term hit — surfaced in the UI so a match is explainable. */
export type MatchField = 'name' | 'blurb' | 'contract' | 'docs';

export type Ranked = {
  item: SearchIndexItem;
  score: number;
  /** Query stems that matched, with the field that scored them. */
  matches: Array<{ term: string; field: MatchField }>;
};

type Prepared = {
  item: SearchIndexItem;
  ident: Set<string>;
  blurb: Set<string>;
  contract: Set<string>;
  docs: Set<string>;
  haystack: string;
  /**
   * True when every file this item installs is a `.ts` module rather than a
   * `.tsx` component — `meter-scale`, `data-state-model`, `button-variants`.
   * They are real installable items and stay searchable, but "a component for
   * showing X" is answered by the component, so they are demoted rather than
   * hidden. Derived from the item name's suffix convention because the search
   * index deliberately does not carry file lists.
   */
  companion: boolean;
};

const COMPANION_SUFFIX = /-(variants|model|scale)$/;

const FIELD_WEIGHT: Record<MatchField, number> = {
  name: 8,
  blurb: 5,
  contract: 5,
  docs: 3,
};

/** Long-tail queries can never match many terms — penalise on a square root. */
const coverageFactor = (matched: number, total: number) =>
  total === 0 ? 1 : 0.3 + 0.7 * Math.sqrt(matched / total);

const COMPANION_PENALTY = 0.75;

export const prepare = (index: SearchIndex): Prepared[] =>
  index.items.map((item) => ({
    item,
    ident: new Set(splitStems(`${item.name.replace(/-/g, ' ')} ${item.title}`)),
    blurb: new Set(splitStems(item.blurb)),
    // Facet values are compound (`first-measurement`, `min-viewport-320`,
    // `not-counted`); splitting them is the whole point — the state union is
    // where the vocabulary a visitor types actually lives.
    contract: new Set(
      splitStems(
        [...item.facets, ...item.categories, item.tier ?? ''].join(' '),
      ),
    ),
    docs: new Set(item.terms.split(' ').filter(Boolean)),
    haystack: `${item.name} ${item.title} ${item.blurb}`.toLowerCase(),
    companion: COMPANION_SUFFIX.test(item.name),
  }));

export const queryStems = (index: SearchIndex, raw: string): string[] => {
  const stop = new Set(index.stopwords);
  return [...new Set(splitStems(raw))].filter((t) => !stop.has(t));
};

/**
 * Rank every item against `raw`. Returns only items that matched something,
 * best first; ties break on name so the order is stable between renders.
 */
export const rank = (
  index: SearchIndex,
  prepared: Prepared[],
  raw: string,
): Ranked[] => {
  const literal = raw.trim().toLowerCase();
  if (!literal) return [];
  const terms = queryStems(index, raw);
  // log(1 + N/(df+1)): a stem in one item scores ~4.9, one in half the
  // catalogue ~1.1, and an unknown stem still gets a non-zero floor.
  const idf = (t: string) => Math.log(1 + index.docs / ((index.df[t] ?? 0) + 1));

  const out: Ranked[] = [];
  for (const p of prepared) {
    let score = 0;
    const matches: Ranked['matches'] = [];
    for (const term of terms) {
      const field: MatchField | null = p.ident.has(term)
        ? 'name'
        : p.blurb.has(term)
          ? 'blurb'
          : p.contract.has(term)
            ? 'contract'
            : p.docs.has(term)
              ? 'docs'
              : null;
      if (!field) continue;
      score += FIELD_WEIGHT[field] * idf(term);
      matches.push({ term, field });
    }

    // Literal bonuses, so typing a name you already know still behaves like a
    // filter: exact name wins outright, a prefix beats a mid-string hit, and a
    // partial word ("accord") finds the item before the stemmer has anything
    // useful to say about it.
    let bonus = 0;
    if (literal === p.item.name || literal === p.item.title.toLowerCase()) {
      bonus = 80;
    } else if (
      p.item.name.startsWith(literal) ||
      p.item.title.toLowerCase().startsWith(literal)
    ) {
      bonus = (30 * literal.length) / Math.max(p.item.name.length, literal.length);
    } else if (literal.length > 2 && p.haystack.includes(literal)) {
      bonus = 20;
    }

    if (score === 0 && bonus === 0) continue;
    const total =
      (score * coverageFactor(matches.length, terms.length) + bonus) *
      (p.companion ? COMPANION_PENALTY : 1);
    out.push({ item: p.item, score: total, matches });
  }

  out.sort(
    (a, b) => b.score - a.score || (a.item.name < b.item.name ? -1 : 1),
  );
  return out;
};

/**
 * The fallback while `search-index.json` is still in flight (and if it never
 * arrives): the original substring filter over the server-rendered items. Worse
 * than the ranker, but instant and never wrong — search is degraded, not broken.
 */
export const substringFilter = <T extends { name: string; title: string; description: string; categories?: string[] }>(
  items: T[],
  raw: string,
): T[] => {
  const q = raw.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.name.includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.categories ?? []).some((c) => c.includes(q)),
  );
};
