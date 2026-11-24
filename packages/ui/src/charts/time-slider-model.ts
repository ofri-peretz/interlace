/**
 * @interlace/ui — time slider model
 *
 * The pure steps behind `TimeSlider`: which frame comes next, where play
 * starts, and how a frame is printed. No React and no timers, so a server or
 * a test can step through the same frames the reader does.
 */

/** A frame's key: a year, a date string, a season. */
export type TimeFrame = string | number;

/** Keep an index inside `0 … count - 1`. A non-finite index lands on the last frame. */
export function clampFrame(index: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(index)) return count - 1;
  return Math.min(count - 1, Math.max(0, Math.round(index)));
}

/**
 * The frame after `index` while playing, or `null` when play should stop.
 * With `loop`, the last frame is followed by the first.
 */
export function nextFrame(index: number, count: number, loop = false): number | null {
  if (count <= 1) return null;
  const at = clampFrame(index, count);
  if (at < count - 1) return at + 1;
  return loop ? 0 : null;
}

/**
 * Where pressing play starts: from the current frame, unless it is the last
 * one, in which case from the first, so play always shows a change.
 */
export function playStart(index: number, count: number): number {
  const at = clampFrame(index, count);
  return at >= count - 1 ? 0 : at;
}

/**
 * Print a frame. Numbers go through `Intl.NumberFormat` without grouping, so
 * the year 2024 prints as "2024" and not "2,024", in the locale's digits.
 */
export function formatFrame(frame: TimeFrame, locale?: string): string {
  if (typeof frame === 'number') {
    return Number.isFinite(frame) ? new Intl.NumberFormat(locale, { useGrouping: false }).format(frame) : '';
  }
  return frame;
}
