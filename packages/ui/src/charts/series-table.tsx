/**
 * @interlace/ui — SeriesTable
 *
 * The data behind a chart, as a real `<table>`.
 *
 * ## Why every chart in this package ships one
 *
 * A chart is a picture of numbers, and a picture is where the numbers stop
 * being readable by anything that is not an eye. `role="img"` + `aria-label`
 * gets a screen reader a one-sentence summary (see `describeSeries`), which is
 * enough to know *what happened* and never enough to know *what the value was
 * on the 14th*. The table is what makes the chart lossless.
 *
 * Three things fall out of it, in descending order of how often they are
 * remembered:
 *
 *  1. **A11y.** WCAG 1.1.1 — a non-text element needs an equivalent, and for
 *     data the equivalent is the data. Axe cannot verify this for us: axe reads
 *     an SVG as one opaque node and scores a labelled chart green whether or
 *     not the values are reachable. Same lesson as 1.1/1.2 — a green axe run is
 *     necessary and never sufficient.
 *  2. **SEO.** A crawler indexes the table, not the path geometry. Our charts
 *     become the answer to a query instead of an image near one.
 *  3. **Copy-paste.** Ctrl+A over a chart yields nothing. Over this, it yields
 *     a TSV a reader can paste into a spreadsheet and check our work — which
 *     for a project whose whole pitch is measured claims is not a nicety.
 *
 * `hidden` (the default) renders it `sr-only`: present in the accessibility
 * tree and the DOM, absent from the layout. Pass `hidden={false}` to show it —
 * a "show data" toggle beside a chart is a good default, not an admission.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Scrolls horizontally inside its own container below that; the page never does.
 *
 * | Rule | Concept                     | Where in this file                                    |
 * | ---- | --------------------------- | ----------------------------------------------------- |
 * | R6   | data-slot on every part     | `data-slot="series-table"`                            |
 * | R7   | className merged + ...rest  | `cn(...)` + `{...props}`                              |
 * | R8   | No `isXxx`                  | `hidden`, not `isHidden`                              |
 * | R14  | Declares min viewport       | `data-min-viewport={String(MIN_VIEWPORT)}`            |
 * | R18  | Tailwind only               | zero inline `style`                                   |
 * | R19  | Tokens only                 | `border-border`, `text-muted-foreground`              |
 * | R26  | A11y                        | native `<table>` + `<caption>` + scoped headers       |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { day, type Point } from './scale.js';

export const MIN_VIEWPORT = 320 as const;

export interface SeriesTableProps extends React.ComponentProps<'div'> {
  /** One entry per series. A single-series chart passes one. */
  series: readonly { label: string; points: readonly Point[] }[];
  /** The `<caption>`. Required — an unnamed table is a wall of numbers. */
  caption: string;
  /** Render `sr-only` (default) or visibly. */
  hidden?: boolean;
  /** Column header for the x axis. */
  keyLabel?: string;
  /**
   * What kind of axis the `t` values are.
   *
   *   - `time` (default) — `t` is an instant. Rows are keyed by `day(t)` and
   *     SORTED, because a chronological axis has exactly one true order and two
   *     readings on one day are one row.
   *   - `category` — `t` is a name. Rows are keyed by `t` verbatim, in the order
   *     the series first mentions them.
   *
   * The second exists because sorting is *wrong* for a categorical axis, not
   * merely unnecessary: `['Mon','Tue','Wed']` sorts to `['Mon','Tue','Wed']`
   * only by luck, `['Thu','Fri','Sat']` sorts to `['Fri','Sat','Thu']`, and the
   * table then disagrees with the picture beside it about what order the week
   * happens in. `day()` is skipped for the same reason — it truncates to ten
   * characters, which is a date-shaped assumption, and "Wednesday morning"
   * would become "Wednesday ".
   */
  axis?: 'time' | 'category';
}

export const SeriesTable = React.forwardRef<HTMLDivElement, SeriesTableProps>(
  function SeriesTable(
    {
      series,
      caption,
      hidden = true,
      keyLabel = 'Date',
      axis = 'time',
      className,
      ...props
    },
    ref,
  ) {
    // Union of every key across every series, so a series with a gap still
    // lines up row-for-row with one that has none. A `Set` preserves insertion
    // order, which is what makes the categorical case "first mentioned" rather
    // than "whatever the last series said".
    const rows = React.useMemo(() => {
      const keys = new Set<string>();
      for (const s of series)
        for (const p of s.points) keys.add(axis === 'time' ? day(p.t) : p.t);
      return axis === 'time' ? [...keys].sort() : [...keys];
    }, [series, axis]);

    const byKey = React.useMemo(
      () =>
        series.map(
          (s) => new Map(s.points.map((p) => [axis === 'time' ? day(p.t) : p.t, p.v])),
        ),
      [series, axis],
    );

    return (
      <div
        ref={ref}
        data-slot="series-table"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(hidden ? 'sr-only' : 'w-full overflow-x-auto', className)}
        {...props}
      >
        <table className="w-full border-collapse text-sm tabular-nums">
          <caption className="mb-2 text-left text-xs text-muted-foreground">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-border px-3 py-2 text-left font-medium">
                {keyLabel}
              </th>
              {series.map((s) => (
                <th
                  key={s.label}
                  scope="col"
                  className="border-b border-border px-3 py-2 text-right font-medium"
                >
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => (
              <tr key={key}>
                <th
                  scope="row"
                  className="border-b border-border px-3 py-1.5 text-left font-normal"
                >
                  {key}
                </th>
                {byKey.map((map, i) => {
                  const value = map.get(key);
                  return (
                    <td
                      key={series[i].label}
                      className="border-b border-border px-3 py-1.5 text-right"
                    >
                      {/* "No data" spelled out, not an em dash — a screen
                          reader announces "—" as nothing at all. */}
                      {value == null ? (
                        <span className="text-muted-foreground">No data</span>
                      ) : (
                        value.toLocaleString()
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
);
