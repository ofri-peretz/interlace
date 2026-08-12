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

/**
 * A second metric measured on the SAME days — the ordinary compare case.
 * Same order of magnitude as `RISING`, so both lines keep their shape on the
 * one shared y domain.
 */
export const COMPARING: Point[] = series(
  980, 1_020, 1_005, 1_090, 1_140, 1_120, 1_210, 1_180, 1_260, 1_300,
  1_290, 1_340, 1_410, 1_460,
);

/**
 * A series that starts a week late and stops a day early. Proves the x axis is
 * the UNION of both series' days rather than "series 0 owns the axis" — under
 * which every reading below would silently vanish from the picture while
 * staying in the data table.
 */
export const RAGGED: Point[] = [7, 8, 9, 10, 11, 12].map((index) => ({
  t: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
  v: 1_500 + index * 90,
}));

/**
 * A metric two orders of magnitude smaller. Renders as a flat line against
 * `RISING`, which is the true statement about it — the alternative is a second
 * y axis, which is how two unrelated series are made to appear to cross.
 */
export const TINY: Point[] = series(4, 5, 5, 6, 8, 9, 9, 11, 12, 14, 15, 17, 18, 21);

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

/**
 * The audience clock, as bins.
 *
 * This is the fixture that pays for `Distribution`: a 24-slot cyclical axis
 * where the interesting statement is the GAP between two distributions, not
 * the movement of one. Both series are shares, in percent, on purpose — the
 * component draws one y domain and refuses a second axis, so a reference in
 * raw counts against bars in percent is a chart it will not draw. Converting
 * both to shares of their own denominator is the caller's job and it is what
 * makes the comparison mean anything.
 *
 * `hours` sums to 100: it is where the week's reading actually happened.
 * `awake` does not and should not — it is the share of readers who are awake
 * at that hour, and those shares overlap.
 */
const READING_SHARE = [
  1.2, 0.9, 0.7, 0.6, 0.8, 1.4, 2.3, 3.6, 6.9, 7.4, 5.1, 4.6,
  5.2, 8.8, 9.4, 9.1, 6.3, 5.5, 4.8, 4.2, 3.9, 3.3, 2.4, 1.6,
];

const AWAKE_SHARE = [
  38, 34, 31, 29, 30, 35, 44, 55, 64, 70, 74, 77,
  80, 83, 84, 82, 78, 73, 68, 63, 59, 54, 48, 43,
];

/** UTC hour label, with the same instant in a +03:00 zone as the second reading. */
const hourBin = (index: number, share: number | null) => ({
  label: `${String(index).padStart(2, '0')}:00`,
  note: `${String((index + 3) % 24).padStart(2, '0')}:00`,
  v: share,
  reference: AWAKE_SHARE[index],
});

export const AUDIENCE_CLOCK = READING_SHARE.map((share, index) => hourBin(index, share));

/**
 * The same clock with two hours nobody measured. A bar of height zero and a bar
 * that was never drawn are the same picture, which is why those two slots
 * hatch instead of going quietly blank.
 */
export const AUDIENCE_CLOCK_WITH_GAPS = READING_SHARE.map((share, index) =>
  hourBin(index, index === 3 || index === 4 ? null : share),
);

/**
 * Seven bins whose order is not their alphabetical order. Sorted, this reads
 * Fri, Mon, Sat… — a week that does not exist. The caller's order IS the axis.
 */
export const BY_WEEKDAY = [
  { label: 'Mon', v: 41 },
  { label: 'Tue', v: 38 },
  { label: 'Wed', v: 44 },
  { label: 'Thu', v: 36 },
  { label: 'Fri', v: 29 },
  { label: 'Sat', v: 12 },
  { label: 'Sun', v: 17 },
];
