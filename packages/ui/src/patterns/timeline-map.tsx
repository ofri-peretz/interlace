'use client';

import * as React from 'react';

import { cn } from '../lib/cn.js';

/**
 * TimelineMap — dated entities as linked dots on a shared time axis, one
 * labeled strip per category lane.
 *
 * ## RFC (R3)
 *
 * Generalized from the blog's corpus map (100/100 Lighthouse accessibility
 * + agentic on the live site), born complete with the two rungs the app
 * version lacked: roving-tabindex arrow traversal and a controlled
 * category filter. Travel signal (R2): HIGH — proven on the blog's article
 * corpus; the docs site can map releases/changelog; anything with dated,
 * linkable entities fits.
 *
 * ### Anatomy (R11 — compound, one memoized context R15)
 *
 *   <TimelineMap items={…} data-testid="…">
 *     <TimelineMap.Filter />          — optional category chips (aria-pressed)
 *     <TimelineMap.Chart />           — axis header + lanes + dots
 *     <TimelineMap.Detail />          — fixed-height preview strip (CLS=0, R23)
 *   </TimelineMap>
 *
 * ### Keyboard (R26)
 *
 * | Key            | Action                                              |
 * | -------------- | --------------------------------------------------- |
 * | Tab            | One stop: the current dot (roving tabindex)         |
 * | → / ←          | Next / previous dot in chronological order          |
 * | Home / End     | First / last visible dot                            |
 * | Enter          | Activate the dot's link (native anchor)             |
 *
 * The app version made every dot a tab stop (89 stops on the blog corpus —
 * hostile). Roving tabindex per APG: one stop, arrows traverse.
 *
 * ### API parity (R17)
 *
 * - `onItemClick(item)` mirrors MUI DataGrid's `onRowClick`: the anchor is
 *   an internal part, so the DS surfaces its activation; navigation itself
 *   stays native.
 * - `filter` + `defaultFilter` + `onFilterChange` follow the MUI/shadcn
 *   controlled+uncontrolled convention (R14). URL-state wiring is the
 *   consumer's job — the DS never touches routers.
 * - `linkComponent` (R10 `xxxComponent`) injects a framework Link; default
 *   is a plain anchor.
 *
 * ### Encoding contract
 *
 * x = the shared continuous axis — dates by default, or any numeric
 * measure via `axis={{ kind: "number", format }}` (reading minutes,
 * bundle KB): a landscape of category × whatever quantity the corpus
 * is actually navigated by. Row = category, dot diameter = optional
 * `weight` (0..1 → 10–16px; the Detail strip must spell the value out —
 * size is never the only carrier). Marks are single-hue `strand-a` (R19
 * token): identity is carried spatially by labeled lanes, so no
 * multi-hue palette is needed and none is offered.
 *
 * Same-(lane, day) groups fan into a center-first 3-row beeswarm (a solo
 * dot sits centered; burst rows cap radius for lane-border clearance) —
 * without the fan, 43 of the blog's 89 dots were perfectly stacked.
 *
 * Static markup is SSR-honest: every item renders as a real anchor with
 * its accessible name; no floating tooltip (the Detail strip reserves its
 * height).
 *
 * ### Fit-all width
 *
 * The strip stretches to fill the container (ResizeObserver), so the
 * WHOLE territory — every item — is visible at once whenever space
 * allows. 560px is the floor: below it the strip keeps its size and
 * scrolls internally, resting at the recent end (state, not motion —
 * reduced-motion safe). SSR renders honestly at the floor.
 *
 * ### The link weave
 *
 * `item.links` declares the corpus's internal reference graph, drawn as
 * strand-b threads between dots — the map shows not just WHEN and WHERE
 * things were published but how they weave into each other (the division
 * has an agenda; the threads make it legible). Interaction grammar from
 * the engage network graph: at rest the web is faint; touching a dot
 * (hover or keyboard focus — both set `previewed`) lights ITS threads
 * and recedes everything unrelated. State changes are instant — the
 * motion vocabulary stays draw/decode. The overlay is aria-hidden; the
 * Detail strip speaks the same links ("weaves into …") for screen
 * readers and crawlers.
 */

export interface TimelineMapItem {
  /** Stable identity — used for roving focus and React keys. */
  id: string;
  /** Destination when the dot is activated. */
  href: string;
  /** Accessible/visible name of the entity. */
  label: string;
  /**
   * Lane the item belongs to. `null`/`undefined` items share the
   * `uncategorizedLabel` lane.
   */
  category?: string | null;
  /**
   * ISO `yyyy-mm-dd` — drives x in the default date axis. Items without
   * a parseable date are not rendered there. Ignored by a number axis.
   */
  date?: string;
  /**
   * Numeric position for `axis={{ kind: "number" }}` (reading minutes,
   * bundle KB, …). Items without a finite value are not rendered there.
   * Ignored by the date axis.
   */
  value?: number;
  /**
   * Optional normalized magnitude (0..1) encoded as dot diameter
   * (10–16px). The Detail strip should restate it — size is never the
   * only carrier.
   * @default 0
   */
  weight?: number;
  /**
   * Ids of items this one references — the corpus's internal link graph,
   * drawn as strand-b threads between dots (see "The link weave" above).
   * Unknown and self ids are ignored.
   */
  links?: readonly string[];
}

/**
 * Which continuous quantity the shared axis encodes. The lanes × axis
 * geometry, the weave, and every interaction are identical either way —
 * only the x scale, the ticks, and how an item's position is spoken
 * (aria-label, Detail strip) change.
 */
export interface TimelineMapAxis {
  /** "date" (default): `item.date` drives x. "number": `item.value`. */
  kind: 'date' | 'number';
  /**
   * number kind only: renders a value for ticks, aria names, and the
   * Detail strip — e.g. `(v) => `${v} min``.
   * @default String
   */
  format?: (value: number) => string;
}

export interface TimelineMapProps
  extends Omit<React.ComponentPropsWithoutRef<'figure'>, 'onClick'> {
  items: readonly TimelineMapItem[];
  /** Stable selector for E2E tests; consumer provides — no default (R5). */
  'data-testid': string;
  /**
   * Axis semantics — see TimelineMapAxis. Pass a stable object (module
   * constant or memo): the layout recomputes when its identity changes.
   * @default { kind: "date" }
   */
  axis?: TimelineMapAxis;
  /**
   * Lane label for items without a category.
   * @default "Other"
   */
  uncategorizedLabel?: string;
  /** Controlled set of visible categories (R14). Omit for uncontrolled. */
  filter?: readonly string[];
  /** Uncontrolled initial visible categories. @default all categories */
  defaultFilter?: readonly string[];
  /** Fires with the next visible-category set when a chip is toggled. */
  onFilterChange?: (categories: string[]) => void;
  /** Fires when a dot gains hover/focus (drives the Detail strip too). */
  onItemPreview?: (item: TimelineMapItem) => void;
  /** Fires on dot activation, alongside native navigation. */
  onItemClick?: (item: TimelineMapItem) => void;
  /** Framework link injected for dot anchors (R10). @default "a" */
  linkComponent?: React.ElementType;
  children: React.ReactNode;
}

const STRIP_W = 560; // floor width, rendered 1:1 — viewBox units ARE pixels
const LABEL_W = 160; // the 10rem sticky label column (grid-cols below)
const LANE_H = 44;
const DOT_ROWS = [0, -13, 13] as const; // center-first beeswarm fan

interface Dot {
  item: TimelineMapItem;
  cx: number;
  cy: number;
  r: number;
}

interface Edge {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Layout {
  lanes: { name: string; count: number; dots: Dot[] }[];
  ticks: { x: number; label: string }[];
  /** All visible dots in chronological order — the traversal order. */
  order: TimelineMapItem[];
  /** Internal link graph in overlay coordinates (y spans the lane stack). */
  edges: Edge[];
}

/** Threads between dots, in lane-stack coordinates. Unknown/self targets drop. */
function computeEdges(lanes: Layout['lanes']): Edge[] {
  const pos = new Map<string, { x: number; y: number }>();
  lanes.forEach((lane, li) => {
    for (const d of lane.dots)
      pos.set(d.item.id, { x: d.cx, y: li * LANE_H + d.cy });
  });
  const edges: Edge[] = [];
  // Mutual citations (a→b AND b→a) must render as ONE thread — two paths
  // on the same geometry double the visual weight (caught in review).
  const seen = new Set<string>();
  for (const lane of lanes) {
    for (const d of lane.dots) {
      for (const target of d.item.links ?? []) {
        const from = pos.get(d.item.id);
        const to = pos.get(target);
        if (!from || !to || target === d.item.id) continue;
        const pairKey = [d.item.id, target].sort().join('→');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        edges.push({ from: d.item.id, to: target, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
      }
    }
  }
  return edges;
}

/**
 * Pure layout: lanes (by descending count, uncategorized last), quarter
 * ticks with labeled-endpoint fallback, center-first beeswarm fan.
 * Exported for tests — geometry invariants are locked without a DOM.
 */
export function computeTimelineLayout(
  items: readonly TimelineMapItem[],
  uncategorizedLabel: string,
  stripWidth: number = STRIP_W,
  axis: TimelineMapAxis = { kind: 'date' },
): Layout {
  const dated = (
    axis.kind === 'number'
      ? items.map((i) => ({ item: i, t: i.value ?? NaN }))
      : items
          .filter((i) => /^\d{4}-\d{2}-\d{2}/.test(i.date ?? ''))
          .map((i) => ({
            item: i,
            t: Date.parse(`${i.date!.slice(0, 10)}T00:00:00Z`),
          }))
  )
    .filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t || a.item.id.localeCompare(b.item.id));
  if (dated.length === 0) return { lanes: [], ticks: [], order: [], edges: [] };

  const min = dated[0].t;
  // Not .at(-1): its `T | undefined` forces a non-null assertion even
  // though the empty case returned above. Length-index keeps tsc honest.
  const max = dated[dated.length - 1].t;
  const span = Math.max(max - min, 1);
  const x = (t: number): number => 14 + ((t - min) / span) * (stripWidth - 46);

  const laneNames = new Map<string, number>();
  for (const { item } of dated) {
    const key = item.category ?? uncategorizedLabel;
    laneNames.set(key, (laneNames.get(key) ?? 0) + 1);
  }
  const ordered = [...laneNames.entries()]
    .sort((a, b) =>
      a[0] === uncategorizedLabel
        ? 1
        : b[0] === uncategorizedLabel
          ? -1
          : b[1] - a[1],
    )
    .map(([name, count]) => ({ name, count, dots: [] as Dot[] }));
  const byName = new Map(ordered.map((l) => [l.name, l]));

  const bursts = new Map<string, number>();
  for (const { item, t } of dated) {
    const laneName = item.category ?? uncategorizedLabel;
    // Same-(lane, position) collisions fan into the beeswarm. On the date
    // axis position = day; on a number axis = the exact value (integer
    // minutes/KB collide constantly — the fan is what keeps them legible).
    const key = `${laneName}|${t}`;
    const n = bursts.get(key) ?? 0;
    bursts.set(key, n + 1);
    const dy = DOT_ROWS[n % 3];
    const rBase = 5 + Math.min(Math.max(item.weight ?? 0, 0), 1) * 3;
    byName.get(laneName)?.dots.push({
      item,
      cx: x(t) + Math.floor(n / 3) * 10,
      cy: LANE_H / 2 + dy,
      r: dy === 0 ? rBase : Math.min(rBase, 6),
    });
  }

  if (axis.kind === 'number') {
    return {
      lanes: ordered,
      ticks: numberTicks(min, max, x, axis.format ?? String),
      order: dated.map((d) => d.item),
      edges: computeEdges(ordered),
    };
  }

  // Quarter-start ticks; a span too narrow for one falls back to labeled
  // endpoints so the axis is never empty.
  const ticks: Layout['ticks'] = [];
  const start = new Date(min);
  let year = start.getUTCFullYear();
  let quarter = (Math.ceil((start.getUTCMonth() + 1) / 3) * 3) % 12;
  for (let guard = 0; guard < 40; guard++) {
    if (quarter === 0) year += 1;
    const t = Date.UTC(year, quarter, 1);
    if (t > max) break;
    if (t >= min) {
      ticks.push({
        x: x(t),
        label:
          quarter === 0
            ? String(year)
            : new Date(t).toLocaleDateString('en-US', {
                month: 'short',
                timeZone: 'UTC',
              }),
      });
    }
    quarter = (quarter + 3) % 12;
  }
  const fmtEndpoint = (t: number): string =>
    new Date(t).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  if (ticks.length === 0) {
    ticks.push(
      { x: x(min), label: fmtEndpoint(min) },
      { x: x(max), label: fmtEndpoint(max) },
    );
  }

  return {
    lanes: ordered,
    ticks,
    order: dated.map((d) => d.item),
    edges: computeEdges(ordered),
  };
}

/**
 * Nice-step ticks for a number axis: a 1/2/5×10ⁿ step sized for ~5
 * ticks, snapped to multiples so labels read as round values. Degenerate
 * spans (all items share one value) fall back to that single labeled
 * point so the axis is never empty.
 */
function numberTicks(
  min: number,
  max: number,
  x: (v: number) => number,
  format: (v: number) => string,
): Layout['ticks'] {
  if (max === min) return [{ x: x(min), label: format(min) }];
  const raw = (max - min) / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const ticks: Layout['ticks'] = [];
  for (
    let v = Math.ceil(min / step) * step;
    v <= max;
    v = Math.round((v + step) * 1e9) / 1e9 // float-drift guard
  ) {
    ticks.push({ x: x(v), label: format(v) });
  }
  return ticks.length > 0
    ? ticks
    : [
        { x: x(min), label: format(min) },
        { x: x(max), label: format(max) },
      ];
}

interface TimelineMapContextValue {
  layout: Layout;
  /** Current strip width in px — 560 floor, stretched to the container. */
  stripWidth: number;
  /** Chart reports its measured container width here (fit-all). */
  setStripWidth: (w: number) => void;
  visible: (item: TimelineMapItem) => boolean;
  categories: { name: string; count: number }[];
  activeFilter: readonly string[];
  toggleCategory: (name: string) => void;
  previewed: TimelineMapItem | null;
  preview: (item: TimelineMapItem) => void;
  /**
   * How an item's axis position is spoken — the date, or the formatted
   * value on a number axis. One voice for aria-labels and the Detail
   * strip, so the two can never disagree.
   */
  meta: (item: TimelineMapItem) => string | undefined;
  focusedId: string | null;
  moveFocus: (from: string, delta: 'next' | 'prev' | 'first' | 'last') => void;
  onItemClick?: (item: TimelineMapItem) => void;
  LinkComponent: React.ElementType;
  testId: string;
}

// One context for the whole pattern (R15) — value memoized below.
const TimelineMapContext =
  React.createContext<TimelineMapContextValue | null>(null);

function useTimelineMap(part: string): TimelineMapContextValue {
  const ctx = React.useContext(TimelineMapContext);
  if (!ctx) {
    throw new Error(`TimelineMap.${part} must be used inside <TimelineMap>`);
  }
  return ctx;
}

export function TimelineMap({
  items,
  'data-testid': testId,
  uncategorizedLabel = 'Other',
  axis,
  filter,
  defaultFilter,
  onFilterChange,
  onItemPreview,
  onItemClick,
  linkComponent = 'a',
  className,
  children,
  ...rest
}: TimelineMapProps) {
  // Fit-all: the Chart measures its container and widens the strip so the
  // WHOLE territory is visible when space allows; 560 is the floor below
  // which the strip scrolls instead (dots need room to stay legible).
  const [stripWidth, setStripWidth] = React.useState(STRIP_W);
  const layout = React.useMemo(
    () => computeTimelineLayout(items, uncategorizedLabel, stripWidth, axis),
    [items, uncategorizedLabel, stripWidth, axis],
  );
  const categories = React.useMemo(
    () => layout.lanes.map(({ name, count }) => ({ name, count })),
    [layout],
  );

  // Controlled + uncontrolled filter (R14).
  const [internalFilter, setInternalFilter] = React.useState<
    readonly string[] | null
  >(defaultFilter ?? null);
  const activeFilter =
    filter ?? internalFilter ?? categories.map((c) => c.name);

  const [previewed, setPreviewed] = React.useState<TimelineMapItem | null>(
    null,
  );
  const [focusedId, setFocusedId] = React.useState<string | null>(null);

  const value = React.useMemo<TimelineMapContextValue>(() => {
    const visibleSet = new Set(activeFilter);
    const visible = (item: TimelineMapItem): boolean =>
      visibleSet.has(item.category ?? uncategorizedLabel);
    const visibleOrder = layout.order.filter(visible);
    return {
      layout,
      stripWidth,
      setStripWidth,
      visible,
      categories,
      activeFilter,
      toggleCategory: (name) => {
        const next = visibleSet.has(name)
          ? activeFilter.filter((c) => c !== name)
          : [...activeFilter, name];
        if (filter === undefined) setInternalFilter(next);
        onFilterChange?.(next);
      },
      previewed,
      preview: (item) => {
        setPreviewed(item);
        onItemPreview?.(item);
      },
      // Every item reaching meta came out of the layout, which already
      // filtered non-finite values (number) / unparseable dates (date) —
      // the assertion documents that invariant instead of dead-branching.
      meta: (item) =>
        axis?.kind === 'number'
          ? (axis.format ?? String)(item.value!)
          : item.date,
      // Not a bare ??: when the focused item's lane gets filtered OUT, a
      // stale focusedId would leave every dot at tabIndex=-1 and the chart
      // unreachable by keyboard (a focus trap, caught in blog review).
      // Any focus id outside visibleOrder falls back to the recent end.
      focusedId:
        focusedId !== null && visibleOrder.some((i) => i.id === focusedId)
          ? focusedId
          : (visibleOrder.at(-1)?.id ?? null),
      moveFocus: (from, delta) => {
        if (visibleOrder.length === 0) return;
        const at = visibleOrder.findIndex((i) => i.id === from);
        const next =
          delta === 'first'
            ? 0
            : delta === 'last'
              ? visibleOrder.length - 1
              : Math.min(
                  Math.max(at + (delta === 'next' ? 1 : -1), 0),
                  visibleOrder.length - 1,
                );
        setFocusedId(visibleOrder[next].id);
      },
      onItemClick,
      LinkComponent: linkComponent,
      testId,
    };
  }, [
    layout,
    stripWidth,
    categories,
    activeFilter,
    uncategorizedLabel,
    axis,
    filter,
    onFilterChange,
    previewed,
    onItemPreview,
    focusedId,
    onItemClick,
    linkComponent,
    testId,
  ]);

  return (
    <TimelineMapContext.Provider value={value}>
      <figure
        data-slot="timeline-map"
        data-testid={testId}
        className={cn(
          'rounded-lg border border-border bg-card p-4',
          className,
        )}
        {...rest}
      >
        {children}
      </figure>
    </TimelineMapContext.Provider>
  );
}

/** Optional category chips — toggle buttons, `aria-pressed`, count badges. */
export interface TimelineMapFilterProps
  extends React.ComponentPropsWithoutRef<'div'> {}

function TimelineMapFilter({ className, ...rest }: TimelineMapFilterProps) {
  const { categories, activeFilter, toggleCategory, testId } =
    useTimelineMap('Filter');
  const active = new Set(activeFilter);
  return (
    <div
      data-slot="timeline-map-filter"
      data-testid={`${testId}-filter`}
      role="group"
      aria-label="Filter by category"
      className={cn('mb-3 flex flex-wrap gap-1.5', className)}
      {...rest}
    >
      {categories.map(({ name, count }) => (
        <button
          key={name}
          type="button"
          aria-pressed={active.has(name)}
          onClick={() => toggleCategory(name)}
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
            active.has(name)
              ? 'border-strand-a/50 bg-strand-a/10 text-foreground'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {name}
          <span className="ml-1 text-muted-foreground">{count}</span>
        </button>
      ))}
    </div>
  );
}

/** The chart: sticky lane labels, shared time axis, dot strips. */
export interface TimelineMapChartProps
  extends React.ComponentPropsWithoutRef<'div'> {}

function TimelineMapChart({ className, ...rest }: TimelineMapChartProps) {
  const {
    layout,
    stripWidth,
    setStripWidth,
    visible,
    preview,
    previewed,
    focusedId,
    moveFocus,
    onItemClick,
    LinkComponent,
    testId,
    meta,
  } = useTimelineMap('Chart');
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);

  // The link weave (engage-grammar): the last-touched dot's threads stay
  // lit; everything unrelated recedes. Selection = `previewed` (hover and
  // keyboard focus both set it), and it only takes hold when that item
  // actually participates in a visible thread — a hover over a threadless
  // dot must not dim the map.
  const byId = React.useMemo(
    () => new Map(layout.order.map((i) => [i.id, i])),
    [layout],
  );
  const shownEdges = layout.edges.filter((e) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    return a !== undefined && b !== undefined && visible(a) && visible(b);
  });
  const selected =
    previewed && shownEdges.some((e) => e.from === previewed.id || e.to === previewed.id)
      ? previewed.id
      : null;
  const related = new Set<string>();
  if (selected) {
    for (const e of shownEdges) {
      if (e.from === selected) related.add(e.to);
      if (e.to === selected) related.add(e.from);
    }
  }

  // Fit-all: stretch the strip to the container so the ENTIRE territory
  // is visible when space allows. Below the 560px floor the strip keeps
  // its size and scrolls instead. (Guarded: jsdom has no ResizeObserver,
  // and static SSR markup renders honestly at the floor.)
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () =>
      setStripWidth(Math.max(STRIP_W, Math.floor(el.clientWidth) - LABEL_W));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [setStripWidth]);

  // Rest at the recent end when the strip does overflow: the left edge
  // of a timeline is its sparsest region. Initial state, not motion —
  // reduced-motion safe. (A fit-all strip has nothing to scroll.)
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const onKeyDown = (item: TimelineMapItem) => (e: React.KeyboardEvent) => {
    const delta =
      e.key === 'ArrowRight'
        ? 'next'
        : e.key === 'ArrowLeft'
          ? 'prev'
          : e.key === 'Home'
            ? 'first'
            : e.key === 'End'
              ? 'last'
              : null;
    if (!delta) return;
    e.preventDefault();
    moveFocus(item.id, delta);
  };

  // Move real focus when roving target changes via keyboard.
  const focusRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (focusedId && focusRef.current !== null && focusRef.current !== focusedId) {
      // Dataset comparison, not selector interpolation: consumer-supplied
      // ids need no escaping this way, and it drops the dependency on the
      // CSS.escape global (absent in jsdom — surfaced by the mounted
      // keyboard test).
      const el = [
        ...(scrollerRef.current?.querySelectorAll<HTMLElement>('[data-item-id]') ?? []),
      ].find((e) => e.dataset.itemId === focusedId);
      el?.focus();
    }
    focusRef.current = focusedId;
  }, [focusedId]);

  return (
    <div
      ref={scrollerRef}
      data-slot="timeline-map-chart"
      data-testid={`${testId}-chart`}
      className={cn('overflow-x-auto', className)}
      {...rest}
    >
      <div className="relative grid w-max grid-cols-[10rem_max-content]">
        <div className="sticky left-0 z-10 border-b border-border bg-card" />
        <svg
          data-slot="timeline-map-axis"
          viewBox={`0 0 ${stripWidth} 20`}
          width={stripWidth}
          height={20}
          aria-hidden
          className="h-5 border-b border-border"
        >
          <g className="text-muted-foreground">
            {layout.ticks.map((t) => (
              <g key={t.x}>
                <line
                  x1={t.x}
                  x2={t.x}
                  y1={14}
                  y2={20}
                  className="stroke-border"
                />
                <text
                  x={t.x}
                  y={11}
                  textAnchor="middle"
                  className="fill-current text-[10px]"
                >
                  {t.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
        {layout.lanes.map((lane, laneIdx) => (
          <React.Fragment key={lane.name}>
            <div
              className={cn(
                'sticky left-0 z-10 flex h-11 items-center justify-between gap-2 border-b border-border/60 bg-card pr-3 text-[11px] font-medium leading-tight text-foreground',
                laneIdx % 2 === 1 && 'bg-muted/40',
              )}
            >
              <span className="truncate">{lane.name}</span>
              <span className="text-muted-foreground">{lane.count}</span>
            </div>
            <svg
              viewBox={`0 0 ${stripWidth} ${LANE_H}`}
              width={stripWidth}
              height={LANE_H}
              role="group"
              aria-label={`${lane.name} items`}
              className={cn(
                'h-11 border-b border-border/60',
                laneIdx % 2 === 1 && 'bg-muted/40',
              )}
            >
              <g className="text-muted-foreground/60">
                {layout.ticks.map((t) => (
                  <line
                    key={t.x}
                    x1={t.x}
                    x2={t.x}
                    y1={0}
                    y2={LANE_H}
                    className="stroke-border"
                    strokeDasharray="2 4"
                  />
                ))}
              </g>
              <g className="text-strand-a">
                {lane.dots.filter((d) => visible(d.item)).map((d) => (
                  <LinkComponent
                    key={d.item.id}
                    href={d.item.href}
                    data-item-id={d.item.id}
                    aria-label={`${d.item.label} — ${[d.item.category, meta(d.item)].filter(Boolean).join(' · ')}`}
                    tabIndex={focusedId === d.item.id ? 0 : -1}
                    onMouseEnter={() => preview(d.item)}
                    onFocus={() => preview(d.item)}
                    onKeyDown={onKeyDown(d.item)}
                    onClick={() => onItemClick?.(d.item)}
                    className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    <circle
                      cx={d.cx}
                      cy={d.cy}
                      r={d.r}
                      className={cn(
                        'fill-current stroke-card stroke-2 transition-opacity',
                        selected !== null &&
                          d.item.id !== selected &&
                          !related.has(d.item.id)
                          ? 'opacity-30'
                          : 'opacity-80 hover:opacity-100',
                      )}
                    />
                  </LinkComponent>
                ))}
              </g>
            </svg>
          </React.Fragment>
        ))}
        {shownEdges.length > 0 && (
          <svg
            data-slot="timeline-map-links"
            aria-hidden
            width={stripWidth}
            height={layout.lanes.length * LANE_H}
            className="pointer-events-none absolute left-40 top-5 text-strand-b"
          >
            {shownEdges.map((e) => {
              const lit =
                selected !== null && (e.from === selected || e.to === selected);
              return (
                <path
                  key={`${e.from}→${e.to}`}
                  d={edgePath(e)}
                  className={cn(
                    'fill-none stroke-current',
                    // Engage grammar: rest = faint web; a selection lights
                    // its own threads and collapses the rest. Instant state
                    // changes — the doctrine's motion verbs stay two.
                    // Rest ink is BUDGETED: a heavily cross-cited corpus
                    // (the blog rendered 735 threads) at 0.25 each is a
                    // hairball that buries the dots. Opacity steps down
                    // with density so the web reads as texture, never as
                    // noise; the lit thread keeps full strength always.
                    selected === null
                      ? cn('stroke-1', restInk(shownEdges.length))
                      : lit
                        ? 'stroke-[1.5] opacity-90'
                        : cn('stroke-1', dimInk(shownEdges.length)),
                  )}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

/**
 * Rest-state ink budget for the link weave. Total rest ink ≈ edges ×
 * opacity; holding that roughly constant keeps a sparse corpus legible
 * (each thread readable) and a dense one calm (the web as texture).
 * Discrete steps because Tailwind classes are discrete.
 */
function restInk(edgeCount: number): string {
  if (edgeCount > 160) return 'opacity-[0.04]';
  if (edgeCount > 48) return 'opacity-10';
  return 'opacity-25';
}

/** Receded threads behind an illuminated selection — near-silent when dense. */
function dimInk(edgeCount: number): string {
  return edgeCount > 160 ? 'opacity-[0.02]' : 'opacity-[0.06]';
}

/**
 * Thread geometry: cross-lane links take a smooth S (horizontal-tangent
 * cubic); same-lane links bow upward so they don't hide inside the lane.
 */
function edgePath(e: Edge): string {
  if (e.y1 === e.y2) {
    const bow = Math.min(18, Math.abs(e.x2 - e.x1) / 8 + 8);
    return `M ${e.x1} ${e.y1} Q ${(e.x1 + e.x2) / 2} ${e.y1 - bow} ${e.x2} ${e.y2}`;
  }
  const mx = (e.x1 + e.x2) / 2;
  return `M ${e.x1} ${e.y1} C ${mx} ${e.y1} ${mx} ${e.y2} ${e.x2} ${e.y2}`;
}

/**
 * Fixed-height preview strip — the hover layer without a floating tooltip
 * (no positioning, no clipping, CLS=0). Children-as-function overrides the
 * default rendering.
 */
export interface TimelineMapDetailProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  /** Shown before any dot has been previewed. */
  idle?: React.ReactNode;
  children?: (item: TimelineMapItem) => React.ReactNode;
}

function TimelineMapDetail({
  idle,
  children,
  className,
  ...rest
}: TimelineMapDetailProps) {
  const { previewed, layout, testId, meta } = useTimelineMap('Detail');
  // The visual threads are aria-hidden decoration; THIS line is where the
  // link graph reaches screen readers and crawlers.
  const linkedLabels = (previewed?.links ?? [])
    .map((id) => layout.order.find((i) => i.id === id)?.label)
    .filter((l): l is string => l !== undefined);
  return (
    <div
      data-slot="timeline-map-detail"
      data-testid={`${testId}-detail`}
      aria-live="polite"
      className={cn(
        'mt-3 flex min-h-12 items-center rounded-md bg-muted/40 px-4 text-sm',
        className,
      )}
      {...rest}
    >
      {previewed ? (
        children ? (
          children(previewed)
        ) : (
          <span className="truncate">
            <span className="font-medium text-foreground">
              {previewed.label}
            </span>{' '}
            <span className="text-muted-foreground">
              {previewed.category ? `· ${previewed.category} ` : ''}·{' '}
              {meta(previewed)}
              {linkedLabels.length > 0 && (
                <> · weaves into {linkedLabels.join(', ')}</>
              )}
            </span>
          </span>
        )
      ) : (
        <span className="text-muted-foreground">{idle}</span>
      )}
    </div>
  );
}

TimelineMap.Filter = TimelineMapFilter;
TimelineMap.Chart = TimelineMapChart;
TimelineMap.Detail = TimelineMapDetail;
