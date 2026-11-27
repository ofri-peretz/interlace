/**
 * @interlace/ui — note-board-model
 *
 * A board of sticky notes in columns: a retrospective ("Keep / Change /
 * Try"), an affinity sort, a "before / during / after" map. People post
 * notes into a column, and notes are moved as the room sorts them.
 *
 * The board is folded from two streams of events: notes posted and moves.
 * Each note sits in the column of its latest move (by time; on the same
 * time, the column listed later wins), so every screen agrees whatever
 * order the events arrive in and however many times one is delivered. A
 * note posted twice keeps its first posting. A note or move naming a
 * column that does not exist is dropped. Inside a column, notes stay in the
 * order they were posted.
 */

export interface BoardNote {
  id: string;
  column: string;
  text: string;
  /** When it was posted, in ms. */
  at: number;
}

export interface BoardMove {
  /** The note moved. */
  id: string;
  /** The column it moved to. */
  column: string;
  /** When, in ms. */
  at: number;
}

export interface BoardColumn {
  id: string;
  notes: BoardNote[];
}

const byPost = (a: BoardNote, b: BoardNote) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function foldBoard(
  columnIds: readonly string[],
  notes: readonly BoardNote[],
  moves: readonly BoardMove[] = [],
): BoardColumn[] {
  const rank = new Map(columnIds.map((id, i) => [id, i]));
  const first = new Map<string, BoardNote>();
  for (const n of notes) {
    if (!n || !rank.has(n.column) || !Number.isFinite(n.at)) continue;
    const had = first.get(n.id);
    if (!had || byPost(n, had) < 0) first.set(n.id, n);
  }
  const latest = new Map<string, BoardMove>();
  for (const m of moves) {
    if (!m || !rank.has(m.column) || !Number.isFinite(m.at)) continue;
    const had = latest.get(m.id);
    const later =
      !had || m.at > had.at || (m.at === had.at && (rank.get(m.column) as number) > (rank.get(had.column) as number));
    if (later) latest.set(m.id, m);
  }
  const out = new Map(columnIds.map((id) => [id, [] as BoardNote[]]));
  for (const n of first.values()) {
    const move = latest.get(n.id);
    const column = move && move.at >= n.at ? move.column : n.column;
    out.get(column)?.push(column === n.column ? n : { ...n, column });
  }
  return [...out].map(([id, list]) => ({ id, notes: list.sort(byPost) }));
}
