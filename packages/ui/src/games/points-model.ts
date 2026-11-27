/**
 * @interlace/ui — points-model
 *
 * Spend a budget of points across options: "you have 100 points, put them
 * where you want more time". It shows strength of preference, which a
 * one-choice poll hides, and nobody can vote for everything.
 *
 * `checkSplit` says whether one person's split is valid: known options,
 * whole steps, nothing negative, the whole budget spent (or no more than it,
 * with `partial`). `totalPoints` adds the room's valid splits per option and
 * ranks them; invalid splits are left out, so a bad message cannot skew the
 * room, and each person counts once (the last split they sent).
 */

export interface PointsRules {
  /** @default 100 */
  budget?: number;
  /** Points move in steps of this size. @default 10 */
  step?: number;
  /** Allow sending before the whole budget is spent. @default false */
  partial?: boolean;
}

export type Split = Readonly<Record<string, number>>;

export type SplitRefusal = 'unknown-option' | 'not-a-step' | 'negative' | 'over-budget' | 'under-budget';

export function spentOf(split: Split): number {
  return Object.values(split).reduce((a, b) => a + b, 0);
}

export function checkSplit(
  split: Split,
  options: readonly string[],
  rules: PointsRules = {},
): { ok: true } | { ok: false; reason: SplitRefusal } {
  const { budget = 100, step = 10, partial = false } = rules;
  const known = new Set(options);
  for (const [id, n] of Object.entries(split)) {
    if (!known.has(id)) return { ok: false, reason: 'unknown-option' };
    if (!Number.isFinite(n) || n < 0) return { ok: false, reason: 'negative' };
    if (n % step !== 0) return { ok: false, reason: 'not-a-step' };
  }
  const spent = spentOf(split);
  if (spent > budget) return { ok: false, reason: 'over-budget' };
  if (!partial && spent < budget) return { ok: false, reason: 'under-budget' };
  return { ok: true };
}

export interface PointsTotal {
  id: string;
  points: number;
  /** 0 to 1 of all points the room spent. */
  share: number;
  /** People who put anything on this option. */
  backers: number;
}

/**
 * Room totals, most points first (ties keep the options' order). `splits`
 * maps each person to their split; pass the latest per person.
 */
export function totalPoints(
  splits: Readonly<Record<string, Split>>,
  options: readonly string[],
  rules: PointsRules = {},
): { totals: PointsTotal[]; people: number } {
  const sum = new Map(options.map((id) => [id, { points: 0, backers: 0 }]));
  let people = 0;
  for (const split of Object.values(splits)) {
    if (!checkSplit(split, options, rules).ok) continue;
    people++;
    for (const [id, n] of Object.entries(split)) {
      const row = sum.get(id) as { points: number; backers: number };
      row.points += n;
      if (n > 0) row.backers++;
    }
  }
  const all = [...sum.values()].reduce((a, r) => a + r.points, 0);
  const totals = options
    .map((id, i) => ({ id, i, ...(sum.get(id) as { points: number; backers: number }) }))
    .sort((a, b) => b.points - a.points || a.i - b.i)
    .map(({ id, points, backers }) => ({ id, points, backers, share: all > 0 ? points / all : 0 }));
  return { totals, people };
}

/** Moves `delta` points onto (or off) one option, kept within the budget and above zero. */
export function nudge(split: Split, id: string, delta: number, rules: PointsRules = {}): Split {
  const { budget = 100 } = rules;
  const current = split[id] ?? 0;
  const room = budget - spentOf(split);
  const next = Math.max(0, current + Math.min(delta, room));
  return { ...split, [id]: next };
}
