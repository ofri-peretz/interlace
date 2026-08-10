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
 * Evenly spaced axis values across the observed domain.
 *
 * Deliberately NOT "nice" rounded ticks. A metric that ran 3,412 → 3,588 gets
 * ticks inside that band; rounding out to 0–4,000 would flatten the only thing
 * the reader came for. The axis labels the data, not a textbook scale.
 */
export function ticks(scales: Scales, count = 3): number[] {
  if (count < 2 || scales.points.length === 0) return [];
  if (scales.min === scales.max) return [scales.min];
  const step = (scales.max - scales.min) / (count - 1);
  return Array.from({ length: count }, (_, i) => scales.min + step * i);
}

/**
 * Index of the point nearest an x position, in SVG user units.
 *
 * Shared by the pointer crosshair and the arrow-key crosshair so the two can
 * never disagree about which point is "here" — a keyboard user and a mouse user
 * read the same tooltip.
 */
export function nearestIndex(scales: Scales, xPosition: number, width: number): number {
  const last = scales.points.length - 1;
  if (last <= 0) return 0;
  const ratio = width === 0 ? 0 : xPosition / width;
  return Math.max(0, Math.min(last, Math.round(ratio * last)));
}

/** Compact number formatting for dense rows — 12.4k, 3.1M. */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString();
}
