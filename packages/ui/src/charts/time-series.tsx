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
 * The pointer path and the keyboard path both resolve through `nearestSlot`,
 * so the two can never disagree about which point is under the crosshair.
 *
 * ## The weave draws itself — and never hides
 *
 * The plotted series (and the annotations that ride them) are clipped by a
 * rect that scales open left→right — the shuttle pass — on mount and again
 * whenever the drawn GEOMETRY genuinely changes. The draw verb's usual
 * mechanism (`animate-strand-draw`, stroke-dashoffset) is unavailable here:
 * this chart's dash patterns ARE series identity, and the dashoffset trick
 * would overwrite them. The reveal is pure CSS (`--animate-weave-reveal`),
 * so an SSR'd chart draws before hydration, and its keyframe is from-only:
 * the rect RESTS fully open, so under reduced motion, in jsdom, or in a
 * browser that cannot animate clip contents, nothing is ever hidden — the
 * failure mode is a chart that appears, never one that doesn't.
 *
 * "Genuinely changes" is a VALUE comparison (`geometry` below), not object
 * identity — a parent re-rendering with fresh array literals, the normal
 * React case, must not replay the draw. The same string resets the
 * crosshair, because a slot index into the previous geometry's keys would
 * pair the readout with the wrong date.
 *
 * ## Two points make a comparison, and the gesture is the same on both paths
 *
 * Marking a point (click, or Enter) sets an anchor; marking a second turns the
 * readout into a delta — absolute change, percentage, direction — and shades
 * the span between them. A third mark starts over. It is the gesture every
 * stock chart has, and the reason to state it here is that most of them
 * implement it as a pointer DRAG, which no keyboard user can perform. Both
 * paths run through one `select()`, for the same reason both crosshair paths
 * run through `nearestSlot`.
 *
 * The delta is rendered by `Delta`, not computed here, so the sign, the
 * percentage, the tone token and the WCAG 1.4.1 accessible name all come from
 * one place. `polarity` is forwarded because a chart of error rate or latency
 * means the opposite of a chart of downloads by a rise.
 *
 * Two refusals are deliberate. A point compared with itself clears the
 * selection rather than reporting a confident 0%, and a range with a gap at
 * either end shows nothing — bridging it would report a change that never
 * happened.
 *
 * ## There is no floating tooltip, and that is the design
 *
 * A tooltip that follows the pointer is a *second* inspection surface: it has
 * to be kept in step with the live readout a keyboard user gets, it has to be
 * positioned in viewport pixels while the plot is `viewBox` scaled, and at 320
 * it lands on top of the very points it describes. The readout row IS the
 * tooltip — it names the date and every series' value at the crosshair, it is
 * fed by the same slot the arrow keys move, and there is exactly one of it.
 *
 * ## Legibility at 320 — why the x labels are HTML and the y labels are not
 *
 * SVG text scales with the `viewBox`. At a 320 viewport the plot is 288px wide
 * against a 900-unit box, so `text-xs` inside the SVG paints at **4px** —
 * measured in Chrome, not reasoned about. The x labels are therefore real HTML
 * under the plot, where 12px means 12px, aligned to the plot by a percentage
 * pad that matches `PAD_LEFT`.
 *
 * The y labels stay in the SVG and do shrink with it; the y scale survives
 * because the readout row prints `min` and `max` as HTML at every width.
 * Moving them out needs a per-tick vertical offset, and percentage padding in
 * CSS resolves against *width* — that is a separate change, not a line of this
 * one.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The SVG scales to its container via `viewBox` (no fixed width), the readout
 * and legend wrap, the x axis drops to three labels below `sm`, and
 * `<SeriesTable>` scrolls inside its own box. Nothing forces the page to
 * scroll horizontally.
 *
 * | Rule | Concept                    | Where in this file                                       |
 * | ---- | -------------------------- | -------------------------------------------------------- |
 * | R6   | data-slot on every part    | `"time-series" / "-plot" / "-axis" / "-legend" / "-readout" / "-range" / "-comparison"` |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                                  |
 * | R8   | No `isXxx`; enums          | `polarity`; annotation `kind`                             |
 * | R13  | Ecosystem first            | no charting dep — `plotScales` + SVG is the engine        |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`                |
 * | R18  | Tailwind only              | zero inline `style`                                       |
 * | R19  | Tokens only                | `stroke-chart-1..5`, `stroke-viz-*`, `text-muted-foreground` |
 * | R20  | AA contrast                | axis 3.64:1 light / 3.82:1 dark; grid deliberately decorative |
 * | R23  | Loading reserves its box   | `loading` → `<Skeleton variant="chart">`, same height     |
 * | R23  | Absence is a vocabulary    | `loading` / `error` / not-enough-data are three messages  |
 * | R25  | Client component           | pointer + key handlers, `useState`                        |
 * | R26  | A11y                       | `role="img"` + label + focusable + live readout + table   |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import {
  announceDataState,
  resolveDataState,
  type AnnouncementOptions,
} from '../primitives/data-state.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Delta, type Polarity } from './delta.js';
import { SeriesTable } from './series-table.js';
import {
  areaPath,
  axisSlots,
  day,
  describeSeries,
  keepAtNarrow,
  linePath,
  nearestSlot,
  plotScales,
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
 * `PAD_LEFT` as a percentage of `W` (44 / 900), so the HTML x-axis row starts
 * exactly where the plot does at every width. The SVG scales; a px pad cannot.
 */
const AXIS_PAD_LEFT = 'pl-[4.889%]';

/**
 * How many series can be drawn at once.
 *
 * `--chart-1..5` is the whole identity palette, and there are five line styles
 * to pair with it. A sixth series would reuse both, which is two lines a reader
 * cannot tell apart — worse than a line that is not drawn. Series past the
 * fifth stay in `<SeriesTable>`, so nothing is lost, and the legend says so.
 */
const MAX_PLOTTED_SERIES = 5;

/**
 * Series identity is a DASH PATTERN first and a hue second — the same rule the
 * annotation marks follow, for the same reason. Two lines separated only by
 * `--chart-1` vs `--chart-2` are one line in a greyscale print, in a screenshot
 * pasted into Slack, and to a red-green colour-blind reader.
 *
 * Exported: `RadialWeave` draws the SAME series in another form, and series
 * three keeping its dash across forms is what makes the two charts one
 * instrument rather than two charts.
 */
export const SERIES_STYLE: readonly { stroke: string; fill: string; dash?: string }[] = [
  { stroke: 'stroke-chart-1', fill: 'fill-chart-1' },
  { stroke: 'stroke-chart-2', fill: 'fill-chart-2', dash: '12 6' },
  { stroke: 'stroke-chart-3', fill: 'fill-chart-3', dash: '2 6' },
  { stroke: 'stroke-chart-4', fill: 'fill-chart-4', dash: '18 6 2 6' },
  { stroke: 'stroke-chart-5', fill: 'fill-chart-5', dash: '12 6 2 6 2 6' },
];

/**
 * The name a reader sees. `<SeriesTable>` already spells an unlabelled series
 * "Value"; the legend, the readout and the table must not each invent their own
 * word for the same column.
 */
const named = (label?: string): string => label ?? 'Value';

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

/**
 * A series plotted alongside `points`.
 *
 * `label` is required, unlike the primary series' — with one line the
 * figcaption names it, but with two the name is the only thing that says which
 * line is which in the readout and the data table.
 */
export interface ComparisonSeries {
  points: readonly Point[];
  label: string;
  /** Noun for this series' values. Series in one chart rarely share a unit. */
  unit?: string;
}

/** Stable identity, so the plot memo does not recompute on every render. */
const NO_COMPARE: readonly ComparisonSeries[] = [];

export interface TimeSeriesProps extends Omit<React.ComponentProps<'figure'>, 'children'> {
  /**
   * Which direction counts as good, for the two-point comparison.
   *
   * `normal` (the default) colours a rise as positive. A chart of error rate,
   * latency, cost or bounce rate wants `inverse` — without it a 50% regression
   * is drawn in the same green as a 50% improvement, which is worse than not
   * colouring it at all.
   */
  polarity?: Polarity;
  points: readonly Point[];
  /**
   * Further series drawn against the same axes.
   *
   * `points` stays the required single-series prop it always was — every
   * existing call site and story is untouched — and this is purely additive.
   * The alternative (one required `series: Series[]`) would have been a rename
   * of the only prop this component has.
   *
   * All series share ONE y domain. That is the honest choice and it is not
   * configurable: a second y axis lets an author slide two unrelated metrics
   * until they appear to cross wherever the argument needs them to. A series
   * two orders of magnitude smaller will render as flat, which is the true
   * statement about it — give it its own chart, or a `MetricTable` row.
   */
  compare?: readonly ComparisonSeries[];
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
  /**
   * The fetch failed.
   *
   * `unknown` rather than `boolean` for the same reason `DataStateFlags.error`
   * is: a caught value can be handed straight through, and only its truthiness
   * is ever read — nothing here renders it, because a stack trace is not a
   * message for a reader.
   *
   * This is a different STATEMENT from an empty series, not a different
   * severity of one. "No data yet" says the metric has no history; a failed
   * request says the history is unknown, which is the one thing an empty-state
   * message cannot be allowed to claim. Ranked directly under `loading`, per
   * `DATA_STATES`.
   */
  error?: unknown;
  /** Context for the absence sentences — noun, coverage, reason. */
  announce?: AnnouncementOptions;
}

export const TimeSeries = React.forwardRef<HTMLElement, TimeSeriesProps>(function TimeSeries(
  {
    points,
    compare = NO_COMPARE,
    annotations = [],
    height = 220,
    label,
    unit,
    showTable = false,
    polarity = 'normal',
    loading = false,
    error,
    announce,
    className,
    ...props
  },
  ref,
) {
  const [cursor, setCursor] = React.useState<number | null>(null);
  // Range comparison. `anchor` is the point the reader marked; `fixed` is the
  // second one, once they have committed it. While `fixed` is null the live
  // cursor previews the range, which is what makes the gesture feel like a
  // drag without being one — a drag would be unavailable to the keyboard.
  const [anchor, setAnchor] = React.useState<number | null>(null);
  const [fixed, setFixed] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  // The primary series is series 0. Everything below indexes off this list, so
  // "the first line" and "the first table column" cannot come apart.
  // The primary keeps an OPTIONAL label so `describeSeries` still falls back to
  // "Series" for an unlabelled chart; `named()` supplies the visible fallback.
  const all: readonly { points: readonly Point[]; label?: string; unit?: string }[] =
    React.useMemo(() => [{ points, label, unit }, ...compare], [points, label, unit, compare]);
  const drawn = React.useMemo(() => all.slice(0, MAX_PLOTTED_SERIES), [all]);
  const undrawn = all.length - drawn.length;

  const plot = React.useMemo(
    () => plotScales(drawn.map((s) => s.points), W - PAD_LEFT, height - PAD_TOP, PAD_TOP),
    [drawn, height],
  );
  // Shift the plot right of the axis labels without threading an offset through
  // every scale call.
  const px = React.useCallback((slot: number) => PAD_LEFT + plot.x(slot), [plot]);

  const line = linePath(plot.series[0]);
  const axisTicks = React.useMemo(
    () => ticks({ points: plot.keys, min: plot.min, max: plot.max }, 4),
    [plot],
  );
  const xSlots = React.useMemo(() => axisSlots(plot.keys.length), [plot]);
  const slotByDay = React.useMemo(
    () => new Map(plot.keys.map((key, slot) => [key, slot])),
    [plot],
  );

  const last = plot.keys.length - 1;

  const move = React.useCallback(
    (next: number) => setCursor(Math.max(0, Math.min(last, next))),
    [last],
  );

  // `useId` may contain `:` (React 18) or `«»` (React 19), which break
  // inside a `url(#…)` reference — keep the alphanumeric core.
  const clipId = `ts-reveal-${React.useId().replace(/[^a-zA-Z0-9-]/g, '')}`;

  /**
   * The drawn geometry, named by VALUE — composition, key range, y domain.
   * Keys the reveal rect (a change remounts it, replaying the draw) and
   * resets the crosshair (an old slot index pairs the readout with the
   * wrong date). See "The weave draws itself" in the header.
   */
  const geometry = [
    drawn.map((s) => named(s.label)).join(','),
    plot.keys[0] ?? '',
    plot.keys[last] ?? '',
    plot.keys.length,
    plot.min,
    plot.max,
  ].join('|');

  // Reset DURING render, not in an effect: an effect fires after the new
  // geometry has already painted a frame with the stale cursor, and that
  // frame's readout — an `aria-live` region — would announce old-slot ×
  // new-keys. The render-phase state adjustment re-renders before commit,
  // so the mismatched frame never exists.
  const [drawnGeometry, setDrawnGeometry] = React.useState(geometry);
  if (drawnGeometry !== geometry) {
    setDrawnGeometry(geometry);
    setCursor(null);
    // A selection is a pair of SLOT INDICES. New keys make those indices point
    // at different dates, so a surviving range would silently re-label itself
    // — the same class of bug the cursor reset above exists to prevent.
    setAnchor(null);
    setFixed(null);
  }

  /**
   * Mark a point, or complete / restart a range.
   *
   * One function for both input paths, for the same reason `nearestSlot` is:
   * two selection code paths eventually disagree about which point is
   * selected, and the readout can only be right about one of them.
   */
  const select = React.useCallback(
    (slot: number) => {
      if (anchor === null) {
        setAnchor(slot);
        setFixed(null);
        return;
      }
      if (fixed === null) {
        // Re-selecting the anchor clears it. Without this, a mis-click leaves
        // a mark the reader can only remove by completing a range they did
        // not want.
        if (slot === anchor) setAnchor(null);
        else setFixed(slot);
        return;
      }
      // A complete range is replaced, not extended — the third mark starts
      // over, which is what every stock chart does and what a reader expects.
      setAnchor(slot);
      setFixed(null);
    },
    [anchor, fixed],
  );

  const clearSelection = React.useCallback(() => {
    setAnchor(null);
    setFixed(null);
  }, []);

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
      case 'Enter':
      case ' ':
        // The whole point of routing selection through the keyboard: a
        // comparison a mouse user can make and a keyboard user cannot is a
        // feature that does not exist for half its audience.
        select(cursor ?? 0);
        break;
      case 'Escape':
        setCursor(null);
        clearSelection();
        return; // no preventDefault — Escape may close an enclosing overlay
      default:
        return;
    }
    // Arrow keys scroll the page by default; a focused chart owns them.
    event.preventDefault();
  };

  /** Slot under a pointer event, or null when it cannot be determined. */
  const slotFrom = (event: React.PointerEvent<SVGSVGElement>): number | null => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const userX = ((event.clientX - box.left) / box.width) * W - PAD_LEFT;
    // `nearestSlot` clamps a number but propagates a non-number, and a NaN
    // slot renders as NaN in every x attribute it touches. This function
    // promises a slot OR null; returning NaN would break that promise at
    // every call site instead of here.
    if (!Number.isFinite(userX)) return null;
    return nearestSlot(plot.keys.length, userX, W - PAD_LEFT);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const slot = slotFrom(event);
    if (slot !== null) move(slot);
  };

  // `pointerup`, not `click`: the plot is `touch-pan-y`, so a touch that
  // scrolls the page still ends in a click on some browsers. Pointer events
  // also carry `pointerType`, which is how the touch path knows to place the
  // crosshair before selecting — a finger never hovered first.
  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const slot = slotFrom(event);
    if (slot === null) return;
    if (event.pointerType !== 'mouse') move(slot);
    select(slot);
  };

  // These live ABOVE the loading / error / empty branches because `comparison`
  // is a hook, and a hook after an early return is called conditionally —
  // React's cardinal rule. Lint caught it here rather than a user hitting
  // "rendered fewer hooks than expected" the first time a chart went from
  // loading to loaded with a range selected.
  //
  // The second edge of the band: the committed point when there is one, the
  // live cursor while the reader is still choosing.
  const rangeEnd = fixed ?? cursor;

  /**
   * The two points being compared, on the PRIMARY series, ordered by time so
   * the delta reads left-to-right regardless of which end was marked first.
   *
   * `null` whenever a comparison cannot honestly be shown: no committed range,
   * both ends on the same day, or a gap in the data at either end. The gap is
   * the interesting one — bridging it would invent a value and report a change
   * that never happened.
   */
  const comparison = React.useMemo((): readonly [Point, Point] | null => {
    if (anchor === null || fixed === null || anchor === fixed) return null;
    const [from, to] = anchor < fixed ? [anchor, fixed] : [fixed, anchor];
    const a = plot.at(0, from);
    const b = plot.at(0, to);
    if (a === null || b === null) return null;
    return [
      { t: plot.keys[from], v: a },
      { t: plot.keys[to], v: b },
    ];
  }, [anchor, fixed, plot]);

  // Loading and error are both checked BEFORE the not-enough-data branch: data
  // still in flight, and data that failed to arrive, are each a different claim
  // from "this metric has no history" — and telling a reader the last one while
  // either of the others is true is simply wrong. The order is `DATA_STATES`'
  // order, resolved by the same function every other surface in the package
  // uses, so a chart and a stat strip on one page cannot disagree about which
  // absence wins.
  //
  // Every hook above this point runs unconditionally — the guards sit after them
  // on purpose, so toggling `loading` never changes the hook order.
  const absence = resolveDataState({ loading, error }, announce);

  if (absence.state === 'loading') {
    return (
      <Skeleton
        variant="chart"
        data-slot="time-series"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={className}
      />
    );
  }

  if (absence.state === 'error') {
    return (
      <figure
        ref={ref}
        data-slot="time-series-error"
        data-state="error"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(
          'm-0 w-full rounded-lg border border-destructive/40 p-6',
          className,
        )}
        {...props}
      >
        {/* `role="alert"` and not the muted empty-state paragraph. The reader
            has to be able to tell "we asked and could not find out" from "we
            asked and the answer was nothing" — those license different
            conclusions, and only one of them is about the metric. */}
        <p role="alert" className="text-sm text-destructive">
          {announceDataState('error', announce)} The history is unknown, not
          absent — this is not an empty series.
        </p>
      </figure>
    );
  }

  // Below two points there is no line to draw. Say why, rather than rendering an
  // empty box that reads as a bug — a series genuinely cannot be back-filled.
  //
  // The test is the PRIMARY series, not the union: a chart whose headline
  // metric has one reading is not rescued by a comparison series that has
  // fourteen, and drawing the comparison alone under the primary's caption
  // would attribute one metric's shape to another.
  if (!line) {
    const own = plot.series[0].points.length;
    return (
      <figure
        ref={ref}
        data-slot="time-series-empty"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('m-0 w-full rounded-lg border border-border p-6', className)}
        {...props}
      >
        <p className="text-sm text-muted-foreground">
          {own === 0 ? 'No data yet.' : `Only ${own} point so far.`}{' '}
          A trend needs at least two observations, and history cannot be back-filled.
        </p>
      </figure>
    );
  }

  /**
   * The crosshair readout, for BOTH the pointer and the keyboard.
   *
   * One string, built once, rendered once. The moment a hover tooltip renders
   * its own copy of this it becomes a thing that can be right while the live
   * region is wrong, and only the sighted mouse user would ever find out.
   *
   * The series name is included only when there is more than one — with a
   * single line the figcaption already names it, and prefixing every readout
   * with a name the reader can see two lines up is noise in a live region.
   */
  const readout =
    cursor === null
      ? ''
      : [
          plot.keys[cursor],
          ...drawn.map((series, index) => {
            const value = plot.at(index, cursor);
            const name = drawn.length > 1 ? `${named(series.label)} ` : '';
            return value === null
              ? `${name}no data`
              : `${name}${value.toLocaleString()}${series.unit ? ` ${series.unit}` : ''}`;
          }),
        ].join(' · ');

  return (
    <figure
      ref={ref}
      data-slot="time-series"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-series-count={String(drawn.length)}
      // `w-full` is load-bearing, not cosmetic. The plot sizes itself from the
      // container via `viewBox` + `w-full`, so a figure that collapses to
      // zero width paints NOTHING — and a bare <figure> is a flex/grid item
      // that does exactly that inside any centered parent. Caught in the
      // browser; jsdom reports every box as 0×0 and cannot see it.
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

      {/* The legend is only drawn when there is something to tell apart. With
          one series it would restate the figcaption directly beneath it. */}
      {drawn.length > 1 && (
        <ul
          data-slot="time-series-legend"
          className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 text-xs text-muted-foreground"
        >
          {drawn.map((series, index) => (
            <li key={named(series.label)} className="flex items-center gap-1.5">
              {/* The swatch repeats the line's DASH, not only its hue, so the
                  legend identifies the same way the plot does. A row of five
                  identical bars in five colours identifies nothing in
                  greyscale. */}
              <svg
                aria-hidden
                width={24}
                height={8}
                viewBox="0 0 24 8"
                className="shrink-0"
              >
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
          {undrawn > 0 && (
            <li>{`${undrawn} more not plotted — see the data table`}</li>
          )}
        </ul>
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
        aria-label={`${drawn
          .map((series) => describeSeries(series.points, series.label))
          .join(' ')} Focus this chart and use the left and right arrow keys to read individual values. Press Enter to mark a point, then Enter again on a second point to compare the two.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onBlur={() => setCursor(null)}
      >
        {/* The reveal clip. The rect is keyed by `geometry`, so a genuine
            change of shape remounts it and the CSS animation runs again —
            no JS drives it. `origin-left` + `fill-box` anchor the scale to
            the rect's own left edge, wherever the referencing group sits. */}
        <defs>
          <clipPath id={clipId}>
            <rect
              key={geometry}
              x={0}
              y={0}
              width={W}
              height={height}
              className="animate-weave-reveal origin-left [transform-box:fill-box]"
            />
          </clipPath>
        </defs>

        {/* Grid + axis. Decorative weight for the lines, real contrast for the
            labels — the label is what tells you where zero is. Deliberately
            OUTSIDE the reveal clip: the scale is the stage, the series is
            the performance. */}
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
          y2={height}
          className="stroke-viz-axis"
          strokeWidth={1}
          aria-hidden
        />

        {/* The x axis: a baseline and a tick per labelled slot. The tick is what
            makes the HTML label below it point at a position rather than float
            in the general area — the labels themselves cannot live in here,
            because SVG text at this viewBox paints 4px wide at a 320 viewport. */}
        <line
          x1={PAD_LEFT}
          y1={height}
          x2={W}
          y2={height}
          className="stroke-viz-axis"
          strokeWidth={1}
          aria-hidden
        />
        {xSlots.map((slot) => (
          <line
            key={`tick-${plot.keys[slot]}`}
            data-slot="time-series-tick"
            x1={px(slot)}
            y1={height - 6}
            x2={px(slot)}
            y2={height}
            className="stroke-viz-axis"
            strokeWidth={1}
            aria-hidden
          />
        ))}

        {/* The series paths are built in unshifted scale space, so they live in
            one translated group. Everything outside this <g> — annotations,
            crosshair — positions with `px()`, which adds the same offset.
            Two ways to say "left edge" in one file is how coordinate bugs
            start; this is the seam between them. */}
        <g transform={`translate(${PAD_LEFT} 0)`} clipPath={`url(#${clipId})`}>
          {/* The area fill is a one-series affordance. Two translucent fills
              overlap into a third colour that belongs to neither series and
              reads as a value. */}
          {drawn.length === 1 && (
            <path
              d={areaPath(plot.series[0], height)}
              className="fill-chart-1 opacity-10"
              aria-hidden
            />
          )}
          {plot.series.map((series, index) => (
            <path
              key={`line-${named(drawn[index].label)}`}
              d={linePath(series)}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={SERIES_STYLE[index].dash}
              className={SERIES_STYLE[index].stroke}
            />
          ))}
        </g>

        {/* Annotations share the reveal clip, so a mark sweeps in with the
            line it explains rather than floating over a not-yet-drawn one. */}
        <g clipPath={`url(#${clipId})`}>
        {annotations.map((annotation) => {
          const index = slotByDay.get(day(annotation.t));
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
        </g>

        {/* The crosshair GLIDES between slots: the group carries the x
            position as one transform, which CSS transitions between steps
            (a `line` x1/x2 is not a transitionable property; a transform
            is). 150ms trails the readout, which snaps — the readout is the
            record, the glide is the gesture, and the dot always LANDS on
            the true value. `motion-reduce` snaps the glyph too. */}
        {/* The comparison band. Drawn BEFORE the crosshair so the crosshair
            stays readable on top of it, and `aria-hidden` because the readout
            below states the range in words — a shaded rectangle is not
            information a screen reader can use. */}
        {anchor !== null && rangeEnd !== null && (
          <g data-slot="time-series-range" aria-hidden>
            <rect
              x={Math.min(px(anchor), px(rangeEnd))}
              y={PAD_TOP}
              width={Math.abs(px(rangeEnd) - px(anchor))}
              height={height - PAD_TOP}
              className="fill-viz-crosshair opacity-10"
            />
            {[anchor, rangeEnd].map((slot, index) => (
              <line
                key={`edge-${index === 0 ? 'anchor' : 'end'}`}
                x1={px(slot)}
                y1={PAD_TOP}
                x2={px(slot)}
                y2={height}
                className="stroke-viz-crosshair opacity-60"
                strokeWidth={1}
                // The committed end is solid; a live preview is dashed, so a
                // reader can tell a finished comparison from one in progress
                // without reading the text.
                strokeDasharray={index === 1 && fixed === null ? '3 3' : undefined}
              />
            ))}
          </g>
        )}

        {cursor !== null && (
          <g
            aria-hidden
            transform={`translate(${px(cursor)} 0)`}
            className="transition-transform duration-150 ease-out motion-reduce:transition-none"
          >
            <line
              x1={0}
              y1={PAD_TOP}
              x2={0}
              y2={height}
              className="stroke-viz-crosshair opacity-50"
              strokeWidth={1}
            />
            {/* A dot per series that HAS a reading here. A series with a gap on
                this day gets no dot rather than one parked on the line segment
                that bridges the gap — that dot would be an invented value. */}
            {plot.series.map((series, index) => {
              const value = plot.at(index, cursor);
              return value === null ? null : (
                <circle
                  key={`dot-${named(drawn[index].label)}`}
                  cx={0}
                  cy={plot.y(value)}
                  r={4}
                  className={cn(
                    'stroke-background transition-[cy] duration-150 ease-out motion-reduce:transition-none',
                    SERIES_STYLE[index].fill,
                  )}
                  strokeWidth={2}
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* The x scale, in HTML. Below `sm` only the ends and the midpoint are
          rendered — `hidden` removes them from the flex row, so the survivors
          re-spread rather than leaving gaps where the dropped labels were. */}
      <div
        data-slot="time-series-axis"
        aria-hidden
        className={cn(
          'flex justify-between text-xs text-muted-foreground tabular-nums',
          AXIS_PAD_LEFT,
        )}
      >
        {xSlots.map((slot, index) => (
          <span
            key={plot.keys[slot]}
            className={keepAtNarrow(index, xSlots.length) ? undefined : 'hidden sm:inline'}
          >
            {/* MM-DD. The year is in the figcaption and the full ISO date is in
                the readout and the table; repeating it here is 10 characters
                per label, which is what makes five of them collide at 320. */}
            {plot.keys[slot].slice(5)}
          </span>
        ))}
      </div>

      {/* The readout is both the tooltip and the live region. One element, so a
          keyboard user and a mouse user are never told different things. */}
      <div
        data-slot="time-series-readout"
        className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs text-muted-foreground tabular-nums"
      >
        <span aria-hidden>{plot.min.toLocaleString()}</span>
        <output aria-live="polite" className="font-medium text-foreground">
          {comparison ? (
            <span
              data-slot="time-series-comparison"
              className="flex flex-wrap items-baseline gap-x-2"
            >
              <span>
                {comparison[0].t} → {comparison[1].t}
              </span>
              {/* Delta owns the sign, the percentage, the tone token and the
                  screen-reader phrasing. Re-deriving any of that here would
                  give this chart its own opinion about what "up" looks like,
                  which is what a design system exists to prevent. */}
              <Delta points={comparison} unit={unit} percent polarity={polarity} />
              {/* The crosshair reading, kept ALONGSIDE the locked range.
                  Without it this live region freezes the moment a comparison
                  completes: its content stops changing, so every later arrow
                  key announces nothing and a screen-reader user cannot tell
                  the keys still work. It is also what a reader wants — the
                  range, and the point they are on. */}
              {readout ? (
                <span className="font-normal text-muted-foreground">{readout}</span>
              ) : null}
            </span>
          ) : (
            readout
          )}
        </output>
        <span aria-hidden>{plot.max.toLocaleString()}</span>
      </div>

      {/* Every series, including any past `MAX_PLOTTED_SERIES`. The cap is a
          drawing limit, never a data limit — the table stays lossless. */}
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
