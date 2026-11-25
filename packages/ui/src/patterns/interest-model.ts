/**
 * @interlace/ui — interest-model
 *
 * The arithmetic behind "I want more on this": how many people asked for
 * more on each topic, ranked, with small counts held back. Pure, so the
 * presenter's screen, a dashboard and a server report rank the same way.
 *
 * A signal is not a vote. One person can ask for more on several topics,
 * so a topic's bar is drawn against the most-asked topic, not against a
 * total: `share` is 1 for the top topic and 0.5 for one with half its asks.
 */

export interface InterestRow {
  id: string;
  /** People who asked for more on this topic. */
  count: number;
  /** The viewer is one of them. */
  mine: boolean;
  /** 1 for the most-asked topic; ties share a rank. */
  rank: number;
  /** count ÷ the top count, 0 to 1, for a bar. */
  share: number;
}

export interface RankInterestOptions {
  /** Topic ids the viewer asked about. */
  mine?: readonly string[];
  /** `counts` already include the viewer's own asks. @default false */
  countsIncludeMine?: boolean;
  /** Hold back topics with fewer asks than this, so a small room gives no one away. @default 1 */
  minCount?: number;
  /** Keep only the first `top` rows after ranking. */
  top?: number;
}

export interface InterestRanking {
  /** Topics at or above `minCount`, most-asked first; equal counts keep the order given. */
  rows: InterestRow[];
  /** Topics with at least one ask that `minCount` held back. */
  held: number;
  /** Topics left out by `top`. */
  more: number;
  /** Every ask, on every topic, after the viewer's are added. */
  total: number;
}

const clean = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;

export function rankInterest(
  ids: readonly string[],
  counts: Readonly<Record<string, number>> = {},
  { mine = [], countsIncludeMine = false, minCount = 1, top }: RankInterestOptions = {},
): InterestRanking {
  const mineSet = new Set(mine);
  const floor = Math.max(1, Math.floor(minCount));
  const all = [...new Set(ids)].map((id, order) => {
    const own = mineSet.has(id);
    const count = clean(counts[id]) + (own && !countsIncludeMine ? 1 : 0);
    return { id, count, mine: own, order };
  });
  const total = all.reduce((sum, r) => sum + r.count, 0);
  const shown = all.filter((r) => r.count >= floor).sort((a, b) => b.count - a.count || a.order - b.order);
  const held = all.filter((r) => r.count > 0 && r.count < floor).length;
  // Every shown row has at least one ask, so the top count is never 0 here.
  const max = shown[0]?.count ?? 1;
  let rank = 0;
  let last = -1;
  const ranked = shown.map((r, i) => {
    if (r.count !== last) {
      rank = i + 1;
      last = r.count;
    }
    return { id: r.id, count: r.count, mine: r.mine, rank, share: r.count / max };
  });
  const keep = top === undefined ? ranked.length : Math.max(0, Math.floor(top));
  return { rows: ranked.slice(0, keep), held, more: Math.max(0, ranked.length - keep), total };
}
