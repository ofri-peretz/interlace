/**
 * @interlace/ui — games/order-model
 *
 * Dealing and scoring for a put-them-in-order round: dates on a timeline,
 * sizes, rankings. Pure, so a server deals and scores the same round and a
 * share card can draw one mark per place without saying the answer.
 *
 * ## Two measures
 *
 * - `inPlace`: how many items sit exactly where they belong. Easy to say
 *   ("3 of 5 in the right place") and what the marks show.
 * - `pairs`: the share of all pairs the player put in the right relative
 *   order (1 − normalised Kendall distance). It is fairer than `inPlace`:
 *   one item dragged from the top to the bottom shifts every other item by
 *   one and zeroes `inPlace`, yet most pairs are still right. Points follow
 *   `pairs`.
 */

import { seededShuffle } from './daily.js';

export interface OrderScoreOptions {
  /** Points for a perfect order. @default 100 */
  maxPoints?: number;
}

export interface OrderResult {
  /** The player's order, as ids. */
  order: string[];
  /** The right order, as ids. */
  correct: string[];
  /** One flag per place in the player's order: is that item in its right place? */
  places: boolean[];
  /** Items in their right place. */
  inPlace: number;
  /** Share of pairs in the right relative order, 0–1. */
  pairs: number;
  points: number;
  perfect: boolean;
}

function assertSameItems(order: readonly string[], correct: readonly string[]) {
  const a = [...order].sort();
  const b = [...correct].sort();
  if (new Set(correct).size !== correct.length) throw new RangeError('ids must be unique');
  if (a.length !== b.length || a.some((id, i) => id !== b[i])) {
    throw new RangeError('order must hold exactly the same ids as correct');
  }
}

/** Score the player's order against the right one. */
export function scoreOrder(order: readonly string[], correct: readonly string[], options: OrderScoreOptions = {}): OrderResult {
  assertSameItems(order, correct);
  const { maxPoints = 100 } = options;
  const rank = new Map(correct.map((id, i) => [id, i]));
  const places = order.map((id, i) => rank.get(id) === i);
  const n = order.length;
  let good = 0;
  let all = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      all += 1;
      if ((rank.get(order[i] as string) as number) < (rank.get(order[j] as string) as number)) good += 1;
    }
  }
  const pairs = all === 0 ? 1 : good / all;
  const inPlace = places.filter(Boolean).length;
  return {
    order: [...order],
    correct: [...correct],
    places,
    inPlace,
    pairs,
    points: Math.round(maxPoints * pairs),
    perfect: inPlace === n,
  };
}

/**
 * A starting order for the round: seeded, so every player gets the same deal
 * on the same day, and never already solved (a round of two or more items
 * always starts with at least one item out of place).
 */
export function dealOrder(correct: readonly string[], seed: number | string): string[] {
  if (correct.length < 2) return [...correct];
  const out = seededShuffle(correct, seed);
  if (out.every((id, i) => id === correct[i])) out.push(out.shift() as string);
  return out;
}

/** `order` with the item at `from` moved to `to` (both clamped). */
export function moveItem<T>(order: readonly T[], from: number, to: number): T[] {
  const out = order.slice();
  if (from < 0 || from >= out.length) return out;
  const target = Math.min(out.length - 1, Math.max(0, to));
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item as T);
  return out;
}
