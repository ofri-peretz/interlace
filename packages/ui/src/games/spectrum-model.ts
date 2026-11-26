/**
 * @interlace/ui — spectrum-model
 *
 * Where a room stands between two poles. Everyone places a dot on a line
 * from 0 to 100; the room sees the spread, not just a winner, which is the
 * point: most rooms are not split in two. Pure, so a server and a recap
 * page draw the same picture, and a before-and-after pair can be compared.
 *
 * `summarizeSpectrum` bins the dots (10 bins by default), finds the median
 * and the middle half (the quartiles), and the mean. `spectrumShift` says how
 * far the room's median moved between two rounds of the same statement.
 */

export interface SpectrumSummary {
  count: number;
  /** Dots per bin, left to right. */
  bins: number[];
  /** The most dots in any one bin. */
  peak: number;
  mean: number | null;
  median: number | null;
  /** The middle half of the room, from the lower to the upper quartile. */
  middle: [number, number] | null;
}

export interface SpectrumOptions {
  /** @default 10 */
  bins?: number;
  /** @default 0 */
  min?: number;
  /** @default 100 */
  max?: number;
}

function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (pos - lo);
}

/** Clamps to the line; non-numbers are dropped. */
export function cleanValues(values: readonly number[], options: SpectrumOptions = {}): number[] {
  const { min = 0, max = 100 } = options;
  return values.filter((v) => Number.isFinite(v)).map((v) => Math.min(max, Math.max(min, v)));
}

export function summarizeSpectrum(values: readonly number[], options: SpectrumOptions = {}): SpectrumSummary {
  const { bins: n = 10, min = 0, max = 100 } = options;
  const count = Math.max(1, Math.floor(n));
  const clean = cleanValues(values, options);
  const bins = Array.from({ length: count }, () => 0);
  const span = max - min || 1;
  for (const v of clean) {
    const i = Math.min(count - 1, Math.floor(((v - min) / span) * count));
    bins[i] = (bins[i] as number) + 1;
  }
  if (clean.length === 0) return { count: 0, bins, peak: 0, mean: null, median: null, middle: null };
  const sorted = [...clean].sort((a, b) => a - b);
  return {
    count: clean.length,
    bins,
    peak: Math.max(...bins),
    mean: clean.reduce((a, b) => a + b, 0) / clean.length,
    median: quantile(sorted, 0.5),
    middle: [quantile(sorted, 0.25), quantile(sorted, 0.75)],
  };
}

/** How far the median moved from `before` to `after`, or null when either is empty. */
export function spectrumShift(
  before: readonly number[],
  after: readonly number[],
  options: SpectrumOptions = {},
): number | null {
  const a = summarizeSpectrum(before, options).median;
  const b = summarizeSpectrum(after, options).median;
  return a === null || b === null ? null : b - a;
}

/** The bin a value falls in. */
export function binOf(value: number, options: SpectrumOptions = {}): number {
  const { bins: n = 10, min = 0, max = 100 } = options;
  const count = Math.max(1, Math.floor(n));
  const v = Math.min(max, Math.max(min, value));
  return Math.min(count - 1, Math.floor(((v - min) / (max - min || 1)) * count));
}
