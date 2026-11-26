/**
 * @interlace/ui — picture-reveal-model
 *
 * A picture hidden under tiles that come away a few at a time while the
 * room guesses. The order is seeded, so every screen (and a recap) uncovers
 * the same tiles in the same order, and it is spread out: a few tiles from
 * all over the picture say more, sooner, than a corner.
 *
 * `revealOrder` gives the tiles' order. `tilesAt` says how many are off
 * after a step, spread evenly so the last step shows the whole picture.
 * `guessPoints` pays an earlier right guess more: full points before any
 * tile is off, down to `floor` of them at the last step.
 */

import { seededShuffle } from './daily.js';

/** Every tile index, in the order the tiles come off. */
export function revealOrder(tiles: number, seed: number | string): number[] {
  const n = Math.max(0, Math.floor(tiles));
  return seededShuffle(
    Array.from({ length: n }, (_, i) => i),
    seed,
  );
}

/** Tiles off after `step` of `steps` (0 shows none; `steps` shows all). */
export function tilesAt(step: number, steps: number, tiles: number): number {
  const n = Math.max(0, Math.floor(tiles));
  const s = Math.max(1, Math.floor(steps));
  const k = Math.min(s, Math.max(0, Math.floor(step)));
  return Math.round((k / s) * n);
}

/** Points for a right guess made at `step` of `steps`. */
export function guessPoints(step: number, steps: number, options: { max?: number; floor?: number } = {}): number {
  const { max = 1000, floor = 0.2 } = options;
  const s = Math.max(1, Math.floor(steps));
  const k = Math.min(s, Math.max(0, step));
  const share = 1 - (1 - Math.min(1, Math.max(0, floor))) * (k / s);
  return Math.round(max * share);
}
