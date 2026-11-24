/**
 * @interlace/ui — games/leaderboard-model
 *
 * Ranking for a group's board: ties share a rank (1, 2, 2, 4), the board
 * stays hidden until enough people have played, and the player's own row is
 * found even when it falls outside the top rows. Pure, so the server that
 * stores scores ranks them the same way.
 *
 * ## Why a minimum
 *
 * A board of two people tells each of them exactly what the other scored.
 * `minPlayers` keeps a small group's scores private until there are enough
 * of them to stand in a crowd.
 */

export interface LeaderboardEntry {
  /** Stable id: a player or a group. */
  id: string;
  /** What the board shows. */
  name: string;
  score: number;
  /** Breaks ties on score: lower first (time taken, say). Equal or missing values share a rank. */
  tiebreak?: number;
}

export interface RankedEntry extends LeaderboardEntry {
  /** 1-based; ties share a rank and the next rank skips (1, 2, 2, 4). */
  rank: number;
  /** True when another entry has the same rank. */
  tied: boolean;
}

export interface RankOptions {
  /** `desc` when a higher score wins. @default 'desc' */
  order?: 'desc' | 'asc';
  /** Below this many entries the board is hidden. @default 1 */
  minPlayers?: number;
  /** Rows to show from the top. @default all */
  limit?: number;
  /** The viewing player's id: their row is kept even outside `limit`. */
  currentId?: string;
}

export interface RankedBoard {
  /** False while fewer than `minPlayers` have played. */
  visible: boolean;
  /** Entries counted. */
  players: number;
  /** The top rows, within `limit`. Empty while hidden. */
  top: RankedEntry[];
  /** The viewing player's row when it falls outside `top`. */
  current?: RankedEntry;
}

/** Rank every entry. */
export function rankEntries(entries: readonly LeaderboardEntry[], order: 'desc' | 'asc' = 'desc'): RankedEntry[] {
  const sign = order === 'desc' ? -1 : 1;
  const sorted = entries
    .slice()
    .sort(
      (a, b) =>
        sign * (a.score - b.score) || (a.tiebreak ?? Infinity) - (b.tiebreak ?? Infinity) || a.name.localeCompare(b.name),
    );
  const same = (a: LeaderboardEntry, b: LeaderboardEntry) => a.score === b.score && (a.tiebreak ?? null) === (b.tiebreak ?? null);
  const ranked: RankedEntry[] = [];
  sorted.forEach((entry, i) => {
    const prev = sorted[i - 1];
    const rank = prev && same(prev, entry) ? (ranked[i - 1] as RankedEntry).rank : i + 1;
    ranked.push({ ...entry, rank, tied: false });
  });
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i] as RankedEntry;
    r.tied = ranked[i - 1]?.rank === r.rank || ranked[i + 1]?.rank === r.rank;
  }
  return ranked;
}

/** The board as a page shows it: hidden below the minimum, top rows, and the viewer's own row. */
export function buildBoard(entries: readonly LeaderboardEntry[], options: RankOptions = {}): RankedBoard {
  const { order = 'desc', minPlayers = 1, limit, currentId } = options;
  const players = entries.length;
  if (players < Math.max(1, minPlayers)) return { visible: false, players, top: [] };
  const ranked = rankEntries(entries, order);
  const top = limit === undefined ? ranked : ranked.slice(0, limit);
  const mine = currentId === undefined ? undefined : ranked.find((e) => e.id === currentId);
  const current = mine && !top.includes(mine) ? mine : undefined;
  return { visible: true, players, top, current };
}
