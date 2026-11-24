/**
 * @interlace/ui — games/closer-model
 *
 * Scoring for a number guess: the player slides to a value, the game shows
 * how far off it was. Pure, so a server can score the same guess and a share
 * card can show the band without the number.
 *
 * ## Distance on the player's scale
 *
 * "How far off" is measured as a share of the range the player was given,
 * because 900 off is close on a slider from 0 to 100,000 and far on one from
 * 0 to 1,000. With `scale: 'log'` (for answers that span orders of
 * magnitude, such as populations) the share is taken on the log scale, so
 * 900 instead of 1,000 and 900,000 instead of 1,000,000 score the same.
 *
 * ## Bands
 *
 * Every result lands in a band, so a game can say "Close." in words and a
 * share card can draw a mark per round without saying the number:
 *
 * | Band      | Default: off by at most        |
 * | --------- | ------------------------------ |
 * | `exact`   | `tolerance` (default: half a step, or 0) |
 * | `close`   | 5% of the range                |
 * | `near`    | 15% of the range               |
 * | `far`     | anything more                  |
 */

export interface CloserRange {
  min: number;
  max: number;
  /** Slider step. @default 1 */
  step?: number;
  /** `log` for answers that span orders of magnitude; needs `min > 0`. @default 'linear' */
  scale?: 'linear' | 'log';
}

export type CloserBand = 'exact' | 'close' | 'near' | 'far';

export interface CloserScoreOptions {
  /** Points for a perfect guess. @default 100 */
  maxPoints?: number;
  /**
   * Absolute distance that still counts as exact. @default half of `step`
   *
   * On a log range, set this or `step`: a slider moving by share of the
   * range rarely lands within half a unit of the answer.
   */
  tolerance?: number;
  /** Band edges, as shares of the range (0–1). @default { close: 0.05, near: 0.15 } */
  bands?: { close?: number; near?: number };
  /** Share of the range at which points reach 0. @default 0.5 */
  zeroAt?: number;
}

export interface CloserResult {
  guess: number;
  answer: number;
  /** |guess − answer|, in the answer's units. */
  distance: number;
  /** Distance as a share of the range on its scale, 0–1. */
  error: number;
  band: CloserBand;
  /** Whole points, 0 to `maxPoints`. */
  points: number;
  /** Where the answer sits from the guess: `higher`, `lower` or `exact`. */
  direction: 'higher' | 'lower' | 'exact';
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function assertRange(range: CloserRange) {
  if (!(range.max > range.min)) throw new RangeError('A range needs max > min');
  if (range.scale === 'log' && range.min <= 0) throw new RangeError('A log range needs min > 0');
}

/** Where `value` sits on the range, 0 at `min` to 1 at `max`, clamped. */
export function toPosition(value: number, range: CloserRange): number {
  assertRange(range);
  if (range.scale === 'log') {
    const v = Math.max(value, range.min);
    return clamp(Math.log(v / range.min) / Math.log(range.max / range.min), 0, 1);
  }
  return clamp((value - range.min) / (range.max - range.min), 0, 1);
}

/** The value at a position (0–1), snapped to `step` and clamped to the range. */
export function fromPosition(position: number, range: CloserRange): number {
  assertRange(range);
  const p = clamp(position, 0, 1);
  const raw =
    range.scale === 'log'
      ? range.min * Math.pow(range.max / range.min, p)
      : range.min + p * (range.max - range.min);
  return snap(raw, range);
}

/** `value` snapped to the range's step, from `min`, and clamped to the range. */
export function snap(value: number, range: CloserRange): number {
  const step = range.step ?? 1;
  const snapped = step > 0 ? range.min + Math.round((value - range.min) / step) * step : value;
  // Clean the float tail a step like 0.1 leaves behind.
  const decimals = Math.max(0, -Math.floor(Math.log10(step > 0 ? step : 1)));
  return clamp(Number(snapped.toFixed(Math.min(decimals + 2, 12))), range.min, range.max);
}

/** Score a guess against the answer on the given range. */
export function scoreGuess(
  guess: number,
  answer: number,
  range: CloserRange,
  options: CloserScoreOptions = {},
): CloserResult {
  const { maxPoints = 100, zeroAt = 0.5 } = options;
  // Positions clamp to the track, so an answer off it would score a guess at the end as close.
  if (!(answer >= range.min && answer <= range.max)) throw new RangeError('answer must be within the range');
  if (!Number.isFinite(guess)) throw new RangeError('guess must be a finite number');
  const tolerance = options.tolerance ?? (range.step ?? 1) / 2;
  const close = options.bands?.close ?? 0.05;
  const near = options.bands?.near ?? 0.15;
  const distance = Math.abs(guess - answer);
  const exact = distance <= tolerance;
  const error = exact ? 0 : Math.abs(toPosition(guess, range) - toPosition(answer, range));
  const band: CloserBand = exact ? 'exact' : error <= close ? 'close' : error <= near ? 'near' : 'far';
  const points = exact ? maxPoints : Math.round(maxPoints * clamp(1 - error / zeroAt, 0, 1));
  const direction = exact ? 'exact' : answer > guess ? 'higher' : 'lower';
  return { guess, answer, distance, error, band, points, direction };
}
