/**
 * @interlace/ui — dot-vote-model
 *
 * Brainstorm, then choose: everyone spreads a few dots across the ideas on
 * the wall, and the ideas with the most dots rise. A dot vote shows how
 * strongly people feel as well as what they chose, because a person can put
 * two dots on one idea.
 *
 * `cleanBallot` makes one person's dots valid: unknown ideas dropped, whole
 * non-negative counts, at most `maxPerIdea` on one idea and `dots` in all
 * (dots past the limit are dropped from the ideas listed last). `tallyDots`
 * takes ballots keyed by person, so a ballot sent twice counts once and the
 * latest ballot a person sends replaces the earlier one. Ties keep the
 * ideas' own order, so every screen ranks them the same way.
 */

export type DotBallot = Readonly<Record<string, number>>;

export interface DotRules {
  /** Dots each person has. @default 3 */
  dots?: number;
  /** Most dots on one idea. @default dots */
  maxPerIdea?: number;
}

export interface DotRow {
  id: string;
  dots: number;
  /** People who put at least one dot here. */
  people: number;
  /** 1 for the most dots; ideas on the same count share a rank. 0 for none. */
  rank: number;
}

export interface DotTally {
  /** Most dots first; ties in the ideas' order. */
  rows: DotRow[];
  /** All dots placed. */
  total: number;
  /** People who placed at least one dot. */
  voters: number;
}

function whole(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function limits(rules: DotRules): { dots: number; cap: number } {
  const dots = whole(rules.dots, 3);
  const cap = Math.min(dots, whole(rules.maxPerIdea, dots));
  return { dots, cap };
}

/** Dots still to place. */
export function dotsLeft(ballot: DotBallot, rules: DotRules = {}): number {
  const { dots } = limits(rules);
  const used = Object.values(ballot).reduce((a, n) => a + whole(n, 0), 0);
  return Math.max(0, dots - used);
}

/** One person's dots made valid, in the ideas' order. */
export function cleanBallot(
  ballot: DotBallot,
  ideaIds: readonly string[],
  rules: DotRules = {},
): Record<string, number> {
  const { dots, cap } = limits(rules);
  const out: Record<string, number> = {};
  let left = dots;
  for (const id of ideaIds) {
    if (left <= 0) break;
    const n = Math.min(cap, whole(ballot[id], 0), left);
    if (n > 0) {
      out[id] = n;
      left -= n;
    }
  }
  return out;
}

export function tallyDots(
  ballots: Readonly<Record<string, DotBallot>>,
  ideaIds: readonly string[],
  rules: DotRules = {},
): DotTally {
  const dots = new Map(ideaIds.map((id) => [id, 0]));
  const people = new Map(ideaIds.map((id) => [id, 0]));
  let voters = 0;
  for (const ballot of Object.values(ballots)) {
    const clean = cleanBallot(ballot ?? {}, ideaIds, rules);
    const ids = Object.keys(clean);
    if (ids.length > 0) voters += 1;
    for (const id of ids) {
      dots.set(id, (dots.get(id) as number) + (clean[id] as number));
      people.set(id, (people.get(id) as number) + 1);
    }
  }
  const order = new Map(ideaIds.map((id, i) => [id, i]));
  const rows = [...new Set(ideaIds)]
    .map((id) => ({ id, dots: dots.get(id) as number, people: people.get(id) as number, rank: 0 }))
    .sort((a, b) => b.dots - a.dots || (order.get(a.id) as number) - (order.get(b.id) as number));
  let rank = 0;
  rows.forEach((row, i) => {
    if (row.dots === 0) return;
    if (i === 0 || row.dots !== (rows[i - 1] as DotRow).dots) rank = i + 1;
    row.rank = rank;
  });
  return { rows, total: rows.reduce((a, r) => a + r.dots, 0), voters };
}
