'use client';

/**
 * @interlace/ui — MetricTable
 *
 * The roic.ai row: metric name, values across time, sparkline, delta. Click a
 * row to promote it into whatever chart the caller renders above.
 *
 * ## Why this is the centrepiece and not the chart
 *
 * roic.ai did not build 186 visualisations. They built ONE row and repeated it.
 * Density is the product — the eye scans a column of rows and reads a decade,
 * which no amount of chart-per-metric ever achieves. Anything that looks like a
 * new chart type should first be attempted as a new ROW.
 *
 * Selection is owned by the caller (`selected` / `onSelect`), so the same table
 * can drive one plot, several, or none. It is deliberately not internal state:
 * the selected metric belongs in the URL (see `URL_PHILOSOPHY` /
 * `DEEP_LINKING_PHILOSOPHY`) so a view can be linked to a colleague.
 *
 * ## It is a real table
 *
 * Not a grid of divs. `<th scope="row">` per metric, `<th scope="col">` per
 * date, so a screen reader announces "Views, 2026-08-01, 1,240" instead of a
 * bare number. Rows are `<button>`-behaviour without being buttons: the row is
 * `tabIndex=0` with `role="row"` semantics preserved and Enter/Space selecting,
 * because wrapping every cell in a button destroys the table semantics that
 * make the data readable in the first place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Scrolls horizontally inside its own container — the page never does. The date
 * columns are the thing that overflows, and they are the thing you scroll.
 *
 * | Rule | Concept                    | Where in this file                                     |
 * | ---- | -------------------------- | ------------------------------------------------------ |
 * | R6   | data-slot on every part    | `data-slot="metric-table" / "-row"`                    |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                               |
 * | R8   | No `isXxx`                 | `selected`, `polarity`                                 |
 * | R11  | One variable per part      | the row owns selection; the table owns the columns     |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`             |
 * | R18  | Tailwind only              | zero inline `style`                                    |
 * | R19  | Tokens only                | `border-border`, `bg-accent`, `text-muted-foreground`  |
 * | R20  | AA contrast                | selected row uses `bg-accent`/`text-accent-foreground` (9.31:1 light, 9.85:1 dark) |
 * | R25  | Client component           | row key/click handlers                                 |
 * | R26  | A11y                       | native table semantics + `aria-selected` + focus ring  |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Delta, type Polarity } from './delta.js';
import { Sparkline } from './sparkline.js';
import { compact, day, type Point } from './scale.js';

export const MIN_VIEWPORT = 320 as const;

export interface MetricRow {
  key: string;
  label: string;
  points: readonly Point[];
  /** `inverse` for metrics where down is good — latency, cost, bounce rate. */
  polarity?: Polarity;
  unit?: string;
}

export interface MetricTableProps extends Omit<React.ComponentProps<'div'>, 'onSelect'> {
  rows: readonly MetricRow[];
  caption: string;
  selected?: string | null;
  onSelect?: (key: string) => void;
  /**
   * How many date columns to show. The rest of the history stays in the
   * sparkline and in the `sr-only` data table, so nothing is lost.
   *
   * Defaults to 6, not 8. With 8 the date columns consumed the whole width at
   * a typical content measure and pushed **trend and change off the right
   * edge** — the two columns the reader actually came for, scrollable but
   * invisible. Individual dates are the least valuable thing in the row; they
   * are what should give up space first.
   */
  maxColumns?: number;
  /** Render a `<Skeleton variant="metric-table" />` placeholder. */
  loading?: boolean;
}

export const MetricTable = React.forwardRef<HTMLDivElement, MetricTableProps>(
  function MetricTable(
    {
      rows,
      caption,
      selected = null,
      onSelect,
      maxColumns = 6,
      loading = false,
      className,
      ...props
    },
    ref,
  ) {
    // The most recent N days present in ANY row, so a metric that started late
    // still aligns with one that has full history.
    const columns = React.useMemo(() => {
      const all = new Set<string>();
      for (const row of rows) for (const point of row.points) all.add(day(point.t));
      return [...all].sort().slice(-maxColumns);
    }, [rows, maxColumns]);

    const selectable = Boolean(onSelect);

    // After the memo above, so hook order never depends on the prop.
    if (loading) {
      return (
        <Skeleton
          variant="metric-table"
          data-slot="metric-table"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={className}
        />
      );
    }

    return (
      <div
        ref={ref}
        data-slot="metric-table"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('w-full overflow-x-auto', className)}
        {...props}
      >
        <table className="w-full border-collapse text-sm">
          <caption className="mb-2 text-left text-xs text-muted-foreground">
            {caption}
            {selectable && (
              <span className="sr-only">
                . Each row can be selected to plot it; press Enter or Space on a focused row.
              </span>
            )}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-border px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Metric
              </th>
              {/* Trend and Change sit BEFORE the dates, immediately after the
                  row's identity. A dense table overflows and scrolls — that is
                  inherent, not a bug — so the only real decision is which
                  columns are allowed to scroll away. Trailing them after the
                  dates meant the two columns the reader came for were the first
                  off-screen, showing a bare direction glyph and no numbers.
                  Individual dates are the least valuable cells in the row. */}
              <th scope="col" className="border-b border-border px-3 py-2">
                <span className="sr-only">Trend</span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap border-b border-border px-3 py-2 text-right text-xs font-medium text-muted-foreground"
              >
                Change
              </th>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap border-b border-border px-3 py-2 text-right text-xs font-medium text-muted-foreground tabular-nums"
                >
                  {column.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const values = new Map(row.points.map((point) => [day(point.t), point.v]));
              const isSelected = selected === row.key;
              return (
                <tr
                  key={row.key}
                  data-slot="metric-table-row"
                  data-selected={isSelected || undefined}
                  aria-selected={selectable ? isSelected : undefined}
                  tabIndex={selectable ? 0 : undefined}
                  onClick={selectable ? () => onSelect!(row.key) : undefined}
                  onKeyDown={
                    selectable
                      ? (event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          // Space scrolls the page by default; a focused row owns it.
                          event.preventDefault();
                          onSelect!(row.key);
                        }
                      : undefined
                  }
                  className={cn(
                    'border-t border-border',
                    selectable &&
                      'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring hover:bg-muted',
                    isSelected && 'bg-accent text-accent-foreground',
                  )}
                >
                  <th
                    scope="row"
                    className="whitespace-nowrap px-3 py-1.5 text-left font-normal"
                  >
                    {row.label}
                  </th>
                  <td className="px-3 py-1">
                    {/* Decorative: the row already announces every value and the
                        change cell announces the direction. */}
                    <Sparkline points={row.points} polarity={row.polarity} decorative />
                  </td>
                  {/* `whitespace-nowrap`: auto table layout hands the date
                      columns the space first and squeezes this one to a zero
                      content box, which clips the digits and leaves only the
                      direction glyph visible. The numbers ARE the column. */}
                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                    <Delta points={row.points} polarity={row.polarity} unit={row.unit} />
                  </td>
                  {columns.map((column) => {
                    const value = values.get(column);
                    return (
                      <td
                        key={column}
                        className={cn(
                          'px-3 py-1.5 text-right tabular-nums',
                          value == null && 'text-muted-foreground',
                        )}
                      >
                        {value == null ? (
                          <>
                            <span aria-hidden>—</span>
                            <span className="sr-only">No data</span>
                          </>
                        ) : (
                          compact(value)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },
);
