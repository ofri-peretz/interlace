/**
 * @interlace/ui — RadialWeave
 *
 * The same series `TimeSeries` plots, wrapped around a dial — the POSTER
 * form: identity and shape, composed to be looked at and shared.
 *
 * ## What this form is for — and what it is not
 *
 * A radial plot trades inspection for composition: angles are harder to
 * read against a scale than horizontal distance, and that trade is only
 * honest if the inspection surfaces still exist somewhere else. They do,
 * and this component carries them: the `aria-label` sentence states the
 * range and movement in words, the `<SeriesTable>` behind the picture is
 * lossless, and the readout row prints `min`/`max` in real HTML. There is
 * deliberately NO crosshair here — a value a reader needs to inspect is
 * `TimeSeries`' job, and building a second, angular inspection surface
 * would mean maintaining two of them in disagreement.
 *
 * ## The gap in the circle is a statement
 *
 * The sweep is 300°, not 360 (`DialGeometry`'s doc has the full argument):
 * a closed circle claims the newest observation meets the oldest. The gap
 * sits at the bottom — the speedometer convention — so time starts
 * bottom-left and runs clockwise over the top.
 *
 * ## Identity survives the form change
 *
 * Series are drawn with `SERIES_STYLE` — the exact dash+hue table
 * `TimeSeries` uses — so "the dashed thread" names the same series in both
 * forms, in greyscale, and in a screenshot. The reveal is the same
 * `weave-reveal` clip `TimeSeries` draws with, keyed by the same
 * value-based geometry string, so the two forms enter the same way.
 *
 * | Rule | Concept                    | Where in this file                              |
 * | ---- | -------------------------- | ----------------------------------------------- |
 * | R6   | data-slot on every part    | `"radial-weave" / "-plot" / "-centre" / "-legend" / "-readout"` |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                        |
 * | R13  | Ecosystem first            | no charting dep — `dial*` from `scale.ts`       |
 * | R19  | Tokens only                | `stroke-chart-1..5`, `stroke-viz-grid`          |
 * | R23  | Loading reserves its box   | `loading` → `<Skeleton variant="chart">`        |
 * | R25  | Server component           | no state, no handlers — the reveal is CSS       |
 * | R26  | A11y                       | `role="img"` + sentence + lossless table        |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import {
  announceDataState,
  resolveDataState,
  type AnnouncementOptions,
} from '../primitives/data-state.js';
import { Skeleton } from '../primitives/skeleton.js';
import { SeriesTable } from './series-table.js';
import {
  compact,
  describeSeries,
  dialPath,
  dialRadius,
  dialRing,
  numeric,
  plotScales,
  ticks,
  type DialGeometry,
  type Point,
} from './scale.js';
import { MIN_VIEWPORT, SERIES_STYLE, type ComparisonSeries } from './time-series.js';

/** Drawing box, square. The viewBox scales it to any container width. */
const S = 460;

const GEOMETRY: DialGeometry = {
  cx: S / 2,
  cy: S / 2,
  inner: 64,
  outer: 206,
  startAngle: 120,
  sweep: 300,
};

/** Same drawing cap, same reason, as `TimeSeries` (five dash+hue pairs). */
const MAX_PLOTTED_SERIES = 5;

const named = (label?: string): string => label ?? 'Value';

const NO_COMPARE: readonly ComparisonSeries[] = [];

export interface RadialWeaveProps extends Omit<React.ComponentProps<'figure'>, 'children'> {
  points: readonly Point[];
  /** Further series wrapped around the same dial. One radial domain, shared. */
  compare?: readonly ComparisonSeries[];
  /** Series name — caption, accessible label, table caption. */
  label?: string;
  /** Noun for the values, e.g. "downloads". Printed under the centre value. */
  unit?: string;
  /** Render the data table visibly under the dial instead of `sr-only`. */
  showTable?: boolean;
  /** Render a `<Skeleton variant="chart" />` placeholder. */
  loading?: boolean;
  /** The fetch failed — a different statement from an empty series. */
  error?: unknown;
  /** Context for the absence sentences — noun, coverage, reason. */
  announce?: AnnouncementOptions;
}

export const RadialWeave = React.forwardRef<HTMLElement, RadialWeaveProps>(function RadialWeave(
  {
    points,
    compare = NO_COMPARE,
    label,
    unit,
    showTable = false,
    loading = false,
    error,
    announce,
    className,
    ...props
  },
  ref,
) {
  const clipId = `rw-reveal-${React.useId().replace(/[^a-zA-Z0-9-]/g, '')}`;

  const all: readonly { points: readonly Point[]; label?: string; unit?: string }[] = [
    { points, label, unit },
    ...compare,
  ];
  const drawn = all.slice(0, MAX_PLOTTED_SERIES);
  const undrawn = all.length - drawn.length;

  // The inner/outer radii play the role height plays for `plotScales` —
  // only min/max/keys/at are read here; x/y projectors go unused.
  const plot = plotScales(drawn.map((s) => s.points), S, S);
  const last = plot.keys.length - 1;

  const absence = resolveDataState({ loading, error }, announce);

  if (absence.state === 'loading') {
    return (
      <Skeleton
        variant="chart"
        data-slot="radial-weave"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={className}
      />
    );
  }

  if (absence.state === 'error') {
    return (
      <figure
        ref={ref}
        data-slot="radial-weave-error"
        data-state="error"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('m-0 w-full rounded-lg border border-destructive/40 p-6', className)}
        {...props}
      >
        <p role="alert" className="text-sm text-destructive">
          {announceDataState('error', announce)} The history is unknown, not
          absent — this is not an empty series.
        </p>
      </figure>
    );
  }

  // The primary series carries the dial, exactly as it carries the line
  // (`TimeSeries`' rule and reasoning — a comparison series cannot rescue
  // a headline metric with one reading).
  const own = numeric(points);
  if (own.length < 2) {
    return (
      <figure
        ref={ref}
        data-slot="radial-weave-empty"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('m-0 w-full rounded-lg border border-border p-6', className)}
        {...props}
      >
        <p className="text-sm text-muted-foreground">
          {own.length === 0 ? 'No data yet.' : `Only ${own.length} point so far.`}{' '}
          A trend needs at least two observations, and history cannot be back-filled.
        </p>
      </figure>
    );
  }

  // Same value-named geometry, same replay contract, as `TimeSeries`.
  const geometry = [
    drawn.map((s) => named(s.label)).join(','),
    plot.keys[0],
    plot.keys[last],
    plot.keys.length,
    plot.min,
    plot.max,
  ].join('|');

  const latest = own[own.length - 1].v;

  return (
    <figure
      ref={ref}
      data-slot="radial-weave"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-series-count={String(drawn.length)}
      className={cn('m-0 flex w-full flex-col gap-2', className)}
      {...props}
    >
      {label && (
        <figcaption className="text-xs text-muted-foreground">
          {label}
          <span className="sr-only">, </span>
          <span aria-hidden> · </span>
          {plot.keys[0]} → {plot.keys[last]}
        </figcaption>
      )}

      {drawn.length > 1 && (
        <ul
          data-slot="radial-weave-legend"
          className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 text-xs text-muted-foreground"
        >
          {drawn.map((series, index) => (
            <li key={named(series.label)} className="flex items-center gap-1.5">
              <svg aria-hidden width={24} height={8} viewBox="0 0 24 8" className="shrink-0">
                <line
                  x1={0}
                  y1={4}
                  x2={24}
                  y2={4}
                  strokeWidth={2}
                  strokeDasharray={SERIES_STYLE[index].dash}
                  className={SERIES_STYLE[index].stroke}
                />
              </svg>
              {named(series.label)}
            </li>
          ))}
          {undrawn > 0 && <li>{`${undrawn} more not plotted — see the data table`}</li>}
        </ul>
      )}

      <div className="relative">
        <svg
          data-slot="radial-weave-plot"
          viewBox={`0 0 ${S} ${S}`}
          className="block w-full"
          role="img"
          aria-label={drawn
            .map((series) => describeSeries(series.points, series.label))
            .join(' ')}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                key={geometry}
                x={0}
                y={0}
                width={S}
                height={S}
                className="animate-weave-reveal origin-left [transform-box:fill-box]"
              />
            </clipPath>
          </defs>

          {/* Grid rings — the dial's stage, outside the reveal clip for the
              same reason TimeSeries' grid is. Decorative weight; the values
              the rings stand at are printed in HTML below. */}
          {ticks({ points: plot.keys, min: plot.min, max: plot.max }, 3).map((value) => (
            <path
              key={value}
              d={dialRing(dialRadius(value, plot.min, plot.max, GEOMETRY), GEOMETRY)}
              className="fill-none stroke-viz-grid"
              strokeWidth={1}
              aria-hidden
            />
          ))}

          <g clipPath={`url(#${clipId})`}>
            {drawn.map((series, index) => (
              <path
                key={`arc-${named(series.label)}`}
                d={dialPath(
                  plot.keys.map((_, slot) => plot.at(index, slot)),
                  plot.min,
                  plot.max,
                  GEOMETRY,
                )}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={SERIES_STYLE[index].dash}
                className={SERIES_STYLE[index].stroke}
              />
            ))}
          </g>
        </svg>

        {/* The centre is HTML, not SVG text: at any container width these
            pixels are real pixels (TimeSeries' 4px-labels lesson). */}
        <div
          data-slot="radial-weave-centre"
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {compact(latest)}
          </span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </div>

      <div
        data-slot="radial-weave-readout"
        className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs text-muted-foreground tabular-nums"
      >
        <span>{plot.min.toLocaleString()}</span>
        <span>
          {plot.keys[0]} → {plot.keys[last]}
        </span>
        <span>{plot.max.toLocaleString()}</span>
      </div>

      <SeriesTable
        series={all.map((series) => ({ label: named(series.label), points: series.points }))}
        caption={
          all.length === 1
            ? `${label ?? 'Series'} — full data${unit ? ` (${unit})` : ''}`
            : `${all.map((series) => named(series.label)).join(', ')} — full data`
        }
        hidden={!showTable}
      />
    </figure>
  );
});
