/**
 * @interlace/ui — games/tally-model
 *
 * Counts per option turned into shares a reader can trust: whole percents
 * that add up to exactly 100, the viewer's own choice included once, and the
 * leading option named. Pure, so a server can return the same numbers the
 * client draws, and a poll and a quiz share one rule.
 *
 * ## Percents that add up
 *
 * Rounding each share on its own can give 33 + 33 + 33 = 99. The largest
 * remainder method hands the missing points to the options that lost the
 * most to rounding, so the column always sums to 100 (or to 0 when nobody
 * has voted).
 *
 * ## The viewer's vote
 *
 * A poll usually knows the tally from the server and the viewer's choice
 * from the tap that just happened. Pass the server counts with
 * `countsIncludeVote: false` (the default) and the viewer's vote is added
 * once, so the bars move the moment they tap. When the server's counts
 * already hold it (a reload), pass `countsIncludeVote: true`.
 */

export interface TallyRow {
  id: string;
  count: number;
  /** count / total, 0–1. 0 when nobody has voted. */
  share: number;
  /** Whole percent; the rows sum to 100 when total > 0. */
  percent: number;
  /** The viewer's own choice. */
  mine: boolean;
  /** Has the highest count (ties all lead). False when nobody has voted. */
  leading: boolean;
}

export interface TallyOptions {
  /** The viewer's choice, if any. */
  vote?: string | null;
  /** The counts already include the viewer's vote. @default false */
  countsIncludeVote?: boolean;
}

export interface Tally {
  rows: TallyRow[];
  total: number;
}

/** Whole percents that sum to 100 (largest remainder). All 0 when the total is 0. */
export function wholePercents(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return counts.map(() => 0);
  const exact = counts.map((c) => (c / total) * 100);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, rest: e - Math.floor(e) }))
    // Biggest remainder first; on a tie the earlier option wins, so the result is stable.
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] = (out[i] as number) + 1;
    left -= 1;
  }
  return out;
}

/** The rows for `ids`, in that order. Unknown ids count 0; negative or non-finite counts count 0. */
export function tally(
  ids: readonly string[],
  counts: Readonly<Record<string, number>> = {},
  options: TallyOptions = {},
): Tally {
  const { vote = null, countsIncludeVote = false } = options;
  const raw = ids.map((id) => {
    const n = counts[id];
    const base = typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    return id === vote && !countsIncludeVote ? base + 1 : base;
  });
  const total = raw.reduce((a, b) => a + b, 0);
  const percents = wholePercents(raw);
  const top = Math.max(0, ...raw);
  return {
    total,
    rows: ids.map((id, i) => ({
      id,
      count: raw[i] as number,
      share: total > 0 ? (raw[i] as number) / total : 0,
      percent: percents[i] as number,
      mine: vote !== null && id === vote,
      leading: top > 0 && raw[i] === top,
    })),
  };
}
