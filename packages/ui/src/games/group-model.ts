/**
 * @interlace/ui — games/group-model
 *
 * The small, pure helpers every way of splitting a room shares (teams, breakout groups, pairs):
 * a shuffle that takes its random source, a fair deal, and a seeded random for tests and replays.
 * Nothing here knows about a room.
 */

/** A float in [0, 1), like `Math.random`. */
export type Random = () => number;

/**
 * A repeatable random source (mulberry32): the same seed gives the same run. For tests, and for a
 * host that wants a split it can reproduce.
 */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy (Fisher-Yates). A `random` that returns 1 or more is held below 1. */
export function shuffled<T>(items: readonly T[], random: Random = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Deals `items` into `groups` piles, first to last then back (1 2 3 3 2 1 …), so when the items
 * are sorted best first every pile gets its share of the best, and no pile is more than one
 * larger than another.
 */
export function snakeDeal<T>(items: readonly T[], groups: number): T[][] {
  const piles: T[][] = Array.from({ length: groups }, () => []);
  items.forEach((item, i) => {
    const pos = i % groups;
    (piles[Math.floor(i / groups) % 2 === 0 ? pos : groups - 1 - pos] as T[]).push(item);
  });
  return piles;
}

/** The index of the smallest size, the first on a tie. -1 for no sizes. */
export function smallestIndex(sizes: readonly number[]): number {
  let best = -1;
  sizes.forEach((size, i) => {
    if (best === -1 || size < (sizes[best] as number)) best = i;
  });
  return best;
}

/** Clamps a count to a whole number in [min, max]; NaN falls to `min`. */
export function clampCount(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(Number.isFinite(value) ? value : min)));
}

/** True for a plain JSON object (not null, not an array). */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** An id read from untrusted data: a short word of letters, digits, `_` and `-`. */
export const isId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
