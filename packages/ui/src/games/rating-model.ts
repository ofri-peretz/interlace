/**
 * @interlace/ui — rating-model
 *
 * A rating scale and what a room's ratings say. One model covers a 1 to 5
 * familiarity check, a 0 to 10 recommend score, a mood check with faces and
 * the same question asked before and after a session.
 *
 * `summarizeRatings` counts each step, finds the mean and median, and, for a
 * 0 to 10 scale, the recommend score (the share at 9 or 10 minus the share
 * at 0 to 6, from -100 to 100). `ratingShift` says how far the mean moved
 * between two rounds. Values off the scale, or not whole steps, are dropped,
 * so a bad message cannot skew the room.
 */

export interface RatingScale {
  /** @default 1 */
  min?: number;
  /** @default 5 */
  max?: number;
}

export interface RatingSummary {
  count: number;
  /** One count per step, from `min` to `max`. */
  counts: number[];
  /** The largest count, for drawing bars. */
  peak: number;
  mean: number | null;
  median: number | null;
  /** Only for a 0 to 10 scale: % at 9 to 10 minus % at 0 to 6, rounded. */
  recommend: number | null;
}

/** The steps of a scale, `min` to `max`. */
export function ratingSteps(scale: RatingScale = {}): number[] {
  const { min = 1, max = 5 } = scale;
  const out: number[] = [];
  for (let v = Math.ceil(min); v <= max; v++) out.push(v);
  return out;
}

/** Keeps whole steps on the scale; drops anything else. */
export function cleanRatings(values: readonly number[], scale: RatingScale = {}): number[] {
  const { min = 1, max = 5 } = scale;
  return values.filter((v) => Number.isInteger(v) && v >= min && v <= max);
}

export function summarizeRatings(values: readonly number[], scale: RatingScale = {}): RatingSummary {
  const { min = 1, max = 5 } = scale;
  const steps = ratingSteps(scale);
  const clean = cleanRatings(values, scale);
  const counts = steps.map(() => 0);
  for (const v of clean) counts[v - Math.ceil(min)] = (counts[v - Math.ceil(min)] as number) + 1;
  const peak = Math.max(0, ...counts);
  if (clean.length === 0) return { count: 0, counts, peak, mean: null, median: null, recommend: null };
  const sorted = [...clean].sort((a, b) => a - b);
  const mid = (sorted.length - 1) / 2;
  const median = ((sorted[Math.floor(mid)] as number) + (sorted[Math.ceil(mid)] as number)) / 2;
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  let recommend: number | null = null;
  if (min === 0 && max === 10) {
    const promoters = clean.filter((v) => v >= 9).length;
    const detractors = clean.filter((v) => v <= 6).length;
    recommend = Math.round(((promoters - detractors) / clean.length) * 100);
  }
  return { count: clean.length, counts, peak, mean, median, recommend };
}

/** How far the mean moved from `before` to `after`, or null when either is empty. */
export function ratingShift(
  before: readonly number[],
  after: readonly number[],
  scale: RatingScale = {},
): number | null {
  const a = summarizeRatings(before, scale).mean;
  const b = summarizeRatings(after, scale).mean;
  return a === null || b === null ? null : b - a;
}
