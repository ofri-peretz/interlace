/**
 * @interlace/ui — ranking-model
 *
 * A room ranks the same items by preference ("what would you want to see
 * first?"), with no right answer. `tallyRankings` turns everyone's order
 * into the room's: each item gets points by place (a Borda count: last
 * place 0, first place n − 1), its average place, and how many put it
 * first. `roomAgreement` says how much people agree with the room's order,
 * from 0 (the opposite) to 1 (the same), as the share of pairs in the same
 * order (see `scoreOrder` in `order-model`).
 *
 * A ranking that is not exactly the items, once each, is left out, so a bad
 * message cannot skew the room; each person counts once.
 */

import { scoreOrder } from './order-model.js';

export interface RankedItem {
  id: string;
  /** Borda points, summed over people. */
  points: number;
  /** Average place, 1 for first. */
  meanPlace: number;
  /** People who put it first. */
  firsts: number;
}

/** True when `order` holds every item exactly once. */
export function isFullRanking(order: readonly string[], items: readonly string[]): boolean {
  if (order.length !== items.length) return false;
  const set = new Set(order);
  return set.size === items.length && items.every((id) => set.has(id));
}

/**
 * The room's order, most preferred first. Ties go to more first places,
 * then to the items' given order. `meanPlace` is 0 when nobody has ranked.
 */
export function tallyRankings(
  rankings: Readonly<Record<string, readonly string[]>>,
  items: readonly string[],
): { items: RankedItem[]; people: number } {
  const n = items.length;
  const rows = new Map(items.map((id, i) => [id, { id, i, points: 0, places: 0, firsts: 0 }]));
  let people = 0;
  for (const order of Object.values(rankings)) {
    if (!isFullRanking(order, items)) continue;
    people++;
    order.forEach((id, place) => {
      const row = rows.get(id) as { points: number; places: number; firsts: number };
      row.points += n - 1 - place;
      row.places += place + 1;
      if (place === 0) row.firsts++;
    });
  }
  const ranked = [...rows.values()]
    .sort((a, b) => b.points - a.points || b.firsts - a.firsts || a.i - b.i)
    .map(({ id, points, places, firsts }) => ({
      id,
      points,
      firsts,
      meanPlace: people === 0 ? 0 : places / people,
    }));
  return { items: ranked, people };
}

/** How much the room agrees with its own order, 0 to 1; null with nobody. */
export function roomAgreement(
  rankings: Readonly<Record<string, readonly string[]>>,
  items: readonly string[],
): number | null {
  const valid = Object.values(rankings).filter((o) => isFullRanking(o, items));
  if (valid.length === 0) return null;
  const room = tallyRankings(rankings, items).items.map((r) => r.id);
  return valid.reduce((sum, o) => sum + scoreOrder(o, room).pairs, 0) / valid.length;
}
