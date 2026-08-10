/**
 * Shared chart fixtures.
 *
 * Deliberately plausible rather than pretty: real metrics are noisy, have gaps
 * where nobody measured, and do not move monotonically. A chart that only ever
 * demoes a clean upward curve hides every rendering problem that matters —
 * the null gap, the flat run, the single-point start.
 *
 * Dates are literal, never `Date.now()`: a story whose fixture drifts with the
 * calendar produces a different visual-regression snapshot every day.
 */

import type { Annotation, Point } from '@interlace/ui/charts/scale';

const day = (index: number) => `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00Z`;

const series = (...values: (number | null)[]): Point[] =>
  values.map((v, i) => ({ t: day(i), v }));

/** Steady growth with a plateau — the shape of a metric that got a push. */
export const RISING: Point[] = series(
  1_240, 1_268, 1_301, 1_290, 1_355, 1_402, 1_488, 1_611, 1_640, 1_652,
  1_701, 1_890, 2_140, 2_205,
);

export const FALLING: Point[] = series(84, 79, 81, 72, 68, 61, 55, 52, 44, 38, 31, 27, 24, 19);

/** A metric that never moved. Must centre, not pin to the top edge. */
export const FLAT: Point[] = series(409, 409, 409, 409, 409, 409, 409);

/** Real data has holes. `null` means unmeasured — never zero. */
export const WITH_GAPS: Point[] = series(
  312, 340, null, null, 398, 412, 405, 460, null, 512, 548, 561, 590, 604,
);

/** Actions drawn ON the curve — the thing that turns a line into an argument. */
export const ANNOTATIONS: Annotation[] = [
  { t: day(5), label: 'Published "AST, not printed source"', kind: 'publish' },
  { t: day(8), label: 'v3.2.0 — 14 new rules', kind: 'release' },
  { t: day(11), label: 'Listed in awesome-nestjs', kind: 'action' },
];

/** Rows for the metric table — mixed polarity on purpose. */
export const METRIC_ROWS = [
  { key: 'downloads', label: 'npm downloads', points: RISING, unit: 'downloads' },
  { key: 'stars', label: 'GitHub stars', points: WITH_GAPS, unit: 'stars' },
  { key: 'rules', label: 'Rules shipped', points: FLAT, unit: 'rules' },
  // Down is GOOD here. Without `polarity`, a dashboard paints this regression green.
  { key: 'issues', label: 'Open issues', points: FALLING, polarity: 'inverse' as const, unit: 'issues' },
];

/** A small comment network — enough nodes to show the concentric ranking. */
export const GRAPH_NODES = [
  { id: 'ofri', weight: 24, group: 'us', label: 'ofri' },
  { id: 'dana', weight: 17, group: 'mutual' },
  { id: 'sam', weight: 14, group: 'mutual' },
  { id: 'rin', weight: 11, group: 'one-way' },
  { id: 'lee', weight: 9, group: 'mutual' },
  { id: 'kai', weight: 7, group: 'one-way' },
  { id: 'noa', weight: 5, group: 'one-way' },
  { id: 'ari', weight: 4, group: 'one-way' },
  { id: 'tal', weight: 2, group: 'one-way' },
  { id: 'yuv', weight: 1, group: 'one-way' },
];

export const GRAPH_EDGES = [
  { from: 'ofri', to: 'dana' },
  { from: 'ofri', to: 'sam' },
  { from: 'ofri', to: 'rin' },
  { from: 'ofri', to: 'lee' },
  { from: 'dana', to: 'sam' },
  { from: 'dana', to: 'kai' },
  { from: 'sam', to: 'noa' },
  { from: 'lee', to: 'ari' },
  { from: 'rin', to: 'tal' },
  { from: 'kai', to: 'yuv' },
];
