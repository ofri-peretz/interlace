'use client';

/**
 * @interlace/ui — TimeSeries
 *
 * One metric over time, with the actions that moved it drawn ON the curve.
 *
 * ## The annotation is the point
 *
 * A line going up is a fact. A line going up with a publish marker at the
 * inflection is an *argument*. Everything else in this component — grid, axis,
 * crosshair — is chrome that exists so the annotation can be read against a
 * scale. If you are adding a feature here and it does not help someone connect
 * a thing they did to a number that moved, it probably belongs elsewhere.
 *
 * ## The crosshair works from the keyboard
 *
 * This is the part chart libraries almost universally get wrong: hover-only
 * inspection means the values exist for mouse users and for nobody else. Here
 * the SVG is focusable, ←/→ step the crosshair, Home/End jump to the ends, and
 * the readout below is `aria-live="polite"` so each step is announced. Learned
 * in 1.2 — axe cannot press a key, so it scored the hover-only version green.
 *
 * The pointer path and the keyboard path both resolve through `nearestIndex`,
 * so the two can never disagree about which point is under the crosshair.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The SVG scales to its container via `viewBox` (no fixed width), the readout
 * wraps, and `<SeriesTable>` scrolls inside its own box. Nothing forces the
 * page to scroll horizontally.
 *
 * | Rule | Concept                    | Where in this file                                       |
 * | ---- | -------------------------- | -------------------------------------------------------- |
 * | R6   | data-slot on every part    | `data-slot="time-series" / "-plot" / "-readout"`          |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                                  |
 * | R8   | No `isXxx`; enums          | `polarity`; annotation `kind`                             |
 * | R13  | Ecosystem first            | no charting dep — `seriesScales` + SVG is the engine      |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`                |
 * | R18  | Tailwind only              | zero inline `style`                                       |
 * | R19  | Tokens only                | `stroke-viz-*`, `fill-viz-*`, `text-muted-foreground`     |
 * | R20  | AA contrast                | axis 3.64:1 light / 3.82:1 dark; grid deliberately decorative |
 * | R23  | Loading reserves its box   | `loading` → `<Skeleton variant="chart">`, same height     |
 * | R25  | Client component           | pointer + key handlers, `useState`                        |
 * | R26  | A11y                       | `role="img"` + label + focusable + live readout + table   |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Skeleton } from '../primitives/skeleton.js';
import { SeriesTable } from './series-table.js';
import {
  areaPath,
  day,
  describeSeries,
  linePath,
  nearestIndex,
  seriesScales,
  ticks,
  type Annotation,
  type AnnotationKind,
  type Point,
} from './scale.js';

export const MIN_VIEWPORT = 320 as const;

/** Internal drawing width in user units. The viewBox scales it to any container. */
const W = 900;
const PAD_LEFT = 44;
const PAD_TOP = 14;

/**
 * Annotation marks differ by SHAPE first and hue second. A photocopy, a
 * greyscale print, and a colour-blind reader all keep the distinction.
 */
const MARK: Record<AnnotationKind, { className: string; d: (x: number, y: number) => string }> = {
  publish: {
    className: 'fill-viz-annotation-publish',
    // circle, drawn as a path so all three share one element type
    d: (x, y) => `M${x - 3.5},${y}a3.5,3.5 0 1,0 7,0a3.5,3.5 0 1,0 -7,0`,
  },
  release: {
    className: 'fill-viz-annotation-release',
    d: (x, y) => `M${x},${y - 4}L${x + 4},${y}L${x},${y + 4}L${x - 4},${y}Z`, // diamond
  },
  action: {
    className: 'fill-viz-annotation-action',
    d: (x, y) => `M${x},${y - 4}L${x + 4},${y + 3.5}L${x - 4},${y + 3.5}Z`, // triangle
  },
};

export interface TimeSeriesProps extends Omit<React.ComponentProps<'figure'>, 'children'> {
  points: readonly Point[];
  annotations?: readonly Annotation[];
  /** Drawing height in user units. The rendered height follows the container width. */
  height?: number;
  /** Series name — used in the caption, the accessible label and the readout. */
  label?: string;
  /** Noun for the values, e.g. "views". */
  unit?: string;
  /** Render the data table visibly under the chart instead of `sr-only`. */
  showTable?: boolean;
  /**
   * Render a `<Skeleton variant="chart" />` placeholder.
   *
   * A chart's data is in flight on first paint essentially always, so this is
   * the state the component spends its first frames in — and the one most often
   * left as a spinner, which reserves no space and guarantees a layout shift the
   * moment the series lands.
   */
  loading?: boolean;
}

export const TimeSeries = React.forwardRef<HTMLElement, TimeSeriesProps>(function TimeSeries(
  {
    points,
    annotations = [],
    height = 220,
    label,
    unit,
    showTable = false,
    loading = false,
    className,
    ...props
  },
  ref,
) {
  const [cursor, setCursor] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const scales = React.useMemo(
    () => seriesScales(points, W - PAD_LEFT, height - PAD_TOP, PAD_TOP),
    [points, height],
  );
  // Shift the plot right of the axis labels without threading an offset through
  // every scale call.
  const px = React.useCallback((i: number) => PAD_LEFT + scales.x(i), [scales]);

  const line = linePath(scales);
  const axisTicks = React.useMemo(() => ticks(scales, 4), [scales]);
  const indexByDay = React.useMemo(
    () => new Map(scales.points.map((p, i) => [day(p.t), i])),
    [scales.points],
  );

  const last = scales.points.length - 1;

  const move = React.useCallback(
    (next: number) => setCursor(Math.max(0, Math.min(last, next))),
    [last],
  );

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const current = cursor ?? 0;
    switch (event.key) {
      case 'ArrowRight':
        move(current + 1);
        break;
      case 'ArrowLeft':
        move(current - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(last);
        break;
      case 'Escape':
        setCursor(null);
        return; // no preventDefault — Escape may close an enclosing overlay
      default:
        return;
    }
    // Arrow keys scroll the page by default; a focused chart owns them.
    event.preventDefault();
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const userX = ((event.clientX - box.left) / box.width) * W - PAD_LEFT;
    move(nearestIndex(scales, userX, W - PAD_LEFT));
  };

  // Loading is checked BEFORE the not-enough-data branch: data still in flight
  // is not the same claim as "this metric has no history", and telling a reader
  // the second while the first is true is simply wrong.
  //
  // Every hook above this point runs unconditionally — the guard sits after them
  // on purpose, so toggling `loading` never changes the hook order.
  if (loading) {
    return (
      <Skeleton
        variant="chart"
        data-slot="time-series"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={className}
      />
    );
  }

  // Below two points there is no line to draw. Say why, rather than rendering an
  // empty box that reads as a bug — a series genuinely cannot be back-filled.
  if (!line) {
    return (
      <figure
        ref={ref}
        data-slot="time-series-empty"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('m-0 rounded-lg border border-border p-6', className)}
        {...props}
      >
        <p className="text-sm text-muted-foreground">
          {scales.points.length === 0
            ? 'No data yet.'
            : `Only ${scales.points.length} point so far.`}{' '}
          A trend needs at least two observations, and history cannot be back-filled.
        </p>
      </figure>
    );
  }

  const active = cursor === null ? null : scales.points[cursor];

  return (
    <figure
      ref={ref}
      data-slot="time-series"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('m-0 flex flex-col gap-2', className)}
      {...props}
    >
      {label && (
        <figcaption className="text-xs text-muted-foreground">
          {label}
          <span className="sr-only">, </span>
          <span aria-hidden> · </span>
          {day(scales.points[0].t)} → {day(scales.points[last].t)}
        </figcaption>
      )}

      <svg
        ref={svgRef}
        data-slot="time-series-plot"
        viewBox={`0 0 ${W} ${height}`}
        className={cn(
          'block w-full touch-pan-y rounded-md',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
        role="img"
        aria-label={`${describeSeries(points, label)} Focus this chart and use the left and right arrow keys to read individual values.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setCursor(null)}
        onBlur={() => setCursor(null)}
      >
        {/* Grid + axis. Decorative weight for the lines, real contrast for the
            labels — the label is what tells you where zero is. */}
        {axisTicks.map((value) => {
          const y = scales.y(value);
          return (
            <g key={value}>
              <line
                x1={PAD_LEFT}
                y1={y}
                x2={W}
                y2={y}
                className="stroke-viz-grid"
                strokeWidth={1}
                aria-hidden
              />
              <text
                x={PAD_LEFT - 8}
                y={y}
                dominantBaseline="middle"
                textAnchor="end"
                className="fill-muted-foreground text-xs tabular-nums"
                aria-hidden
              >
                {Math.round(value).toLocaleString()}
              </text>
            </g>
          );
        })}
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={height}
          className="stroke-viz-axis"
          strokeWidth={1}
          aria-hidden
        />

        {/* The series paths are built in unshifted scale space, so they live in
            one translated group. Everything outside this <g> — annotations,
            crosshair — positions with `px()`, which adds the same offset.
            Two ways to say "left edge" in one file is how coordinate bugs
            start; this is the seam between them. */}
        <g transform={`translate(${PAD_LEFT} 0)`}>
          <path d={areaPath(scales, height)} className="fill-chart-1 opacity-10" aria-hidden />
          <path
            d={line}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-chart-1"
          />
        </g>

        {annotations.map((annotation) => {
          const index = indexByDay.get(day(annotation.t));
          if (index == null) return null;
          const kind: AnnotationKind = annotation.kind ?? 'action';
          const mark = MARK[kind];
          const x = px(index);
          return (
            <g key={`${annotation.t}-${annotation.label}`} data-annotation-kind={kind}>
              <line
                x1={x}
                y1={PAD_TOP}
                x2={x}
                y2={height}
                className="stroke-viz-axis opacity-50"
                strokeWidth={1}
                strokeDasharray="3 3"
                aria-hidden
              />
              <path d={mark.d(x, PAD_TOP)} className={mark.className}>
                {/* `<title>` is the SVG-native tooltip AND accessible name for
                    the shape — no Popover needed for a label this short. */}
                <title>{`${day(annotation.t)} — ${kind}: ${annotation.label}`}</title>
              </path>
            </g>
          );
        })}

        {cursor !== null && active && (
          <g aria-hidden>
            <line
              x1={px(cursor)}
              y1={PAD_TOP}
              x2={px(cursor)}
              y2={height}
              className="stroke-viz-crosshair opacity-50"
              strokeWidth={1}
            />
            <circle
              cx={px(cursor)}
              cy={scales.y(active.v)}
              r={4}
              className="fill-chart-1 stroke-background"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {/* The readout is both the tooltip and the live region. One element, so a
          keyboard user and a mouse user are never told different things. */}
      <div
        data-slot="time-series-readout"
        className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs text-muted-foreground tabular-nums"
      >
        <span aria-hidden>{scales.min.toLocaleString()}</span>
        <output aria-live="polite" className="font-medium text-foreground">
          {active
            ? `${day(active.t)} · ${active.v.toLocaleString()}${unit ? ` ${unit}` : ''}`
            : ''}
        </output>
        <span aria-hidden>{scales.max.toLocaleString()}</span>
      </div>

      <SeriesTable
        series={[{ label: label ?? 'Value', points }]}
        caption={`${label ?? 'Series'} — full data${unit ? ` (${unit})` : ''}`}
        hidden={!showTable}
      />
    </figure>
  );
});
