/**
 * @interlace/ui — chart scales and series math
 *
 * Every number a chart draws comes from here. Nothing in this file imports
 * React, touches the DOM, or renders anything — which is the point: it is the
 * part of a visualisation that can be *proved* correct, so it carries the
 * 100/100/100/100 coverage gate while the SVG above it is checked by stories
 * and axe.
 *
 * There is no charting dependency, and that is a decision rather than an
 * omission. A shadcn-registry item must install from a bare `npx shadcn add`
 * with every import resolvable, and d3/recharts/visx each want to own layout.
 * The named exit: if one surface ever needs >5k points with a live crosshair,
 * *that component* goes to canvas — it does not drag a library into the other
 * twenty. See VISUALIZATION_PHILOSOPHY.md.
 */

/** One observation. `v: null` is a real gap in the data, not a zero. */
export interface Point {
  /** ISO date, or any string that sorts correctly. */
  t: string;
  v: number | null;
}

/** A mark drawn ON the series — a publish, a release, a manual action. */
export interface Annotation {
  t: string;
  label: string;
  kind?: AnnotationKind;
}

export const ANNOTATION_KINDS = ['publish', 'release', 'action'] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];

/** Direction of travel. `flat` exists so callers never have to treat 0 as "up". */
export type Direction = 'up' | 'down' | 'flat';

/** A point that survived `numeric()` — `v` is narrowed to a number. */
export type NumericPoint = { t: string; v: number };

/**
 * Drop the gaps.
 *
 * A `null` is not plottable and must not become a 0 — a day we did not measure
 * is not a day the metric was zero, and averaging over it silently invents
 * data. Callers that want interpolation must ask for it explicitly.
 */
export const numeric = (points: readonly Point[]): NumericPoint[] =>
  points.filter((p): p is NumericPoint => typeof p.v === 'number' && Number.isFinite(p.v));

/** The x/y projectors plus the observed domain, for one series in one box. */
export interface Scales {
  points: NumericPoint[];
  x: (index: number) => number;
  y: (value: number) => number;
  min: number;
  max: number;
}

/**
 * Project a series into an SVG box.
 *
 * Two edge cases are handled here rather than in every component:
 *
 *  - **A single point** has no horizontal extent, so it is centred instead of
 *    being pinned to x=0 where it reads as the start of a line that never drew.
 *  - **A flat series** has a zero span. Dividing by it yields NaN, and clamping
 *    the span to 1 would pin the line to the top edge — which looks like a
 *    metric at its maximum rather than one that never moved. It is centred.
 */
export function seriesScales(
  points: readonly Point[],
  width: number,
  height: number,
  pad = 4,
): Scales {
  const pts = numeric(points);
  const values = pts.map((p) => p.v);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min;
  const last = pts.length - 1;

  const x = (index: number): number => (last > 0 ? (index / last) * width : width / 2);

  const y = (value: number): number =>
    span === 0 ? height / 2 : height - pad - ((value - min) / span) * (height - pad * 2);

  return { points: pts, x, y, min, max };
}

/**
 * Several series projected into ONE box: one x axis, one y domain.
 *
 * ## Why the axis is the union of days and not "series 0 wins"
 *
 * Letting the first series own the axis is a line of code cheaper and drops
 * every reading the others took on a day the first one missed — silently, and
 * only in the picture, so the `<SeriesTable>` beside it would still list them.
 * A chart that disagrees with its own table is worse than no chart. The x axis
 * is therefore the sorted union of `day(t)` across every series, exactly the
 * key set `<SeriesTable>` builds, and a series simply has no vertex at a slot
 * it did not measure.
 *
 * ## Why there is one y domain and never two
 *
 * A second y axis lets an author slide two unrelated series until they appear
 * to cross where the argument needs them to. The domain here is the union of
 * every value, so a series that is genuinely two orders of magnitude smaller
 * *renders* as flat — which is the true statement about it. Plot it as its own
 * chart, or as a `MetricTable` row.
 */
export interface PlotScales {
  /** Sorted union of `day(t)` across every series. Slot i is `keys[i]`. */
  keys: string[];
  /** Slot index → user-unit x. */
  x: (slot: number) => number;
  /** Value → user-unit y. Shared, so two lines are on one scale. */
  y: (value: number) => number;
  min: number;
  max: number;
  /** One projector per input series, in input order, sharing the axis above. */
  series: Scales[];
  /** A series' value at a slot. `null` = that series has no reading that day. */
  at: (seriesIndex: number, slot: number) => number | null;
}

/**
 * Project several series onto one shared axis.
 *
 * Two readings on the same day collapse to the last one, which is the rule
 * `<SeriesTable>` already applies — the alternative is a chart and a table that
 * report a different number for the same date.
 */
export function plotScales(
  series: readonly (readonly Point[])[],
  width: number,
  height: number,
  pad = 4,
): PlotScales {
  const byKey = series.map((points) => new Map(numeric(points).map((p) => [day(p.t), p.v])));
  const keys = [...new Set(byKey.flatMap((m) => [...m.keys()]))].sort();
  const slotOf = new Map(keys.map((key, slot) => [key, slot]));

  const values = byKey.flatMap((m) => [...m.values()]);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min;
  const lastSlot = keys.length - 1;

  const x = (slot: number): number => (lastSlot > 0 ? (slot / lastSlot) * width : width / 2);
  const y = (value: number): number =>
    span === 0 ? height / 2 : height - pad - ((value - min) / span) * (height - pad * 2);

  return {
    keys,
    x,
    y,
    min,
    max,
    // Each entry is an ordinary `Scales`, so `linePath` / `areaPath` need no
    // multi-series variant: only the meaning of the index changes, and it
    // stays private to this closure.
    series: byKey.map((m) => {
      const points: NumericPoint[] = keys
        .filter((key) => m.has(key))
        .map((key) => ({ t: key, v: m.get(key)! }));
      return { points, x: (index) => x(slotOf.get(points[index].t)!), y, min, max };
    }),
    at: (seriesIndex, slot) => byKey[seriesIndex].get(keys[slot]) ?? null,
  };
}

/**
 * Which slots get a labelled tick.
 *
 * Evenly spaced and capped, because the x labels are HTML at a fixed 12px while
 * the plot they sit under is `viewBox`-scaled — at 320 the plot is 288px wide
 * and a label per observation would overlap long before the reader ran out of
 * dates. Returns fewer than `max` when the series is shorter, and never repeats
 * a slot.
 */
export function axisSlots(count: number, max = 5): number[] {
  if (count <= 0) return [];
  if (max < 2 || count === 1) return [0];
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const last = count - 1;
  return [...new Set(Array.from({ length: max }, (_, i) => Math.round((i / (max - 1)) * last)))];
}

/**
 * Which of a set of evenly spaced labels survive below `sm`: the two ends, plus
 * the midpoint when the count is odd.
 *
 * Five five-character labels clear a 288px plot by ~12px and a longer format
 * would not — so the narrow case drops to three rather than depending on the
 * labels staying short. The ENDS are never dropped, because the ends are the
 * range; a chart whose axis has lost its last label has lost its scale.
 *
 * Lives here rather than in a component because two charts now thin the same
 * axis, and two copies of this predicate is how one of them ends up dropping an
 * end label at a width the other survives.
 */
export const keepAtNarrow = (index: number, count: number): boolean =>
  index === 0 || index === count - 1 || index === (count - 1) / 2;

/** An SVG path `d` for the series polyline. Empty string for <2 points. */
export const linePath = (scales: Scales): string =>
  scales.points.length < 2
    ? ''
    : scales.points.map((p, i) => `${i ? 'L' : 'M'}${scales.x(i)},${scales.y(p.v)}`).join('');

/** The polyline closed down to the baseline, for an area fill. */
export const areaPath = (scales: Scales, height: number): string => {
  const line = linePath(scales);
  if (!line) return '';
  return `${line}L${scales.x(scales.points.length - 1)},${height}L${scales.x(0)},${height}Z`;
};

// ── Distributions: a quantity spread over bins, not over time ───────────────

/**
 * One slot of a distribution.
 *
 * `label` is the identity as well as the name — a distribution's axis is a list
 * of NAMES (hours of the day, weekdays, cohorts), not a list of instants, so
 * there is no `t` to key it by and nothing sensible to sort it into. The order
 * the caller passes IS the axis.
 *
 * `v: null` carries the same meaning it does on a `Point`: this bin was not
 * measured. It is emphatically not a zero, and here that distinction is sharper
 * than anywhere else in the package — a bar of height zero and a bar that was
 * never drawn are the same picture, so the component has to draw something
 * else entirely.
 */
export interface Bin {
  label: string;
  v: number | null;
}

/** A band (categorical) x scale plus a zero-anchored y scale. */
export interface BandScales {
  /** Width of one bin's slot in user units. */
  band: number;
  /** Bin index → the LEFT edge of its slot. */
  x: (index: number) => number;
  /** Bin index → the CENTRE of its slot, where a per-bin mark belongs. */
  centre: (index: number) => number;
  /** Value → user-unit y. */
  y: (value: number) => number;
  /** The y of zero — where every bar starts and ends. */
  zero: number;
  min: number;
  max: number;
}

/**
 * Project one or more bin series into an SVG box, sharing ONE domain.
 *
 * ## Why this is not `seriesScales` with a different x
 *
 * The y domain. `seriesScales` fits the OBSERVED band, deliberately: a metric
 * that ran 3,412 → 3,588 gets ticks inside that band, because the movement is
 * what the reader came for and rounding out to 0–4,000 would flatten it.
 *
 * A bar cannot do that. A bar encodes its value as a LENGTH from a baseline, so
 * the reader reads the ratio between two bars — and on an axis that starts at
 * 3,412 a bar twice as long is a value 2.5% larger. Truncating a bar axis is
 * the oldest chart lie there is. So the domain here always contains zero, and
 * `zero` is published so the component draws from the baseline rather than
 * from the bottom of the box.
 *
 * A negative value therefore widens the domain downward rather than being
 * clamped — a clamp would render −40 and −4,000 as the same empty slot.
 *
 * Several series go in as several arrays for the same reason `plotScales` takes
 * several: they share the domain, so the second one cannot be quietly rescaled
 * until it crosses the first wherever the argument needs it to. The band count
 * comes from the LONGEST series, so a reference that stops short leaves its
 * remaining bins empty rather than stretching the axis.
 */
export function bandScales(
  series: readonly (readonly (number | null)[])[],
  width: number,
  height: number,
  pad = 4,
): BandScales {
  const measured = series
    .flat()
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const min = Math.min(0, ...measured);
  const max = Math.max(0, ...measured);
  const span = max - min;
  const count = Math.max(0, ...series.map((one) => one.length));
  // An empty distribution still has to hand back a usable band rather than
  // divide by zero — the component draws nothing, but it does so at full width.
  const band = count > 0 ? width / count : width;

  // Everything measured is zero: every bar is a zero-length bar sitting on the
  // baseline, which is the honest picture. Centring it (the `seriesScales` rule
  // for a flat line) would float the baseline in mid-air.
  const y = (value: number): number =>
    span === 0
      ? height - pad
      : height - pad - ((value - min) / span) * (height - pad * 2);

  return {
    band,
    x: (index) => index * band,
    centre: (index) => index * band + band / 2,
    y,
    zero: y(0),
    min,
    max,
  };
}

/**
 * Index of the largest MEASURED bin, or `null` when nothing was measured.
 *
 * "Where is the peak" is the first question anyone asks a distribution, and
 * every hand-rolled version of this chart computed it with
 * `Math.max(1, ...values)` — which invents a denominator of 1 out of an empty
 * series and reports bin 0 as the peak of a distribution that has no peak.
 * Ties go to the earliest bin, so the answer is stable across re-renders.
 */
export function peakBin(values: readonly (number | null)[]): number | null {
  let best = -1;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (best === -1 || value > (values[best] as number)) best = index;
  }
  return best === -1 ? null : best;
}

/**
 * A STEP path across bins — flat over each band, never sloped between them.
 *
 * A polyline through bin centres draws a diagonal between two bins and that
 * diagonal is a claim: that the quantity passed through every value in between,
 * somewhere in between. For a per-bin aggregate ("readers awake at 14:00")
 * nothing exists between the bins to pass through. The step says the same
 * numbers without the invented interpolation.
 *
 * An unmeasured bin BREAKS the path rather than bridging it, for the reason
 * `numeric()` drops nulls: a bridge over a gap is a drawn value nobody measured.
 */
export function stepPath(
  values: readonly (number | null)[],
  scales: BandScales,
): string {
  let d = '';
  let open = false;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      open = false;
      continue;
    }
    const y = scales.y(value);
    const left = scales.x(index);
    d += `${open ? 'L' : 'M'}${left},${y}L${left + scales.band},${y}`;
    open = true;
  }
  return d;
}

/**
 * The accessible name for a distribution.
 *
 * `describeSeries` answers "where did it go"; a distribution has nowhere to go,
 * so the sentence answers the questions it can actually be asked: how much in
 * total, where the peak is, and how much of the axis was never measured. That
 * last clause is not decoration — a distribution with six unmeasured bins looks
 * exactly like one with six empty bins, and only the sentence can tell them
 * apart for a reader who is not looking at it.
 */
export function describeDistribution(
  bins: readonly Bin[],
  label?: string,
  unit?: string,
): string {
  const name = label ?? 'Distribution';
  const measured = bins.filter(
    (bin): bin is Bin & { v: number } =>
      typeof bin.v === 'number' && Number.isFinite(bin.v),
  );
  if (measured.length === 0) return `${name}: no data`;

  const peak = peakBin(bins.map((bin) => bin.v))!;
  const total = measured.reduce((sum, bin) => sum + bin.v, 0);
  const noun = unit ? ` ${unit}` : '';
  const gaps = bins.length - measured.length;

  return (
    `${name}: ${bins.length} bins, ${total.toLocaleString()}${noun} in total, ` +
    `highest in ${bins[peak].label} at ${(bins[peak].v as number).toLocaleString()}${noun}` +
    `${gaps === 0 ? '' : `, ${gaps} bin${gaps === 1 ? '' : 's'} not measured`}.`
  );
}

/** First → last change, in absolute and percentage terms. */
export interface DeltaResult {
  from: number;
  to: number;
  abs: number;
  /** `null` when the baseline is 0 — a percentage change from nothing is undefined, not infinite. */
  pct: number | null;
  direction: Direction;
}

export function delta(points: readonly Point[]): DeltaResult | null {
  const pts = numeric(points);
  if (pts.length < 2) return null;
  const from = pts[0].v;
  const to = pts[pts.length - 1].v;
  const abs = to - from;
  return {
    from,
    to,
    abs,
    pct: from === 0 ? null : (abs / Math.abs(from)) * 100,
    direction: abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat',
  };
}

/** ISO timestamp → `YYYY-MM-DD`. Charts key annotations by day, not by instant. */
export const day = (t: string): string => t.slice(0, 10);

/**
 * The accessible name for a series.
 *
 * Axe cannot read an SVG, and a screen reader handed `role="img"` with no label
 * announces "image". This is the sentence that replaces the picture — every
 * chart in this package owes one, alongside its `<SeriesTable>`.
 */
export function describeSeries(points: readonly Point[], label?: string): string {
  const pts = numeric(points);
  const name = label ?? 'Series';
  if (pts.length === 0) return `${name}: no data`;
  if (pts.length === 1) return `${name}: a single value, ${pts[0].v}, on ${day(pts[0].t)}`;
  const d = delta(pts)!;
  const move =
    d.direction === 'flat'
      ? 'unchanged'
      : `${d.direction} ${Math.abs(d.abs).toLocaleString()}${
          d.pct === null ? '' : ` (${Math.abs(d.pct).toFixed(1)}%)`
        }`;
  return (
    `${name}: ${pts.length} points from ${day(pts[0].t)} to ${day(pts[pts.length - 1].t)}, ` +
    `${d.from.toLocaleString()} to ${d.to.toLocaleString()}, ${move}. ` +
    `Range ${Math.min(...pts.map((p) => p.v)).toLocaleString()} to ` +
    `${Math.max(...pts.map((p) => p.v)).toLocaleString()}.`
  );
}

/**
 * Anything carrying an observed domain plus something to count.
 *
 * `Scales` satisfies it directly; a multi-series plot passes its slot keys.
 * Widening the parameter rather than adding a `multiTicks` is deliberate — two
 * tick functions is how one chart ends up with two disagreeing y axes.
 */
export interface TickSource {
  readonly points: readonly unknown[];
  readonly min: number;
  readonly max: number;
}

/**
 * Evenly spaced axis values across the observed domain.
 *
 * Deliberately NOT "nice" rounded ticks. A metric that ran 3,412 → 3,588 gets
 * ticks inside that band; rounding out to 0–4,000 would flatten the only thing
 * the reader came for. The axis labels the data, not a textbook scale.
 */
export function ticks(scales: TickSource, count = 3): number[] {
  if (count < 2 || scales.points.length === 0) return [];
  if (scales.min === scales.max) return [scales.min];
  const step = (scales.max - scales.min) / (count - 1);
  return Array.from({ length: count }, (_, i) => scales.min + step * i);
}

/**
 * Slot nearest an x position, in SVG user units.
 *
 * The arithmetic behind every crosshair in this package. It takes a count
 * rather than a series because with two series plotted there is no single
 * series whose indices *are* the axis — the axis is the shared slot list. The
 * pointer path and the arrow-key path both land here, which is the property
 * that stops a mouse user and a keyboard user being told different things.
 */
export function nearestSlot(count: number, xPosition: number, width: number): number {
  const last = count - 1;
  if (last <= 0) return 0;
  const ratio = width === 0 ? 0 : xPosition / width;
  return Math.max(0, Math.min(last, Math.round(ratio * last)));
}

/**
 * The band an x position falls INSIDE, in SVG user units.
 *
 * `nearestSlot` rounds to the closest vertex, which is right for a line: the
 * value lives AT the vertex and the space between two of them belongs to
 * whichever is nearer. A bar owns its whole band, so the right answer is
 * containment, not proximity — rounding would hand the right-hand third of
 * every bar to its neighbour, and the reader would watch the highlight jump to
 * a bin their pointer is visibly not over.
 */
export function slotAt(count: number, xPosition: number, width: number): number {
  const last = count - 1;
  if (last <= 0) return 0;
  const ratio = width === 0 ? 0 : xPosition / width;
  return Math.max(0, Math.min(last, Math.floor(ratio * count)));
}

/**
 * Index of the point nearest an x position, for a single series.
 *
 * The one-series spelling of `nearestSlot`, kept because it is the published
 * shape of this module and delegating is what guarantees the two cannot drift
 * into rounding a boundary differently.
 */
export function nearestIndex(scales: Scales, xPosition: number, width: number): number {
  return nearestSlot(scales.points.length, xPosition, width);
}

// ── The dial: time wrapped around an arc, for the radial (poster) form ──────

/**
 * Geometry of a dial plot. The sweep is deliberately LESS than 360°: a
 * closed circle claims the last observation meets the first — that August
 * touches last December — and the gap is the honest statement that time
 * does not wrap. The gap sits at the bottom (the speedometer convention,
 * the most-practised radial read there is): time starts bottom-left and
 * proceeds clockwise over the top.
 */
export interface DialGeometry {
  cx: number;
  cy: number;
  /** Radius where `min` sits — the centre hole keeps the middle legible. */
  inner: number;
  /** Radius where `max` sits. */
  outer: number;
  /** Degrees, SVG convention (0° = +x, clockwise positive). */
  startAngle: number;
  /** Degrees of arc the time axis occupies. */
  sweep: number;
}

/** Slot → degrees. A single-slot axis sits mid-sweep, not at the start. */
export function dialAngle(slot: number, count: number, geometry: DialGeometry): number {
  return (
    geometry.startAngle +
    (count > 1 ? (slot / (count - 1)) * geometry.sweep : geometry.sweep / 2)
  );
}

/** Value → radius. A zero span centres between the rings (`seriesScales`' rule). */
export function dialRadius(
  value: number,
  min: number,
  max: number,
  geometry: DialGeometry,
): number {
  const span = max - min;
  return span === 0
    ? (geometry.inner + geometry.outer) / 2
    : geometry.inner + ((value - min) / span) * (geometry.outer - geometry.inner);
}

/** Degrees + radius → cartesian, around the dial's centre. */
export function dialPoint(
  angleDeg: number,
  radius: number,
  geometry: DialGeometry,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: geometry.cx + radius * Math.cos(rad), y: geometry.cy + radius * Math.sin(rad) };
}

/**
 * A series wrapped around the dial. Straight segments between observed
 * slots — a curve through polar space would smooth in values nobody
 * measured — and a `null` BREAKS the path (`numeric()`'s rule): an arc
 * bridging a gap is a drawn value with no observation under it.
 */
export function dialPath(
  values: readonly (number | null)[],
  min: number,
  max: number,
  geometry: DialGeometry,
): string {
  let d = '';
  let open = false;
  for (let slot = 0; slot < values.length; slot += 1) {
    const value = values[slot];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      open = false;
      continue;
    }
    const point = dialPoint(
      dialAngle(slot, values.length, geometry),
      dialRadius(value, min, max, geometry),
      geometry,
    );
    d += `${open ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    open = true;
  }
  return d;
}

/**
 * A grid ring: one constant-radius arc across the whole sweep. Two `A`
 * segments rather than one with a large-arc flag — a single arc command
 * cannot span exactly 180° ambiguity-free, and splitting at the midpoint
 * is correct for every sweep without a case split.
 */
export function dialRing(radius: number, geometry: DialGeometry): string {
  const start = dialPoint(geometry.startAngle, radius, geometry);
  const mid = dialPoint(geometry.startAngle + geometry.sweep / 2, radius, geometry);
  const end = dialPoint(geometry.startAngle + geometry.sweep, radius, geometry);
  const arc = (to: { x: number; y: number }): string =>
    `A${radius},${radius} 0 0 1 ${to.x.toFixed(2)},${to.y.toFixed(2)}`;
  return `M${start.x.toFixed(2)},${start.y.toFixed(2)}${arc(mid)}${arc(end)}`;
}

/** Compact number formatting for dense rows — 12.4k, 3.1M. */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString();
}
