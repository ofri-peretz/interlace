'use client';

/**
 * @interlace/ui — Distribution
 *
 * One quantity spread across a fixed set of bins — hours of the day, days of
 * the week, cohorts, buckets — with an optional REFERENCE distribution drawn
 * over it.
 *
 * ## Why this is not `TimeSeries` with three more props
 *
 * It was attempted that way first. Every part of `TimeSeries` is chronological
 * in a way that cannot be parameterised out:
 *
 *   - its axis keys are `day(t)`, sorted — a calendar. Bins are NAMES, and
 *     sorting `['Thu','Fri','Sat']` gives `['Fri','Sat','Thu']`, which is a
 *     week that does not exist;
 *   - a LINE asserts that the metric passed through every value between two
 *     samples. Between "readers awake at 14:00" and "readers awake at 15:00"
 *     there is nothing to pass through — the quantity is an aggregate OF the
 *     bin, not a sample at an instant;
 *   - `delta()` — first → last — is the sentence `TimeSeries` speaks, and on a
 *     cyclical axis the first and last bins are neighbours. "Down 40% from
 *     00:00 to 23:00" is arithmetic performed on a circle.
 *
 * So the marks are BARS from a zero baseline (see `bandScales` for why the
 * axis cannot be truncated), the axis order is the caller's, and the summary
 * sentence answers where the peak is rather than which way it went.
 *
 * ## The reference is the whole point, and it shares one domain
 *
 * A distribution on its own answers "when did this happen". The question worth
 * asking is almost always "when did this happen *against what was available*"
 * — reading against readers awake, incidents against traffic, deploys against
 * working hours. The gap between the bars and the reference IS the finding.
 *
 * Both series therefore share ONE y domain, exactly as in `TimeSeries`, and for
 * the same reason: two axes let an author slide one against the other until
 * they cross where the argument needs them to. That means the reference must
 * be in the SAME unit as the bars — usually both as shares of their own
 * denominator ("% of the week's reading" vs "% of readers awake"). A reference
 * in raw counts against bars in percent is not a chart this component will
 * draw honestly, and the fix is arithmetic in the caller, not a second axis.
 *
 * ## An unmeasured bin is not an empty bin
 *
 * This is where a bar chart is at its most dangerous: a bar of height zero and
 * a bar that was never drawn are the SAME PICTURE. Everywhere else in the
 * package a `null` can simply be skipped; here skipping it silently asserts a
 * zero. So an unmeasured bin gets a diagonal hatch across the full height of
 * its slot — the same mark `not-counted` carries in `DataStateBadge` and
 * `Meter` — and the accessible sentence counts them out loud.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The plot is `viewBox`-scaled with no fixed width, the x labels are real HTML
 * (SVG text in this box paints at 4px at a 320 viewport — measured, not
 * reasoned about), the label row thins to its ends below `sm`, and the data
 * table scrolls inside its own box.
 *
 * ## Anatomy
 *
 *   <figure data-slot="distribution" data-min-viewport="320" data-peak-bin="14">
 *     <figcaption>{label}</figcaption>
 *     <ul data-slot="distribution-legend" />        // only with a reference
 *     <svg data-slot="distribution-plot" role="img" tabIndex={0}>
 *       <rect data-slot="distribution-gap" />       // hatched: not measured
 *       <rect data-slot="distribution-bar" />       // observed
 *       <path data-slot="distribution-reference" /> // step, never sloped
 *     </svg>
 *     <div data-slot="distribution-axis" />         // HTML labels + notes
 *     <div data-slot="distribution-readout"><output aria-live="polite" /></div>
 *     <SeriesTable axis="category" />
 *   </figure>
 *
 * | Rule | Concept                    | Where in this file                                        |
 * | ---- | -------------------------- | --------------------------------------------------------- |
 * | R6   | data-slot on every part    | `"distribution" / "-plot" / "-bar" / "-gap" / "-axis"`     |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                                   |
 * | R8   | No `isXxx`; enums          | `axis="category"` downstream; no boolean modes             |
 * | R10  | Composition seams          | `<SeriesTable>` renders the data; the caller owns the bins |
 * | R13  | Ecosystem first            | no charting dep — `bandScales` + SVG is the engine         |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`                 |
 * | R18  | Tailwind only              | zero inline `style`                                        |
 * | R19  | Tokens only                | `fill-chart-1`, `stroke-chart-2`, `stroke-viz-axis`        |
 * | R20  | AA contrast                | axis + hatch on `--viz-axis` (3.49:1 light / 3.83:1 dark)  |
 * | R23  | Absence is a vocabulary    | `loading` / `error` / no-bins / unmeasured-bin are four    |
 * | R25  | Client component           | pointer + key handlers, `useState`                         |
 * | R26  | A11y                       | `role="img"` + label + focusable + live readout + table    |
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
  axisSlots,
  bandScales,
  describeDistribution,
  keepAtNarrow,
  peakBin,
  slotAt,
  stepPath,
  ticks,
  type Bin,
} from './scale.js';

export const MIN_VIEWPORT = 320 as const;

/** Internal drawing width in user units. The viewBox scales it to any container. */
const W = 900;
const PAD_LEFT = 44;
const PAD_TOP = 14;

/** `PAD_LEFT` as a percentage of `W`, so the HTML label row starts where the plot does. */
const AXIS_PAD_LEFT = 'pl-[4.889%]';

/**
 * At most eight x labels.
 *
 * `TimeSeries` caps at five because its labels are dates (`08-14`, five
 * characters, and the middles drop below `sm`). Bin labels are shorter by
 * nature — an hour, a weekday abbreviation — and eight is what lets a 24-bin
 * clock label every third bin, which is the granularity at which a reader can
 * still find "about 3pm" without counting.
 */
const MAX_LABELS = 8;

/** Share of its band a bar occupies. The rest is the gutter that separates them. */
const BAR_WIDTH = 0.7;

/** The name a reader sees. One fallback, used by the legend, readout and table alike. */
const named = (label: string | undefined, fallback: string): string => label ?? fallback;

/** One bin, plus the two things a bin can carry that a `Point` cannot. */
export interface DistributionBin extends Bin {
  /**
   * A second reading of the same slot, on ANOTHER axis family — "09:00" under
   * "14:00 UTC", "Q3" under "Jul".
   *
   * This is the honest replacement for the UTC/local toggle every clock chart
   * hand-rolls. A toggle shows one axis and hides the other, so a reader
   * comparing their own morning against a UTC peak has to hold one of the two
   * in their head; and the hidden one is missing from any screenshot of the
   * chart. Both readings are printed, and both travel into the readout and the
   * data table.
   */
  note?: string;
  /**
   * This bin's REFERENCE value, in the same unit as `v`.
   *
   * On the bin rather than in a parallel array on purpose: a
   * `reference: number[]` beside `bins` is an off-by-one waiting to happen, and
   * the failure is silent — every bar simply lines up against its neighbour's
   * reference.
   */
  reference?: number | null;
}

export interface DistributionProps
  extends Omit<React.ComponentProps<'figure'>, 'children'> {
  /**
   * The bins, in the order they belong on the axis. That order is the axis —
   * nothing here sorts them.
   */
  bins: readonly DistributionBin[];
  /** Name of the plotted quantity — used in the caption, label, readout and table. */
  label?: string;
  /** Noun for the values, e.g. "views", "%". */
  unit?: string;
  /** Name of the reference overlay. Drawn whenever any bin has a `reference`. */
  referenceLabel?: string;
  /** Column header for the bin column of the data table — "Hour", "Weekday". */
  binLabel?: string;
  /** Drawing height in user units. The rendered height follows the container width. */
  height?: number;
  /** Render the data table visibly under the chart instead of `sr-only`. */
  showTable?: boolean;
  /** Render a `<Skeleton variant="chart" />` placeholder at the chart's own height. */
  loading?: boolean;
  /**
   * The fetch failed. A different statement from "every bin is empty", which is
   * a real and interesting finding about the subject; this is a fact about the
   * request. Ranked directly under `loading`, per `DATA_STATES`.
   */
  error?: unknown;
  /** Context for the absence sentences — noun, coverage, reason. */
  announce?: AnnouncementOptions;
}

export const Distribution = React.forwardRef<HTMLElement, DistributionProps>(
  function Distribution(
    {
      bins,
      label,
      unit,
      referenceLabel,
      binLabel = 'Bin',
      height = 220,
      showTable = false,
      loading = false,
      error,
      announce,
      className,
      ...props
    },
    ref,
  ) {
    const [cursor, setCursor] = React.useState<number | null>(null);
    const svgRef = React.useRef<SVGSVGElement>(null);

    // React's generated ids contain `:`, which is legal in an id and awkward
    // everywhere else. The pattern is referenced by `url(#…)`, and one hatch
    // definition per instance is what keeps two charts on one page from
    // sharing — and then fighting over — a single `<pattern id="hatch">`.
    const hatchId = `distribution-hatch-${React.useId().replace(/[^\w-]/g, '')}`;

    const values = React.useMemo(() => bins.map((bin) => bin.v), [bins]);
    const references = React.useMemo(
      () => bins.map((bin) => bin.reference ?? null),
      [bins],
    );

    // "Is there a reference to draw" is exactly "does any bin have a measured
    // reference", which `peakBin` already answers — rather than a second
    // hand-rolled scan that could disagree with the one the axis uses.
    const hasReference = peakBin(references) !== null;

    const plot = React.useMemo(
      () => bandScales([values, references], W - PAD_LEFT, height, PAD_TOP),
      [values, references, height],
    );
    const px = React.useCallback((slot: number) => PAD_LEFT + plot.x(slot), [plot]);

    const axisTicks = React.useMemo(
      () => ticks({ points: bins, min: plot.min, max: plot.max }, 4),
      [bins, plot],
    );
    const labelSlots = React.useMemo(
      () => axisSlots(bins.length, MAX_LABELS),
      [bins.length],
    );
    const labelPosition = React.useMemo(
      () => new Map(labelSlots.map((slot, index) => [slot, index])),
      [labelSlots],
    );

    const last = bins.length - 1;
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
      // The pointer lands in a BAND, not near a vertex — `slotAt`, not
      // `nearestSlot`. A bar owns its whole band, and rounding to the closest
      // centre would highlight a bin the pointer is visibly not over.
      move(slotAt(bins.length, userX, W - PAD_LEFT));
    };

    // Loading and error are resolved before every "there is nothing to draw"
    // branch, through the same function `StatStrip` and `Meter` use — data in
    // flight and data that failed to arrive are two claims, and neither is the
    // claim "this subject has no distribution".
    //
    // Every hook above runs unconditionally, so no prop can change hook order.
    const absence = resolveDataState({ loading, error }, announce);

    if (absence.state === 'loading') {
      return (
        <Skeleton
          variant="chart"
          data-slot="distribution"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={className}
        />
      );
    }

    if (absence.state === 'error') {
      return (
        <figure
          ref={ref}
          data-slot="distribution-error"
          data-state="error"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={cn(
            'm-0 w-full rounded-lg border border-destructive/40 p-6',
            className,
          )}
          {...props}
        >
          <p role="alert" className="text-sm text-destructive">
            {announceDataState('error', announce)} The shape of this
            distribution is unknown, not flat.
          </p>
        </figure>
      );
    }

    // No BINS at all — there is no axis to draw, which is a different thing
    // from an axis whose bins were never measured. That second case renders
    // below as a plot full of hatch, because "we looked at all 24 hours and
    // measured none of them" is a finding and an empty box is not.
    if (bins.length === 0) {
      return (
        <figure
          ref={ref}
          data-slot="distribution-empty"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={cn('m-0 w-full rounded-lg border border-border p-6', className)}
          {...props}
        >
          <p className="text-sm text-muted-foreground">
            No bins to plot. A distribution needs the set of slots it is spread
            across, even when every one of them is empty.
          </p>
        </figure>
      );
    }

    const peak = peakBin(values);
    const referenceName = named(referenceLabel, 'Reference');
    const primaryName = named(label, 'Value');

    /** `label` and its second axis reading, as one string. */
    const binKey = (bin: DistributionBin): string =>
      bin.note ? `${bin.label} (${bin.note})` : bin.label;

    const spoken = (value: number | null): string =>
      value === null
        ? 'not measured'
        : `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;

    /**
     * The crosshair readout, for BOTH the pointer and the keyboard. One string,
     * built once, rendered once — the same rule `TimeSeries` follows, for the
     * same reason: a second hover-only surface can be right while the live
     * region is wrong, and only a sighted mouse user would ever find out.
     */
    const readout =
      cursor === null
        ? ''
        : [
            binKey(bins[cursor]),
            hasReference
              ? `${primaryName} ${spoken(values[cursor])}`
              : spoken(values[cursor]),
            ...(hasReference
              ? [`${referenceName} ${spoken(references[cursor])}`]
              : []),
          ].join(' · ');

    const referencePath = stepPath(references, plot);
    const tableSeries = [
      { label: primaryName, points: bins.map((bin) => ({ t: binKey(bin), v: bin.v })) },
      ...(hasReference
        ? [
            {
              label: referenceName,
              points: bins.map((bin) => ({ t: binKey(bin), v: bin.reference ?? null })),
            },
          ]
        : []),
    ];

    return (
      <figure
        ref={ref}
        data-slot="distribution"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-bin-count={String(bins.length)}
        // The peak, published rather than only drawn: "where does this peak"
        // is the first question a distribution is asked, and a caller should
        // not have to re-derive it from the same array to write a sentence
        // under the chart.
        data-peak-bin={peak === null ? undefined : String(peak)}
        // `w-full` is load-bearing: the plot sizes itself from the container
        // via `viewBox`, so a figure that collapses to zero width paints
        // nothing. See the same note in time-series.tsx.
        className={cn('m-0 flex w-full flex-col gap-2', className)}
        {...props}
      >
        {label && (
          <figcaption className="text-xs text-muted-foreground">
            {label}
            <span className="sr-only">, </span>
            <span aria-hidden> · </span>
            {bins.length} bins
          </figcaption>
        )}

        {hasReference && (
          <ul
            data-slot="distribution-legend"
            className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 text-xs text-muted-foreground"
          >
            <li className="flex items-center gap-1.5">
              {/* The swatch repeats the MARK, not only the hue: a filled block
                  for the bars, a dashed rule for the step. A legend of two
                  identical bars in two colours identifies nothing in
                  greyscale. */}
              <svg aria-hidden width={24} height={8} viewBox="0 0 24 8" className="shrink-0">
                <rect x={2} y={0} width={20} height={8} className="fill-chart-1" />
              </svg>
              {primaryName}
            </li>
            <li className="flex items-center gap-1.5">
              <svg aria-hidden width={24} height={8} viewBox="0 0 24 8" className="shrink-0">
                <line
                  x1={0}
                  y1={4}
                  x2={24}
                  y2={4}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  className="stroke-chart-2"
                />
              </svg>
              {referenceName}
            </li>
          </ul>
        )}

        <svg
          ref={svgRef}
          data-slot="distribution-plot"
          viewBox={`0 0 ${W} ${height}`}
          className={cn(
            'block w-full touch-pan-y rounded-md',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          )}
          role="img"
          aria-label={`${describeDistribution(bins, label, unit)}${
            hasReference
              ? ` ${describeDistribution(
                  bins.map((bin) => ({ label: bin.label, v: bin.reference ?? null })),
                  referenceName,
                  unit,
                )}`
              : ''
          } Focus this chart and use the left and right arrow keys to read individual bins.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setCursor(null)}
          onBlur={() => setCursor(null)}
        >
          <defs>
            {/* The hatch, as SVG rather than the `HATCH_CLASS` background used
                by `DataStateBadge`: a CSS background-image does not paint on an
                SVG shape, so the vocabulary's mark has to be re-expressed in
                the medium. Same angle, same token, same meaning. */}
            <pattern
              id={hatchId}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                className="stroke-viz-axis"
                strokeWidth={1}
              />
            </pattern>
          </defs>

          {axisTicks.map((value) => {
            const y = plot.y(value);
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
            y2={plot.y(plot.min)}
            className="stroke-viz-axis"
            strokeWidth={1}
            aria-hidden
          />
          {/* The baseline is ZERO, not the bottom of the box. On a bar chart
              they are the same line only when the domain has no negatives, and
              drawing the box edge instead is how a negative bar ends up
              hanging off an axis it never crosses. */}
          <line
            data-slot="distribution-baseline"
            x1={PAD_LEFT}
            y1={plot.zero}
            x2={W}
            y2={plot.zero}
            className="stroke-viz-axis"
            strokeWidth={1}
            aria-hidden
          />

          {bins.map((bin, index) => {
            const x = px(index) + (plot.band * (1 - BAR_WIDTH)) / 2;
            const width = plot.band * BAR_WIDTH;

            // Not measured. A skipped bar and a zero bar are the same picture,
            // so the slot says which one it is instead of staying blank.
            if (bin.v === null) {
              return (
                <rect
                  key={bin.label}
                  data-slot="distribution-gap"
                  data-state="not-counted"
                  x={px(index)}
                  y={PAD_TOP}
                  width={plot.band}
                  height={Math.max(0, plot.y(plot.min) - PAD_TOP)}
                  fill={`url(#${hatchId})`}
                  aria-hidden
                />
              );
            }

            const y = plot.y(bin.v);
            return (
              <rect
                key={bin.label}
                data-slot="distribution-bar"
                x={x}
                y={Math.min(y, plot.zero)}
                width={width}
                height={Math.abs(plot.zero - y)}
                rx={2}
                className="fill-chart-1"
                aria-hidden
              />
            );
          })}

          {referencePath && (
            <path
              data-slot="distribution-reference"
              // The step lives in unshifted scale space, like the series paths
              // in time-series.tsx, so one translate covers it and everything
              // positioned with `px()` stays on the other side of that seam.
              transform={`translate(${PAD_LEFT} 0)`}
              d={referencePath}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeDasharray="6 4"
              className="stroke-chart-2"
              aria-hidden
            />
          )}

          {cursor !== null && (
            <rect
              data-slot="distribution-cursor"
              x={px(cursor)}
              y={PAD_TOP}
              width={plot.band}
              height={Math.max(0, plot.y(plot.min) - PAD_TOP)}
              className="fill-viz-crosshair opacity-20"
              aria-hidden
            />
          )}
        </svg>

        {/* The x scale, in HTML at a real 12px. One cell per bin — including
            the unlabelled ones — because a flex row of equal cells is the only
            way to keep a label centred under its band at every width without
            an inline style. */}
        <div
          data-slot="distribution-axis"
          aria-hidden
          className={cn(
            'flex text-xs text-muted-foreground tabular-nums',
            AXIS_PAD_LEFT,
          )}
        >
          {bins.map((bin, index) => {
            const position = labelPosition.get(index);
            return (
              <span
                key={bin.label}
                className={cn(
                  'min-w-0 flex-1',
                  // A label is wider than its cell on any dense axis — 24 bins
                  // at a 320 viewport gives each cell ~11px and "00:00" wants
                  // 30. Spilling over an EMPTY neighbouring cell is harmless;
                  // spilling outside the row is not, because it is what makes
                  // the page scroll sideways. So the two labels that can only
                  // spill outward are pinned to the edges instead — the same
                  // thing `TimeSeries` gets from `justify-between`.
                  position === 0
                    ? 'text-start'
                    : position === labelSlots.length - 1
                      ? 'text-end'
                      : 'text-center',
                )}
              >
                {position === undefined ? null : (
                  <span
                    className={
                      keepAtNarrow(position, labelSlots.length)
                        ? undefined
                        : 'hidden sm:inline'
                    }
                  >
                    {bin.label}
                    {bin.note ? (
                      // Hierarchy by WEIGHT, not by opacity.
                      //
                      // This was `opacity-70`, and opacity is the one way to
                      // de-emphasise text that no token can protect you from:
                      // `--muted-foreground` is 8.06:1 on white, and the same
                      // colour at 70% composites to #827d77 — 4.07:1, under the
                      // AA floor for 12px text. The token measured fine; the
                      // rendered pixels did not, and only axe folding the
                      // ancestor opacity into the computed value caught it.
                      //
                      // Sharper still: `bin.note` exists BECAUSE a timezone
                      // toggle hides half the truth. Printing the second
                      // reading and then dimming it below AA is the same
                      // mistake wearing a different hat.
                      <span className="block font-normal">{bin.note}</span>
                    ) : null}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        <div
          data-slot="distribution-readout"
          className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs text-muted-foreground tabular-nums"
        >
          <span aria-hidden>{plot.min.toLocaleString()}</span>
          <output aria-live="polite" className="font-medium text-foreground">
            {readout}
          </output>
          <span aria-hidden>{plot.max.toLocaleString()}</span>
        </div>

        {/* `axis="category"` — the bins keep the caller's order. Sorting them
            is not merely unnecessary here, it is wrong: it would make the table
            disagree with the picture directly above it about what order the
            week happens in. */}
        <SeriesTable
          axis="category"
          keyLabel={binLabel}
          series={tableSeries}
          caption={
            hasReference
              ? `${primaryName}, ${referenceName} — full data`
              : `${primaryName} — full data${unit ? ` (${unit})` : ''}`
          }
          hidden={!showTable}
        />
      </figure>
    );
  },
);
