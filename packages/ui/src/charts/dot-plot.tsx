'use client';

/**
 * @interlace/ui — DotPlot
 *
 * One dot per value on a shared axis, one row per thing compared: support
 * for a policy by age group in two years, life expectancy by country for
 * women and men, a price in three cities. With two or more series, a line
 * joins each row's dots, so the length of the line is the gap and its
 * direction is the change.
 *
 * ## Why dots and not bars
 *
 * A bar says "this much, from zero". A dot says "here", so the axis does not
 * have to start at zero, and the reader compares positions, not lengths.
 * That makes a dot plot the honest choice for values that cluster far from
 * zero (60–80%) and for comparing two values per row: two bars side by side
 * make the reader subtract; two dots on one line show the gap.
 *
 * ## The axis
 *
 * The domain is the data's range rounded out to round numbers, unless you
 * pass `domain`. Ticks are those round numbers, as HTML-sized text in an SVG
 * that is never scaled, so 12px stays 12px at any width. `niceTicks()` is
 * exported and pure.
 *
 * ## Colour is never the only channel
 *
 * Series take the chart hues in order. The first series is a hollow ring and
 * the others are filled, so "before" and "after" differ in shape as well as
 * colour. The legend names them; each row has a sentence with every value;
 * a table sits behind the picture (`showTable` shows it). The value of the
 * last series is printed at the end of each row.
 *
 * ## Pointing at a series
 *
 * Hovering a dot or a legend entry, or focusing a legend entry, dims the
 * other series and prints that series' value at the end of every row. A
 * click on a legend entry pins it.
 *
 * ## Motion
 *
 * On first view, the line in each row draws from the first series towards
 * the last and the later dots arrive after it, once, in 400ms: the motion is
 * the change the chart is about. Under reduced motion it is all simply there.
 *
 * ## Container, not viewport
 *
 * Label beside the plot when the chart's own box is 28rem or wider, above it
 * when narrower. In a right-to-left page the axis runs right to left.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                    | Where in this file                                     |
 * | ---- | -------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el          | `React.ComponentProps<'figure'>`                        |
 * | R6   | data-slot on every part    | `dot-plot` / `-row` / `-dot` / `-link` / `-axis` / `-legend` |
 * | R8   | Enums, not booleans        | `order`                                                 |
 * | R13  | Ecosystem first            | no charting dep: `niceTicks` + SVG percentages          |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`              |
 * | R18  | Tailwind only              | zero inline `style`; positions are SVG attributes       |
 * | R19  | Tokens only                | `--chart-1..5`, `--border`, `--muted-foreground`        |
 * | R23  | Loading reserves its box   | `loading` → `<Skeleton variant="chart">`                |
 * | R26  | A11y                       | sentence per row + named legend + shapes + table        |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Skeleton } from '../primitives/skeleton.js';

export const MIN_VIEWPORT = 320 as const;

export type DotTone = 1 | 2 | 3 | 4 | 5;

export type DotSeries = {
  /** What rows key their values by. */
  id: string;
  /** The series' name, such as a year. */
  label: string;
  /** Its colour. @default the next of 1..5 */
  tone?: DotTone;
};

export type DotRow = {
  /** The row's name. */
  label: string;
  /** A value per series id. Missing or null draws no dot. */
  values: Readonly<Record<string, number | null | undefined>>;
  /** A short line under the label. */
  note?: string;
};

const FILL: Record<DotTone, string> = {
  1: 'fill-chart-1',
  2: 'fill-chart-2',
  3: 'fill-chart-3',
  4: 'fill-chart-4',
  5: 'fill-chart-5',
};
const STROKE: Record<DotTone, string> = {
  1: 'stroke-chart-1',
  2: 'stroke-chart-2',
  3: 'stroke-chart-3',
  4: 'stroke-chart-4',
  5: 'stroke-chart-5',
};

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

// ─────────────────────────────────────────────────────────────────
// Pure axis
// ─────────────────────────────────────────────────────────────────

/** The round step nearest `span / count`: 1, 2, 5 or 10 times a power of ten. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit < 1.5 ? 1 : unit < 3 ? 2 : unit < 7 ? 5 : 10) * power;
}

/**
 * Round ticks that cover `min` to `max`: the domain is rounded out to the
 * nearest step, so the first and last tick are the axis ends. A single value
 * gets one step either side of it.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const step = niceStep(Math.abs(min) || 1, count);
    return [min - step, min, min + step];
  }
  const [lo, hi] = min < max ? [min, max] : [max, min];
  let step = niceStep(hi - lo, count);
  // Rounding both ends out can add two steps; past `count + 1` the labels crowd, so take a coarser step.
  if (Math.ceil(hi / step) - Math.floor(lo / step) > count + 1) step = niceStep(hi - lo, count - 1);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const n = Math.round((end - start) / step);
  // Rounded to the step's precision, so 0.1 + 0.2 prints as 0.3.
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  return Array.from({ length: n + 1 }, (_, i) => Number((start + i * step).toFixed(digits)));
}

/**
 * Which tick labels to show, given where each one lands on screen as
 * `[left, right]`. The two ends are always shown; an inner label is shown
 * only when it keeps `gap` pixels from the last one shown and from the far
 * end. Order is by position, so a mirrored (right-to-left) axis works the same.
 */
export function thinTicks(extents: ReadonlyArray<readonly [number, number]>, gap = 6): boolean[] {
  const show = extents.map(() => false);
  if (extents.length === 0) return show;
  const order = extents.map((_, i) => i).sort((a, b) => extents[a]![0] - extents[b]![0]);
  const first = order[0]!;
  const last = order.at(-1)!;
  show[first] = true;
  show[last] = true;
  let edge = extents[first]![1];
  const stop = extents[last]![0];
  for (const i of order.slice(1, -1)) {
    const [left, right] = extents[i]!;
    if (left >= edge + gap && right <= stop - gap) {
      show[i] = true;
      edge = right;
    }
  }
  return show;
}

/**
 * The fixed words a reader meets, for a page in another language. Sentences are
 * functions, so each language can order and inflect them its own way.
 */
export type DotPlotLabels = {
  /** A missing value in the table. */
  noData: string;
  /** The name of the legend, for screen readers. */
  series: string;
  /** The table's first column, for screen readers. */
  row: string;
  /** Shown when there is nothing to plot. */
  empty: string;
  /** The table's caption, given the chart's `label` when it is a string. */
  tableCaption: (label?: string) => string;
  /** The sentence for one row. Each value is formatted, or null when missing. */
  rowSentence: (row: string, values: ReadonlyArray<{ series: string; value: string | null }>) => string;
};

const LABELS: DotPlotLabels = {
  noData: 'No data',
  series: 'Series',
  row: 'Row',
  empty: 'No values to show yet.',
  tableCaption: (label) => (label ? `${label}: values by row` : 'Values by row'),
  rowSentence: (row, values) => `${row}: ${values.map((v) => `${v.series} ${v.value ?? 'no data'}`).join(', ')}.`,
};

/** One sentence for a row: its label, then every series' value. */
export function describeDotRow(
  row: DotRow,
  series: readonly DotSeries[],
  format: (v: number) => string,
  sentence: DotPlotLabels['rowSentence'] = LABELS.rowSentence,
): string {
  return sentence(
    row.label,
    series.map((s) => {
      const v = row.values[s.id];
      return { series: s.label, value: finite(v) ? format(v) : null };
    }),
  );
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const GROW_MS = 400;
const SPREAD_MS = 150;
const EASE_ENTER = 'cubic-bezier(0.16, 1, 0.3, 1)';
const ROW_HEIGHT = 24;
const R = 6;

export interface DotPlotProps extends Omit<React.ComponentProps<'figure'>, 'children'> {
  /** The series, in order. A line joins each row's first and last dots. */
  series: readonly DotSeries[];
  /** One line of dots per row. */
  rows: readonly DotRow[];
  /** The axis range. @default the data's range, rounded out to round numbers */
  domain?: readonly [number, number];
  /** Keep the given order, sort by the last series' value, or by the change from first to last. @default 'given' */
  order?: 'given' | 'descending' | 'change';
  /** How values print, as `Intl.NumberFormat` options. */
  format?: Intl.NumberFormatOptions;
  /** A BCP 47 locale for the numbers. @default the reader's */
  locale?: string;
  /** The chart's title. */
  label?: React.ReactNode;
  /** Show the table of values, which otherwise is for screen readers only. */
  showTable?: boolean;
  /** Reserve the chart's box while the data loads. */
  loading?: boolean;
  /** Fixed words, for pages in another language. */
  labels?: Partial<DotPlotLabels>;
}

export const DotPlot = React.forwardRef<HTMLElement, DotPlotProps>(function DotPlot(
  {
    series,
    rows,
    domain,
    order = 'given',
    format: formatOptions,
    locale,
    label,
    showTable = false,
    loading = false,
    labels: labelsProp,
    className,
    ...props
  },
  ref,
) {
  const labels = { ...LABELS, ...labelsProp };
  const reduced = useReducedMotion();
  const labelId = React.useId();
  const listRef = React.useRef<HTMLUListElement>(null);
  const axisRef = React.useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [pinned, setPinned] = React.useState<number | null>(null);

  const number = React.useMemo(() => new Intl.NumberFormat(locale, formatOptions), [locale, formatOptions]);
  const format = (v: number) => number.format(v);

  // Unnamed series take the hues no series names, in order, so no two share a colour while hues last.
  const tones = React.useMemo(() => {
    const named = new Set(series.map((s) => s.tone));
    const free = ([1, 2, 3, 4, 5] as const).filter((t) => !named.has(t));
    let next = 0;
    return series.map((s) => s.tone ?? free[next++ % free.length] ?? 1);
  }, [series]);

  // With no series, `last` is undefined and sorting stops before `first` is read.
  const first = series[0]?.id;
  const last = series.at(-1)?.id;
  const sorted = React.useMemo(() => {
    const indexed = rows.map((row, index) => ({ row, index }));
    if (order === 'given' || last === undefined) return indexed;
    const score = (row: DotRow) => {
      const end = row.values[last];
      const start = row.values[first!];
      if (!finite(end)) return -Infinity;
      return order === 'change' ? (finite(start) ? end - start : -Infinity) : end;
    };
    return indexed
      .map((x) => ({ ...x, score: score(x.row) }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
  }, [rows, order, first, last]);

  const ticks = React.useMemo(() => {
    if (domain) {
      // The given ends are the axis ends; round ticks fill in between.
      const [a, b] = domain[0] <= domain[1] ? domain : [domain[1], domain[0]];
      if (!(a < b)) return [];
      return [a, ...niceTicks(a, b).filter((t) => t > a && t < b), b];
    }
    const all = rows.flatMap((row) => series.map((s) => row.values[s.id])).filter(finite);
    return all.length > 0 ? niceTicks(Math.min(...all), Math.max(...all)) : [];
  }, [domain, rows, series]);

  // Tick labels are text-sized at any width, so a narrow column or 150% text can make them
  // touch. After layout, inner labels that would touch a neighbour are hidden; the server
  // HTML keeps them all.
  React.useLayoutEffect(() => {
    const axis = axisRef.current;
    if (!axis) return;
    const fit = () => {
      const labels = Array.from(axis.querySelectorAll<SVGTextElement>('text'));
      labels.forEach((l) => l.removeAttribute('visibility'));
      const shown = thinTicks(labels.map((l) => {
        const r = l.getBoundingClientRect();
        return [r.left, r.right] as const;
      }));
      labels.forEach((l, i) => {
        if (!shown[i]) l.setAttribute('visibility', 'hidden');
      });
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(axis);
    return () => observer.disconnect();
  }, [ticks, number]);

  // The first view draws each row's line from its first dot, then the later dots arrive.
  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || reduced || typeof IntersectionObserver === 'undefined') return;
    const parts = Array.from(list.querySelectorAll<SVGElement>('[data-slot="dot-plot-link"],[data-later]'));
    if (parts.length === 0 || typeof parts[0]!.animate !== 'function') return;
    for (const part of parts) part.style.opacity = '0';
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const rowsOut = Array.from(list.querySelectorAll('[data-slot="dot-plot-row"]'));
        const lastRow = Math.max(1, rowsOut.length - 1);
        for (const part of parts) {
          part.style.opacity = '';
          const row = rowsOut.indexOf(part.closest('[data-slot="dot-plot-row"]')!);
          const delay = (row / lastRow) * SPREAD_MS;
          if (part.getAttribute('data-slot') === 'dot-plot-link') {
            part.style.transformOrigin = `${part.getAttribute('data-from')} 50%`;
            part.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
              duration: GROW_MS,
              delay,
              easing: EASE_ENTER,
              fill: 'backwards',
            });
          } else {
            part.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: GROW_MS / 2,
              delay: delay + GROW_MS / 2,
              easing: EASE_ENTER,
              fill: 'backwards',
            });
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(list);
    return () => {
      io.disconnect();
      for (const part of parts) {
        part.style.opacity = '';
        for (const animation of part.getAnimations()) animation.cancel();
      }
    };
  }, [reduced, rows.length, series.length]);

  if (loading) {
    return (
      <figure
        ref={ref}
        data-slot="dot-plot"
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

  if (rows.length === 0 || series.length === 0 || ticks.length === 0) {
    return (
      <figure
        ref={ref}
        data-slot="dot-plot"
        data-state="empty"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('m-0 w-full rounded-xl border border-border p-6', className)}
        {...props}
      >
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      </figure>
    );
  }

  const lo = ticks[0]!;
  const hi = ticks.at(-1)!;
  const span = hi - lo;
  // The track is inset by a dot's radius (`px-1.5`), so a dot at either end is never clipped.
  const pct = (v: number) => `${Number((Math.min(1, Math.max(0, (v - lo) / span)) * 100).toFixed(3))}%`;
  // A pin or hover can outlive its series when `series` shrinks; then nothing is picked out.
  const picked = hovered ?? pinned;
  const active = picked !== null && picked < series.length ? picked : null;
  const endId = active === null ? last! : series[active]!.id;

  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const s = (event.target as Element).getAttribute('data-series');
    setHovered(s === null ? null : Number(s));
  };

  const GRID =
    'grid-cols-[minmax(0,1fr)_auto] @md/dots:grid-cols-[minmax(6rem,14rem)_minmax(0,1fr)_auto]';

  return (
    <figure
      ref={ref}
      data-slot="dot-plot"
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-labelledby={label ? labelId : undefined}
      className={cn('@container/dots m-0 flex w-full min-w-0 flex-col gap-4', className)}
      {...props}
    >
      {label ? (
        <figcaption id={labelId} data-slot="dot-plot-label" className="text-foreground text-ui-sm font-medium">
          {label}
        </figcaption>
      ) : null}

      <ul data-slot="dot-plot-legend" aria-label={labels.series} className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-ui-sm">
        {series.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={pinned === i}
              data-slot="dot-plot-legend-item"
              data-active={active === i ? '' : undefined}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              onClick={() => setPinned((current) => (current === i ? null : i))}
              className={cn(
                '-mx-1.5 flex min-h-target items-center gap-2 rounded-md px-1.5 py-0.5',
                'hover:bg-muted data-[active]:bg-muted aria-pressed:bg-muted',
                'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
              )}
            >
              <svg aria-hidden viewBox="0 0 14 14" className="size-3.5 shrink-0">
                <circle
                  cx="7"
                  cy="7"
                  r={i === 0 ? 5 : 6}
                  strokeWidth={i === 0 ? 2 : 0}
                  className={i === 0 ? cn('fill-background', STROKE[tones[i]!]) : FILL[tones[i]!]}
                />
              </svg>
              <span className="text-foreground">{s.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <ul ref={listRef} data-slot="dot-plot-rows" className={cn('m-0 grid list-none gap-y-2 p-0', GRID)}>
        {sorted.map(({ row, index }) => {
          const known = series
            .map((s, i) => ({ i, v: row.values[s.id] }))
            .filter((d): d is { i: number; v: number } => finite(d.v));
          const firstDot = known[0];
          const lastDot = known.at(-1);
          const endValue = row.values[endId];
          return (
            <li
              key={`${row.label}-${index}`}
              data-slot="dot-plot-row"
              className="col-span-full grid grid-cols-subgrid items-center gap-x-3"
            >
              <span aria-hidden className="col-span-full flex min-w-0 flex-col @md/dots:col-span-1">
                <span className="text-foreground text-ui-sm break-words">{row.label}</span>
                {row.note ? <span className="text-muted-foreground text-caption">{row.note}</span> : null}
              </span>
              <span className="relative block min-w-0 px-1.5">
                <svg
                  aria-hidden
                  width="100%"
                  height={ROW_HEIGHT}
                  className="block h-6 w-full overflow-visible rtl:-scale-x-100"
                  onPointerMove={point}
                  onPointerLeave={() => setHovered(null)}
                >
                  {ticks.map((t) => (
                    <line
                      key={t}
                      x1={pct(t)}
                      x2={pct(t)}
                      y1={0}
                      y2={ROW_HEIGHT}
                      strokeWidth={1}
                      className="stroke-border"
                    />
                  ))}
                  {firstDot && lastDot && firstDot !== lastDot ? (
                    <line
                      data-slot="dot-plot-link"
                      data-from={pct(firstDot.v)}
                      x1={pct(firstDot.v)}
                      x2={pct(lastDot.v)}
                      y1={ROW_HEIGHT / 2}
                      y2={ROW_HEIGHT / 2}
                      strokeWidth={2}
                      strokeLinecap="round"
                      className={cn(
                        '[transform-box:view-box] stroke-muted-foreground/60',
                        active !== null && 'opacity-40',
                      )}
                    />
                  ) : null}
                  {known.map(({ i, v }) => (
                    <circle
                      key={i}
                      data-slot="dot-plot-dot"
                      data-series={i}
                      data-later={i > 0 ? '' : undefined}
                      cx={pct(v)}
                      cy={ROW_HEIGHT / 2}
                      r={i === 0 ? R - 1 : R}
                      strokeWidth={2}
                      className={cn(
                        'motion-safe:transition-opacity motion-safe:duration-(--duration-fast)',
                        i === 0 ? cn('fill-background', STROKE[tones[i]!]) : cn(FILL[tones[i]!], 'stroke-background'),
                        active !== null && i !== active && 'opacity-25',
                      )}
                    />
                  ))}
                </svg>
              </span>
              <span
                data-slot="dot-plot-end"
                aria-hidden
                className="text-foreground min-w-[4ch] text-end text-ui-sm font-medium tabular-nums"
              >
                {finite(endValue) ? format(endValue) : '–'}
              </span>
              <span className="sr-only">
                {describeDotRow(row, series, format, labels.rowSentence)}
                {row.note ? ` ${row.note}.` : ''}
              </span>
            </li>
          );
        })}
        <li
          aria-hidden
          data-slot="dot-plot-axis"
          className="col-span-full grid grid-cols-subgrid gap-x-3 text-caption text-muted-foreground tabular-nums"
        >
          <span className="hidden @md/dots:block" />
          <span className="block min-w-0 px-1.5">
            {/* Mirrored with the rows in a right-to-left page; each label is mirrored back so it reads. */}
            <svg ref={axisRef} width="100%" height="16" className="block h-4 w-full overflow-visible rtl:-scale-x-100">
              {ticks.map((t, i) => (
                <text
                  key={t}
                  x={pct(t)}
                  y={12}
                  textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
                  className="fill-muted-foreground origin-center [transform-box:fill-box] rtl:-scale-x-100"
                >
                  {format(t)}
                </text>
              ))}
            </svg>
          </span>
          <span />
        </li>
      </ul>

      <div data-slot="dot-plot-table" className={cn(showTable ? 'overflow-x-auto' : 'sr-only')}>
        <table className="w-full text-ui-sm tabular-nums">
          <caption className="text-muted-foreground pb-2 text-start text-caption">
            {labels.tableCaption(typeof label === 'string' ? label : undefined)}
          </caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-1.5 pe-4 text-start font-medium">
                <span className="sr-only">{labels.row}</span>
              </th>
              {series.map((s) => (
                <th key={s.id} scope="col" className="py-1.5 pe-4 text-end font-medium last:pe-0">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ row, index }) => (
              <tr key={`${row.label}-${index}`} className="border-border border-b">
                <th scope="row" className="py-1.5 pe-4 text-start font-normal">
                  {row.label}
                </th>
                {series.map((s) => {
                  const v = row.values[s.id];
                  return (
                    <td key={s.id} className="py-1.5 pe-4 text-end last:pe-0">
                      {finite(v) ? format(v) : labels.noData}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
});
DotPlot.displayName = 'DotPlot';
