'use client';

/**
 * @interlace/ui — ShareChart
 *
 * How a whole splits into parts, one bar per row: survey answers by group,
 * a budget by department, time by activity. Each row is one 100% bar cut
 * into segments, and every row shares one scale, so rows compare at a
 * glance.
 *
 * ## Two layouts
 *
 *   - `stacked`: every bar starts at the same edge and runs to 100%. For
 *     parts that have no direction, such as answers to "which do you use".
 *   - `diverging`: for an ordered scale with two ends (strongly disagree to
 *     strongly agree). The categories before the middle go to the start of a
 *     shared zero line, the rest go to the end, and a `neutral` category
 *     straddles the line. The zero line sits in the same place on every row,
 *     so the reader compares both sides of every row against one mark. The
 *     total of each side is printed at its end of the bar.
 *
 * ## Shares, not raw numbers
 *
 * A row's values are divided by its total, which is the sum of its values
 * unless the row gives `total`. So counts and percentages both work, and a
 * row whose answers leave out "no answer" can set `total: 100` and keep that
 * gap honest instead of stretching the rest to fill it. `shareOf()` and
 * `shareLayout()` are exported and pure.
 *
 * ## Colour is never the only channel
 *
 * Stacked categories take the five chart hues in order, skipping any a
 * category names for itself, then neutral.
 * Diverging categories take two poles (`poles`, chart hues 1 and 3 by
 * default): the outer category of each side in the full tone, the inner ones
 * lighter towards the middle, and the neutral one grey. The legend names
 * every category in order; each row has a sentence with every share; a table
 * of every value sits behind the picture (`showTable` shows it). Segments are
 * parted by a 2px gap in the page colour, never by an outline.
 *
 * ## Pointing at a category
 *
 * Hovering a segment or a legend entry, or focusing a legend entry, dims the
 * other categories in every row and prints that category's share at the end
 * of each row. A click on a legend entry pins it (`aria-pressed`); a second
 * click lets go. All of it works from the keyboard through the legend.
 *
 * ## Motion
 *
 * The whole chart is in the server HTML. The first time it scrolls into
 * view, each bar grows out of its zero line once, in 400ms, the rows 150ms
 * apart in total. Under `prefers-reduced-motion` the bars are simply there.
 * It runs on the Web Animations API, so there are no keyframes to add.
 *
 * ## Container, not viewport
 *
 * Wide enough (28rem of its own box), each row is label, bar and totals on
 * one line, with the labels in one column. Narrower, the label sits above its
 * bar. In a right-to-left page the bars mirror: the start side is on the
 * right.
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Anatomy
 *
 *   <figure data-slot="share-chart" data-layout="stacked|diverging">
 *     <figcaption>{label}</figcaption>
 *     <div data-slot="share-chart-legend"> <button aria-pressed /> × categories </div>
 *     <ul data-slot="share-chart-rows">
 *       <li data-slot="share-chart-row">
 *         <span data-slot="share-chart-row-label" />
 *         <span data-slot="share-chart-start" />            (diverging: start-side total)
 *         <svg data-slot="share-chart-bar" aria-hidden>
 *           <rect data-slot="share-chart-segment" /> × categories
 *         </svg>
 *         <span data-slot="share-chart-end" />              (end-side total, or the pointed-at share)
 *         <span class="sr-only">{row sentence}</span>
 *       </li>
 *     </ul>
 *     <div data-slot="share-chart-table" />                 (sr-only unless showTable)
 *   </figure>
 *
 * | Rule | Concept                    | Where in this file                                         |
 * | ---- | -------------------------- | ---------------------------------------------------------- |
 * | R4   | Extends native el          | `React.ComponentProps<'figure'>`                            |
 * | R6   | data-slot on every part    | `share-chart` / `-row` / `-bar` / `-segment` / `-legend`     |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                                    |
 * | R8   | Enums, not booleans        | `layout`, `order`                                           |
 * | R13  | Ecosystem first            | no charting dep: `shareLayout` + SVG percentages            |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`                  |
 * | R18  | Tailwind only              | zero inline `style`; widths are SVG attributes, motion WAAPI |
 * | R19  | Tokens only                | `--chart-1..5`, `--muted-foreground`, mixed with `--background` |
 * | R23  | Loading reserves its box   | `loading` → `<Skeleton variant="chart">`                    |
 * | R25  | Client component           | the reveal and the highlight run in the browser             |
 * | R26  | A11y                       | sentence per row + named legend + table                     |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Skeleton } from '../primitives/skeleton.js';

export const MIN_VIEWPORT = 320 as const;

export type ShareTone = 1 | 2 | 3 | 4 | 5 | 'neutral';

export type ShareCategory = {
  /** What rows key their values by. */
  id: string;
  /** The category's name, as the legend and the table print it. */
  label: string;
  /** Its colour. @default stacked: the next of 1..5, then neutral; diverging: a shade of its side's pole */
  tone?: ShareTone;
};

export type ShareRow = {
  /** The row's name, such as a group of respondents or a year. */
  label: string;
  /** A value per category id. Missing ids count as 0. */
  values: Readonly<Record<string, number>>;
  /** What the shares are of. @default the sum of the values */
  total?: number;
  /** A short line under the label, such as the sample size. */
  note?: string;
};

export type ShareLayoutKind = 'stacked' | 'diverging';

/** Each tone at full strength, then two steps lighter towards the page. Written out so Tailwind sees them. */
const FILLS: Record<ShareTone, readonly [string, string, string]> = {
  1: [
    'fill-chart-1',
    'fill-[color-mix(in_oklab,var(--chart-1),var(--background)_35%)]',
    'fill-[color-mix(in_oklab,var(--chart-1),var(--background)_60%)]',
  ],
  2: [
    'fill-chart-2',
    'fill-[color-mix(in_oklab,var(--chart-2),var(--background)_35%)]',
    'fill-[color-mix(in_oklab,var(--chart-2),var(--background)_60%)]',
  ],
  3: [
    'fill-chart-3',
    'fill-[color-mix(in_oklab,var(--chart-3),var(--background)_35%)]',
    'fill-[color-mix(in_oklab,var(--chart-3),var(--background)_60%)]',
  ],
  4: [
    'fill-chart-4',
    'fill-[color-mix(in_oklab,var(--chart-4),var(--background)_35%)]',
    'fill-[color-mix(in_oklab,var(--chart-4),var(--background)_60%)]',
  ],
  5: [
    'fill-chart-5',
    'fill-[color-mix(in_oklab,var(--chart-5),var(--background)_35%)]',
    'fill-[color-mix(in_oklab,var(--chart-5),var(--background)_60%)]',
  ],
  neutral: [
    'fill-muted-foreground',
    'fill-[color-mix(in_oklab,var(--muted-foreground),var(--background)_35%)]',
    'fill-[color-mix(in_oklab,var(--muted-foreground),var(--background)_55%)]',
  ],
};

const STACK_ORDER: readonly ShareTone[] = [1, 2, 3, 4, 5];

// ─────────────────────────────────────────────────────────────────
// Pure geometry
// ─────────────────────────────────────────────────────────────────

/** Each category's share of the row, 0 to 1, in category order. Negative or non-finite values count as 0. */
export function shareOf(row: ShareRow, categories: readonly ShareCategory[]): number[] {
  const raw = categories.map((c) => {
    const v = row.values[c.id];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  const total = row.total !== undefined && Number.isFinite(row.total) && row.total > 0 ? Math.max(row.total, sum) : sum;
  return total > 0 ? raw.map((v) => v / total) : raw.map(() => 0);
}

export type ShareSegment = {
  /** Index into the categories. */
  category: number;
  /** Start along the bar, 0 to 1 of the shared scale. */
  x: number;
  /** Length, 0 to 1 of the shared scale. */
  width: number;
  /** The category's share of the row. */
  share: number;
};

export type ShareRowLayout = {
  segments: ShareSegment[];
  /** Diverging: the sum of the start side's shares, the neutral excluded. */
  start: number;
  /** Diverging: the sum of the end side's shares, the neutral excluded. Stacked: the sum of all shares. */
  end: number;
};

export type ShareLayout = {
  rows: ShareRowLayout[];
  /** Where the zero line sits, 0 to 1 of the bar. 0 when stacked. */
  zero: number;
};

/**
 * Lay every row out on one shared scale.
 *
 * Stacked: the scale is 0 to 100% of a row. Diverging: categories before
 * `split` go to the start side, the category at `neutral` (if any) straddles
 * zero, and the rest go to the end side; the scale runs from the widest start
 * side to the widest end side across all rows, so the zero line is shared.
 */
export function shareLayout(
  rows: readonly ShareRow[],
  categories: readonly ShareCategory[],
  layout: ShareLayoutKind,
  options: { neutral?: number; split?: number } = {},
): ShareLayout {
  const shares = rows.map((row) => shareOf(row, categories));
  if (layout === 'stacked') {
    return {
      zero: 0,
      rows: shares.map((s) => {
        let x = 0;
        const segments = s.map((share, category) => {
          const seg = { category, x, width: share, share };
          x += share;
          return seg;
        });
        return { segments, start: 0, end: x };
      }),
    };
  }

  const neutral = options.neutral !== undefined && options.neutral >= 0 ? options.neutral : -1;
  const split = neutral >= 0 ? neutral : (options.split ?? Math.floor(categories.length / 2));
  const endFrom = neutral >= 0 ? neutral + 1 : split;
  const sides = shares.map((s) => {
    const start = s.slice(0, split).reduce((a, b) => a + b, 0);
    const end = s.slice(endFrom).reduce((a, b) => a + b, 0);
    const middle = neutral >= 0 ? s[neutral]! : 0;
    return { start, end, reach: start + middle / 2, beyond: end + middle / 2 };
  });
  const left = Math.max(0, ...sides.map((s) => s.reach));
  const right = Math.max(0, ...sides.map((s) => s.beyond));
  const span = left + right || 1;
  return {
    zero: left / span,
    rows: shares.map((s, r) => {
      let x = (left - sides[r]!.reach) / span;
      const segments = s.map((share, category) => {
        const seg = { category, x, width: share / span, share };
        x += share / span;
        return seg;
      });
      return { segments, start: sides[r]!.start, end: sides[r]!.end };
    }),
  };
}

/** The fill class of each category, in order. */
export function shareFills(
  categories: readonly ShareCategory[],
  layout: ShareLayoutKind,
  options: { neutral?: number; split?: number; poles?: readonly [ShareTone, ShareTone] } = {},
): string[] {
  if (layout === 'stacked') {
    // Auto tones skip every hue a category names, wherever it sits, so no two categories share a fill.
    const named = new Set(categories.map((c) => c.tone));
    const free = STACK_ORDER.filter((tone) => !named.has(tone));
    let next = 0;
    return categories.map((c) => FILLS[c.tone ?? free[next++] ?? 'neutral'][0]);
  }
  const [startPole, endPole] = options.poles ?? [1, 3];
  const neutral = options.neutral !== undefined && options.neutral >= 0 ? options.neutral : -1;
  const split = neutral >= 0 ? neutral : (options.split ?? Math.floor(categories.length / 2));
  const endFrom = neutral >= 0 ? neutral + 1 : split;
  const startCount = split;
  const endCount = categories.length - endFrom;
  return categories.map((c, i) => {
    if (i === neutral) return FILLS[c.tone ?? 'neutral'][1];
    if (i < split) {
      // The outermost (index 0) is the strongest.
      const step = Math.min(2, Math.round((i / Math.max(1, startCount - 1)) * Math.min(2, startCount - 1)));
      return FILLS[c.tone ?? startPole][step]!;
    }
    // The outermost (the last) is the strongest.
    const fromEdge = categories.length - 1 - i;
    const step = Math.min(2, Math.round((fromEdge / Math.max(1, endCount - 1)) * Math.min(2, endCount - 1)));
    return FILLS[c.tone ?? endPole][step]!;
  });
}

/** Every fixed word in ShareChart. Pass only the ones to change. */
export interface ShareChartLabels {
  /** Shown when there are no rows or categories. */
  empty: string;
  /** The legend's accessible name. */
  categories: string;
  /** The table's first column header, read by screen readers only. */
  row: string;
  /** The table caption, given the chart's label when it is a string. */
  tableCaption: (label?: string) => string;
  /** The sentence for one row, given its label and each category's formatted share. */
  rowSentence: (row: string, shares: readonly { category: string; share: string }[]) => string;
}

const LABELS: ShareChartLabels = {
  empty: 'No answers to show yet.',
  categories: 'Categories',
  row: 'Row',
  tableCaption: (label) => (label ? `${label}: shares by row` : 'Shares by row'),
  rowSentence: (row, shares) => `${row}: ${shares.map((s) => `${s.category} ${s.share}`).join(', ')}.`,
};

/** One sentence for a row: its label, then every category's share. */
export function describeShareRow(
  row: ShareRow,
  categories: readonly ShareCategory[],
  format: (share: number) => string,
  sentence: ShareChartLabels['rowSentence'] = LABELS.rowSentence,
): string {
  const shares = shareOf(row, categories);
  return sentence(
    row.label,
    categories.map((c, i) => ({ category: c.label, share: format(shares[i]!) })),
  );
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const GROW_MS = 400;
const SPREAD_MS = 150;
const EASE_ENTER = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** A bar's height, in px. A tall segmented bar never passes 28. */
const BAR_HEIGHT = 24;

export interface ShareChartProps extends Omit<React.ComponentProps<'figure'>, 'children'> {
  /** The parts, in order. For `diverging`, from one end of the scale to the other. */
  categories: readonly ShareCategory[];
  /** One bar per row. */
  rows: readonly ShareRow[];
  /** `stacked` from one edge, or `diverging` around a shared zero line. @default 'stacked' */
  layout?: ShareLayoutKind;
  /** Diverging: the id of the middle category, which straddles the zero line. */
  neutral?: string;
  /** Diverging without a neutral: how many categories sit on the start side. @default half, rounded down */
  split?: number;
  /** Diverging: the tones of the start side and the end side. @default [1, 3] */
  poles?: readonly [ShareTone, ShareTone];
  /** Diverging: names for the start and end sides, printed above their totals. */
  sideLabels?: readonly [string, string];
  /** Keep the given row order, or sort by one category's share, largest first. @default 'given' */
  order?: 'given' | 'descending';
  /** The category `order="descending"` sorts by. @default diverging: the end side's total; stacked: the first category */
  sortBy?: string;
  /** The chart's title. */
  label?: React.ReactNode;
  /** A BCP 47 locale for the percentages. @default the reader's */
  locale?: string;
  /** Decimal places on printed shares. @default 0 */
  precision?: number;
  /** Replace any fixed word: the empty note, the legend name, the table caption, the spoken rows. */
  labels?: Partial<ShareChartLabels>;
  /** Show the table of values, which otherwise is for screen readers only. */
  showTable?: boolean;
  /** Reserve the chart's box while the data loads. */
  loading?: boolean;
}

export const ShareChart = React.forwardRef<HTMLElement, ShareChartProps>(function ShareChart(
  {
    categories,
    rows,
    layout = 'stacked',
    neutral,
    split,
    poles,
    sideLabels,
    order = 'given',
    sortBy,
    label,
    locale,
    precision = 0,
    labels: labelsProp,
    showTable = false,
    loading = false,
    className,
    ...props
  },
  ref,
) {
  const reduced = useReducedMotion();
  const labels = { ...LABELS, ...labelsProp };
  const labelId = React.useId();
  const listRef = React.useRef<HTMLUListElement>(null);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [pinned, setPinned] = React.useState<number | null>(null);

  const neutralIndex = neutral === undefined ? -1 : categories.findIndex((c) => c.id === neutral);
  const geometryOptions = { neutral: neutralIndex, split };

  const sorted = React.useMemo(() => {
    if (order === 'given') return rows.map((row, index) => ({ row, index }));
    const key = sortBy === undefined ? -1 : categories.findIndex((c) => c.id === sortBy);
    const score = (row: ShareRow) => {
      if (key >= 0) return shareOf(row, categories)[key]!;
      if (layout === 'diverging') return shareLayout([row], categories, layout, geometryOptions).rows[0]!.end;
      return shareOf(row, categories)[0] ?? 0;
    };
    return rows
      .map((row, index) => ({ row, index, score: score(row) }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, categories, order, sortBy, layout, neutralIndex, split]);

  const geometry = React.useMemo(
    () => shareLayout(sorted.map((s) => s.row), categories, layout, geometryOptions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sorted, categories, layout, neutralIndex, split],
  );
  const fills = React.useMemo(
    () => shareFills(categories, layout, { ...geometryOptions, poles }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, layout, neutralIndex, split, poles],
  );

  const percent = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }),
    [locale, precision],
  );
  const format = (share: number) => percent.format(share);

  // The first view grows each bar out of its zero line, once.
  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || reduced || typeof IntersectionObserver === 'undefined') return;
    const bars = Array.from(list.querySelectorAll<SVGGElement>('[data-slot="share-chart-grow"]'));
    if (typeof bars[0]!.animate !== 'function') return;
    for (const bar of bars) bar.style.opacity = '0';
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const last = Math.max(1, bars.length - 1);
        bars.forEach((bar, i) => {
          bar.style.opacity = '';
          bar.style.transformOrigin = `${bar.getAttribute('data-origin')} 50%`;
          bar.animate(
            [
              { transform: 'scaleX(0)', opacity: 0 },
              { transform: 'scaleX(1)', opacity: 1 },
            ],
            { duration: GROW_MS, delay: (i / last) * SPREAD_MS, easing: EASE_ENTER, fill: 'backwards' },
          );
        });
      },
      { threshold: 0.25 },
    );
    io.observe(list);
    return () => {
      io.disconnect();
      for (const bar of bars) {
        bar.style.opacity = '';
        for (const animation of bar.getAnimations()) animation.cancel();
      }
    };
  }, [reduced, rows.length, categories.length, layout]);

  if (loading) {
    return (
      <figure
        ref={ref}
        data-slot="share-chart"
        data-state="loading"
        data-min-viewport={String(MIN_VIEWPORT)}
        aria-busy="true"
        className={cn('m-0 w-full', className)}
        {...props}
      >
        <Skeleton variant="chart" />
      </figure>
    );
  }

  if (rows.length === 0 || categories.length === 0) {
    return (
      <figure
        ref={ref}
        data-slot="share-chart"
        data-state="empty"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('m-0 w-full rounded-xl border border-border p-6', className)}
        {...props}
      >
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      </figure>
    );
  }

  const diverging = layout === 'diverging';
  // How many categories sit on the start side. Stacked has no start side.
  const startSide = !diverging ? 0 : neutralIndex >= 0 ? neutralIndex : (split ?? Math.floor(categories.length / 2));
  const active = hovered ?? pinned;
  const zero = geometry.zero;
  const pct = (n: number) => `${Number((n * 100).toFixed(3))}%`;

  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const category = (event.target as Element).getAttribute('data-category');
    setHovered(category === null ? null : Number(category));
  };

  const NUMBER = 'text-foreground min-w-[4ch] shrink-0 text-ui-sm font-medium tabular-nums';

  return (
    <figure
      ref={ref}
      data-slot="share-chart"
      data-layout={layout}
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-labelledby={label ? labelId : undefined}
      className={cn('@container/share m-0 flex w-full min-w-0 flex-col gap-4', className)}
      {...props}
    >
      {label ? (
        <figcaption id={labelId} data-slot="share-chart-label" className="text-foreground text-ui-sm font-medium">
          {label}
        </figcaption>
      ) : null}

      <ul
        data-slot="share-chart-legend"
        aria-label={labels.categories}
        className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-ui-sm"
      >
        {categories.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              aria-pressed={pinned === i}
              data-slot="share-chart-legend-item"
              data-active={active === i ? '' : undefined}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              onClick={() => setPinned((current) => (current === i ? null : i))}
              className={cn(
                '-mx-1.5 flex min-h-target items-center gap-2 rounded-md px-1.5 py-0.5 text-start',
                'hover:bg-muted data-[active]:bg-muted aria-pressed:bg-muted',
                'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
              )}
            >
              <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0">
                <rect width="12" height="12" rx="3" className={fills[i]} />
              </svg>
              <span className="text-foreground">{c.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <ul
        ref={listRef}
        data-slot="share-chart-rows"
        className={cn(
          'm-0 grid list-none gap-y-3 p-0',
          diverging ? 'grid-cols-[auto_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]',
          diverging
            ? '@md/share:grid-cols-[minmax(6rem,14rem)_auto_minmax(0,1fr)_auto]'
            : '@md/share:grid-cols-[minmax(6rem,14rem)_minmax(0,1fr)_auto]',
        )}
      >
        {diverging && sideLabels ? (
          <li aria-hidden className="col-span-full grid grid-cols-subgrid items-end gap-x-3 text-caption text-muted-foreground">
            <span className="col-span-full flex justify-between gap-3 @md/share:col-span-3 @md/share:col-start-2">
              <span>{sideLabels[0]}</span>
              <span className="text-end">{sideLabels[1]}</span>
            </span>
          </li>
        ) : null}
        {sorted.map(({ row, index }, r) => {
          const placed = geometry.rows[r]!;
          const sentence = describeShareRow(row, categories, format, labels.rowSentence);
          // A pointed-at share replaces its side's total; the other side's number steps aside.
          const shown = active === null ? null : format(placed.segments[active]!.share);
          const onStart = active !== null && active < startSide;
          const startText = active === null ? format(placed.start) : onStart ? shown : '';
          const endText = active === null ? (diverging ? format(placed.end) : '') : onStart ? '' : shown;
          return (
            <li
              key={`${row.label}-${index}`}
              data-slot="share-chart-row"
              className="col-span-full grid grid-cols-subgrid items-center gap-x-3 gap-y-1"
            >
              <span
                data-slot="share-chart-row-label"
                aria-hidden
                className="col-span-full flex min-w-0 flex-col @md/share:col-span-1"
              >
                <span className="text-foreground text-ui-sm break-words">{row.label}</span>
                {row.note ? <span className="text-muted-foreground text-caption">{row.note}</span> : null}
              </span>
              {diverging ? (
                <span data-slot="share-chart-start" aria-hidden className={cn(NUMBER, 'text-end')}>
                  {startText}
                </span>
              ) : null}
              <svg
                data-slot="share-chart-bar"
                aria-hidden
                width="100%"
                height={BAR_HEIGHT}
                className="block h-6 w-full overflow-visible rtl:-scale-x-100"
                onPointerMove={point}
                onPointerLeave={() => setHovered(null)}
              >
                <g data-slot="share-chart-grow" data-origin={pct(zero)} className="[transform-box:view-box]">
                  {placed.segments.map((seg) =>
                    seg.width > 0 ? (
                      <rect
                        key={seg.category}
                        data-slot="share-chart-segment"
                        data-category={seg.category}
                        x={pct(seg.x)}
                        width={pct(seg.width)}
                        y={0}
                        height={BAR_HEIGHT}
                        rx={4}
                        strokeWidth={2}
                        className={cn(
                          'stroke-background motion-safe:transition-opacity motion-safe:duration-(--duration-fast)',
                          fills[seg.category],
                          active !== null && seg.category !== active && 'opacity-25',
                        )}
                      />
                    ) : null,
                  )}
                </g>
                {diverging ? (
                  <line
                    data-slot="share-chart-zero"
                    x1={pct(zero)}
                    x2={pct(zero)}
                    y1={-3}
                    y2={BAR_HEIGHT + 3}
                    strokeWidth={1.5}
                    className="stroke-foreground"
                  />
                ) : null}
              </svg>
              <span data-slot="share-chart-end" aria-hidden className={NUMBER}>
                {endText}
              </span>
              <span className="sr-only">
                {sentence}
                {row.note ? ` ${row.note}.` : ''}
              </span>
            </li>
          );
        })}
      </ul>

      <div data-slot="share-chart-table" className={cn(showTable ? 'overflow-x-auto' : 'sr-only')}>
        <table className="w-full text-ui-sm tabular-nums">
          <caption className="text-muted-foreground pb-2 text-start text-caption">
            {labels.tableCaption(typeof label === 'string' ? label : undefined)}
          </caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-1.5 pe-4 text-start font-medium">
                <span className="sr-only">{labels.row}</span>
              </th>
              {categories.map((c) => (
                <th key={c.id} scope="col" className="py-1.5 pe-4 text-end font-medium last:pe-0">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ row, index }, r) => (
              <tr key={`${row.label}-${index}`} className="border-border border-b">
                <th scope="row" className="py-1.5 pe-4 text-start font-normal">
                  {row.label}
                  {row.note ? <span className="text-muted-foreground block text-caption">{row.note}</span> : null}
                </th>
                {geometry.rows[r]!.segments.map((seg) => (
                  <td key={seg.category} className="py-1.5 pe-4 text-end last:pe-0">
                    {format(seg.share)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
});
ShareChart.displayName = 'ShareChart';
