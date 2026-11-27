/**
 * @interlace/ui — groups-model
 *
 * Splits a room into pairs, small groups or teams. One model covers the
 * three because they are the same question at different sizes: who sits
 * with whom.
 *
 * ## Rules
 *
 * - Balanced: group sizes never differ by more than one, and nobody is left
 *   alone when there are two or more people (an odd pair becomes a trio).
 * - Repeatable: the same people, seed and options give the same groups, so
 *   a host that refreshes, or a server and a phone, agree without sending
 *   the whole list.
 * - Fresh faces: `avoid` lists earlier groups; among several seeded tries,
 *   the arrangement that repeats the fewest pairs wins.
 * - Late joiners go into the smallest group (`joinGroups`), never a new
 *   group of one; someone who leaves is taken out without reshuffling the
 *   others (`leaveGroups`).
 *
 * `teamTotals` turns groups and per-person scores into team rows for the
 * Leaderboard, by sum or by mean (fair when teams differ in size).
 */

import type { LeaderboardEntry } from './leaderboard-model.js';

export interface GroupOptions {
  /** People per group. Ignored when `count` is set. @default 2 */
  size?: number;
  /** Exactly this many groups (teams). */
  count?: number;
  /** Any string or number; the same seed gives the same groups. */
  seed: string | number;
  /** Earlier groups, to avoid putting the same people together again. */
  avoid?: readonly (readonly string[])[];
  /** Seeded arrangements to compare when `avoid` is set. @default 24 */
  tries?: number;
}

/** A small, fast, seeded generator (mulberry32) from a string or number. */
function random(seed: string | number): () => number {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ (ch.codePointAt(0) as number), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: readonly T[], next: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

function pairsOf(groups: readonly (readonly string[])[]): Set<string> {
  const out = new Set<string>();
  for (const g of groups)
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++) out.add(pairKey(g[i] as string, g[j] as string));
  return out;
}

/** How many pairs in `groups` already sat together in `earlier`. */
export function repeatedPairs(groups: readonly (readonly string[])[], earlier: readonly (readonly string[])[]): number {
  const seen = pairsOf(earlier);
  let n = 0;
  for (const key of pairsOf(groups)) if (seen.has(key)) n++;
  return n;
}

function deal(people: readonly string[], count: number, next: () => number): string[][] {
  const groups: string[][] = Array.from({ length: count }, () => []);
  shuffle(people, next).forEach((p, i) => (groups[i % count] as string[]).push(p));
  return groups;
}

/** Splits `people` into balanced groups. Duplicates count once; order is ignored. */
export function makeGroups(people: readonly string[], options: GroupOptions): string[][] {
  const unique = [...new Set(people)].sort();
  if (unique.length === 0) return [];
  const { size = 2, count, seed, avoid, tries = 24 } = options;
  const wanted = count ?? Math.floor(unique.length / Math.max(1, Math.floor(size)));
  const n = Math.min(unique.length, Math.max(1, Math.floor(wanted)));
  const next = random(seed);
  let best = deal(unique, n, next);
  if (avoid && avoid.length > 0) {
    let score = repeatedPairs(best, avoid);
    for (let t = 1; t < tries && score > 0; t++) {
      const option = deal(unique, n, next);
      const s = repeatedPairs(option, avoid);
      if (s < score) {
        best = option;
        score = s;
      }
    }
  }
  return best;
}

/** Adds a late joiner to the smallest group (the first, on a tie). Someone already in a group stays put. */
export function joinGroups(groups: readonly (readonly string[])[], person: string): string[][] {
  const copy = groups.map((g) => [...g]);
  if (copy.some((g) => g.includes(person))) return copy;
  if (copy.length === 0) return [[person]];
  let smallest = 0;
  copy.forEach((g, i) => {
    if (g.length < (copy[smallest] as string[]).length) smallest = i;
  });
  (copy[smallest] as string[]).push(person);
  return copy;
}

/** Takes someone out, leaving everyone else where they are. Empty groups go. */
export function leaveGroups(groups: readonly (readonly string[])[], person: string): string[][] {
  return groups.map((g) => g.filter((p) => p !== person)).filter((g) => g.length > 0);
}

/** The index of this person's group, or -1. */
export function groupOf(groups: readonly (readonly string[])[], person: string): number {
  return groups.findIndex((g) => g.includes(person));
}

export interface TeamTotalOptions {
  /** `mean` is fair when teams differ in size. @default 'sum' */
  mode?: 'sum' | 'mean';
  /** Team names by index. @default (i) => `Team ${i + 1}` */
  name?: (index: number) => string;
}

/** Team rows for `Leaderboard`, from groups and each person's score (missing scores count as 0). */
export function teamTotals(
  groups: readonly (readonly string[])[],
  scores: Readonly<Record<string, number>>,
  options: TeamTotalOptions = {},
): LeaderboardEntry[] {
  const { mode = 'sum', name = (i: number) => `Team ${i + 1}` } = options;
  return groups.map((g, i) => {
    const sum = g.reduce((acc, p) => acc + (scores[p] ?? 0), 0);
    return {
      id: `team-${i}`,
      name: name(i),
      score: mode === 'mean' ? (g.length === 0 ? 0 : Math.round((sum / g.length) * 10) / 10) : sum,
    };
  });
}
