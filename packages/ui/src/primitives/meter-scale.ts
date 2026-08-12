/**
 * @interlace/ui — meter arithmetic (pure)
 *
 * The maths behind `Meter` and `RankedBarList`. No React, no DOM — the same
 * split `charts/scale.ts` makes, and for the same reason: a bar that draws a
 * beautiful wrong length is worse than one that fails to render, and the
 * length is the part that can be proved rather than reviewed.
 *
 * ## `null` is unmeasured, and it stays that way
 *
 * `meterFraction` returns `null` for a `null` value rather than `0`. A bar of
 * length zero and a bar that was never run look identical once the number is
 * gone, and the whole point of the hatch variant is that they must not.
 *
 * ## Length and number, never hue
 *
 * Nothing here returns a colour. Magnitude is carried by the fraction (length)
 * and by the formatted value (number) so the bar survives greyscale, a
 * screenshot at 40% width, and the ~8% of men with red-green colour vision
 * deficiency. That is the same rule `Delta` follows with its glyph/sign/colour
 * triple — see VISUALIZATION_PHILOSOPHY.md §5.
 */

/**
 * Linear or logarithmic.
 *
 * `log` exists because reach spans orders of magnitude: a row at 10k and a row
 * at 10M cannot share a linear axis without the first becoming a hairline that
 * reads as zero. On a log axis both are legible and the *ordering* — the thing
 * a ranked list is for — survives.
 *
 * It is opt-in, and it must stay opt-in. A log axis flatters small numbers, so
 * silently defaulting to it would make every list look healthier than it is.
 */
export type MeterScaleKind = 'linear' | 'log';

/** Clamp to the unit interval. Non-finite input is treated as the floor. */
export const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

/**
 * The log domain floor.
 *
 * `log(0)` is `-Infinity`, so a log axis needs a positive lower bound. 1 is the
 * honest choice for counts: it is the smallest thing that can be observed at
 * all, and it maps to fraction 0 — "the least this axis can show", not "none".
 */
export const LOG_FLOOR = 1;

/**
 * Value → fill fraction in `[0, 1]`, or `null` when the value is unmeasured.
 *
 * Rules, each of which exists because the naive version is wrong:
 *
 *  - `value === null` → `null`. Unmeasured is not zero. Callers render the
 *    hatch, not an empty bar.
 *  - a non-finite `value` or `max` → `null`. `NaN / 0` silently paints a
 *    full-width bar in some browsers and an empty one in others.
 *  - `max <= 0` → `null`. There is no denominator, so there is no fraction;
 *    inventing `1` would report every row as complete.
 *  - the result is clamped, so a value above the stated maximum draws full
 *    rather than overflowing its track. The NUMBER still shows the overage —
 *    which is why the number is never optional.
 *
 * On the log branch, `floor` is the bottom of the domain (default `LOG_FLOOR`).
 * Values at or below it map to 0. When the domain collapses (`max <= floor`)
 * a measured value is at its ceiling, so it maps to 1 — unlike a flat time
 * series, a meter's denominator is a *stated* maximum rather than an observed
 * span, so there is nothing to centre.
 */
export function meterFraction(
  value: number | null | undefined,
  max: number | null | undefined,
  kind: MeterScaleKind = 'linear',
  floor: number = LOG_FLOOR,
): number | null {
  if (value === null || value === undefined) return null;
  if (max === null || max === undefined) return null;
  if (!Number.isFinite(value) || !Number.isFinite(max)) return null;
  if (max <= 0) return null;

  if (kind === 'linear') return clamp01(value / max);

  const lo = Math.max(floor, Number.MIN_VALUE);
  if (max <= lo) return value >= max ? 1 : 0;
  if (value <= lo) return 0;
  return clamp01(
    (Math.log10(value) - Math.log10(lo)) / (Math.log10(max) - Math.log10(lo)),
  );
}

/**
 * The largest measured value in a set of rows, or `null` when none were.
 *
 * `null`s are skipped rather than counted as `0`, so an all-unmeasured list
 * yields `null` and the caller renders hatch rows instead of a row of empty
 * bars implying every value was zero.
 */
export function meterDomainMax(
  values: readonly (number | null | undefined)[],
): number | null {
  let max: number | null = null;
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (!Number.isFinite(value)) continue;
    if (max === null || value > max) max = value;
  }
  return max;
}

/**
 * Sort rows by magnitude, unmeasured rows last.
 *
 * Two properties that a bare `.sort((a, b) => b.value - a.value)` does not
 * have, and both matter:
 *
 *  - An unmeasured row (`null`) sinks to the bottom **without becoming zero**.
 *    Coercing it would put it below every measured row *and* claim it was the
 *    smallest, which is a measurement nobody took.
 *  - The sort is stable within each group, so two rows at the same value — and
 *    the whole block of unmeasured rows — keep the caller's order. An
 *    alphabetical input stays alphabetical where the data does not separate it.
 */
export function rankByValue<T extends { value: number | null | undefined }>(
  rows: readonly T[],
): T[] {
  const measurable = (row: T): boolean =>
    row.value !== null && row.value !== undefined && Number.isFinite(row.value);

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aHas = measurable(a.row);
      const bHas = measurable(b.row);
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (!aHas) return a.index - b.index;
      const diff = (b.row.value as number) - (a.row.value as number);
      return diff === 0 ? a.index - b.index : diff;
    })
    .map((entry) => entry.row);
}

/**
 * Fill widths as literal Tailwind classes, indexed by whole percent.
 *
 * A table and not `style={{ width }}`, because Tailwind v4 scans source as raw
 * TEXT: a template-built `w-[${n}%]` is never emitted, and an inline style is
 * the thing this design system does not do (R18). 101 entries is the honest
 * cost of a data-driven width that stays in the class layer.
 *
 * One percent is ~3px on a 300px track, which is below the width of the
 * hairline that separates two rows — and the exact value is printed beside the
 * bar regardless, because length is never the only carrier.
 */
export const FILL_WIDTH_CLASSES = [
  'w-[0%]', 'w-[1%]', 'w-[2%]', 'w-[3%]', 'w-[4%]', 'w-[5%]', 'w-[6%]', 'w-[7%]', 'w-[8%]', 'w-[9%]',
  'w-[10%]', 'w-[11%]', 'w-[12%]', 'w-[13%]', 'w-[14%]', 'w-[15%]', 'w-[16%]', 'w-[17%]', 'w-[18%]', 'w-[19%]',
  'w-[20%]', 'w-[21%]', 'w-[22%]', 'w-[23%]', 'w-[24%]', 'w-[25%]', 'w-[26%]', 'w-[27%]', 'w-[28%]', 'w-[29%]',
  'w-[30%]', 'w-[31%]', 'w-[32%]', 'w-[33%]', 'w-[34%]', 'w-[35%]', 'w-[36%]', 'w-[37%]', 'w-[38%]', 'w-[39%]',
  'w-[40%]', 'w-[41%]', 'w-[42%]', 'w-[43%]', 'w-[44%]', 'w-[45%]', 'w-[46%]', 'w-[47%]', 'w-[48%]', 'w-[49%]',
  'w-[50%]', 'w-[51%]', 'w-[52%]', 'w-[53%]', 'w-[54%]', 'w-[55%]', 'w-[56%]', 'w-[57%]', 'w-[58%]', 'w-[59%]',
  'w-[60%]', 'w-[61%]', 'w-[62%]', 'w-[63%]', 'w-[64%]', 'w-[65%]', 'w-[66%]', 'w-[67%]', 'w-[68%]', 'w-[69%]',
  'w-[70%]', 'w-[71%]', 'w-[72%]', 'w-[73%]', 'w-[74%]', 'w-[75%]', 'w-[76%]', 'w-[77%]', 'w-[78%]', 'w-[79%]',
  'w-[80%]', 'w-[81%]', 'w-[82%]', 'w-[83%]', 'w-[84%]', 'w-[85%]', 'w-[86%]', 'w-[87%]', 'w-[88%]', 'w-[89%]',
  'w-[90%]', 'w-[91%]', 'w-[92%]', 'w-[93%]', 'w-[94%]', 'w-[95%]', 'w-[96%]', 'w-[97%]', 'w-[98%]', 'w-[99%]',
  'w-[100%]',
] as const;

/**
 * Fraction → the class that paints it.
 *
 * Rounds rather than floors: at 0.999 a floor would paint 99% and leave a
 * hairline of track visible on a row that IS the maximum, which reads as
 * "almost" on the one row where the answer is "yes".
 */
export function fillWidthClass(fraction: number): string {
  if (!Number.isFinite(fraction)) return FILL_WIDTH_CLASSES[0];
  const percent = Math.round(clamp01(fraction) * 100);
  return FILL_WIDTH_CLASSES[percent];
}

/**
 * Compact magnitude — `12.4k`, `3.1M`.
 *
 * A deliberate twin of `compact()` in `charts/scale.ts` rather than an import
 * of it. `charts/scale.ts` is a `.ts` companion, not a registry item, so a
 * cross-tier `../charts/scale.js` import from a primitive emits a
 * `registryDependencies` entry that resolves to nothing and makes the whole
 * item silently uninstallable via `npx shadcn add`. The two are pinned to
 * identical output by a test rather than by a shared module.
 */
export function compactMagnitude(value: number): string {
  const abs = Math.abs(value);
  if (!Number.isFinite(value)) return '—';
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString();
}

/**
 * The spoken sentence for one measured bar.
 *
 * A bar drawn with `aria-hidden` geometry and no text is a picture of a number
 * that a screen reader cannot read. This is the text equivalent WCAG 1.1.1
 * asks for, and it carries the ACTUAL value — not "62 percent", which is the
 * projection rather than the measurement.
 */
export function describeMeter(
  label: string,
  value: number | null,
  max: number | null,
  unit?: string,
): string {
  if (value === null) return `${label}: not measured.`;
  const suffix = unit ? ` ${unit}` : '';
  const measured = `${value.toLocaleString()}${suffix}`;
  return max === null || max <= 0
    ? `${label}: ${measured}.`
    : `${label}: ${measured} of ${max.toLocaleString()}${suffix}.`;
}
