/**
 * @interlace/ui — word-cloud-model
 *
 * Turns the words a room sent into the cloud it sees: grouped, counted,
 * ranked and sized. Pure, so a server can build the same cloud for a recap
 * page or an export.
 *
 * ## Grouping
 *
 * Two entries are the same word when their `foldText` forms match, so
 * "Coffee", "coffee " and "COFFEE" land on one word. The cloud shows the
 * spelling most people used (ties go to the first one sent). A sender (`by`)
 * counts once per word, and an entry with an `id` counts once however often
 * it arrives, so a reconnect that resends the room's words changes nothing. Stop words the
 * consumer passes are dropped; Interlace ships none, because they depend on
 * the language of the room.
 *
 * ## Size
 *
 * `step` is 1 to `steps` (default 5), on a square-root scale of the count, so
 * one runaway word does not shrink every other word to a dot. `share` is the
 * word's part of all words, 0 to 1.
 *
 * ## Order
 *
 * `words` come back in rank order (most first, then the first sent), the
 * order a screen reader hears. `cloudOrder` gives each rank a visual place:
 * the biggest words on a middle band, centre-out, with the smaller words
 * on bands above and below, which is how a cloud is read at a glance.
 */

import { foldText, tidyText } from './text-safety-model.js';

export interface CloudEntry {
  /** What was typed. */
  text: string;
  /** Who sent it, so `mine` can be marked. A person counts once per word. Optional. */
  by?: string;
  /** The entry's own id. An entry delivered twice (a reconnect, a retry) counts once. Optional. */
  id?: string;
}

export interface CloudWord {
  /** Stable id for the word (its folded form). */
  key: string;
  /** The spelling to show. */
  text: string;
  count: number;
  /** 0 to 1, of all counted words. */
  share: number;
  /** 1 (smallest) to `steps`. */
  step: number;
  /** 0 for the most-sent word. */
  rank: number;
  /** True when `viewer` sent it. */
  mine: boolean;
}

export interface CloudOptions {
  /** Keep at most this many words, the most-sent first. @default 50 */
  max?: number;
  /** Size steps. @default 5 */
  steps?: number;
  /** Words to leave out, matched on their folded form. */
  stopwords?: readonly string[];
  /** Marks the words this sender sent. */
  viewer?: string;
}

export interface Cloud {
  words: CloudWord[];
  /** Every counted word, including those past `max`. */
  total: number;
  /** Distinct words, including those past `max`. */
  distinct: number;
}

export function buildCloud(entries: readonly (CloudEntry | string)[], options: CloudOptions = {}): Cloud {
  const { max = 50, steps = 5, stopwords, viewer } = options;
  const stop = new Set((stopwords ?? []).map(foldText));
  const groups = new Map<string, { first: number; count: number; spellings: Map<string, number>; mine: boolean }>();
  const seenIds = new Set<string>();
  const seenVotes = new Set<string>();
  let total = 0;

  entries.forEach((entry, i) => {
    const e: CloudEntry = typeof entry === 'string' ? { text: entry } : entry;
    const text = tidyText(e.text);
    const key = foldText(text);
    if (!key || stop.has(key)) return;
    if (e.id !== undefined) {
      if (seenIds.has(e.id)) return;
      seenIds.add(e.id);
    }
    if (e.by !== undefined) {
      const vote = `${e.by}\u0000${key}`;
      if (seenVotes.has(vote)) return;
      seenVotes.add(vote);
    }
    total++;
    let g = groups.get(key);
    if (!g) {
      g = { first: i, count: 0, spellings: new Map(), mine: false };
      groups.set(key, g);
    }
    g.count++;
    g.spellings.set(text, (g.spellings.get(text) ?? 0) + 1);
    if (viewer !== undefined && e.by === viewer) g.mine = true;
  });

  const ranked = [...groups.entries()].sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first);
  const kept = ranked.slice(0, Math.max(0, max));
  const top = kept[0]?.[1].count ?? 0;
  const lowest = kept[kept.length - 1]?.[1].count ?? 0;
  const span = Math.sqrt(top) - Math.sqrt(lowest);
  const n = Math.max(1, Math.floor(steps));

  const words = kept.map(([key, g], rank): CloudWord => {
    let best = '';
    let bestN = 0;
    for (const [s, c] of g.spellings) {
      if (c > bestN) {
        best = s;
        bestN = c;
      }
    }
    // All kept words sent equally often: they share the top step.
    const t = span > 0 ? (Math.sqrt(g.count) - Math.sqrt(lowest)) / span : 1;
    return {
      key,
      text: best,
      count: g.count,
      // A kept word was counted, so `total` is at least 1.
      share: g.count / total,
      step: 1 + Math.round(t * (n - 1)),
      rank,
      mine: g.mine,
    };
  });

  return { words, total, distinct: groups.size };
}

/**
 * The visual slot for each rank among `n` words: rank 0 in the middle, then
 * alternating to either side, so the biggest words sit in the centre of a
 * wrapped, centred line of words.
 *
 *   centerOut(5) → [2, 3, 1, 4, 0]   (rank 0 at slot 2, rank 1 at slot 3, …)
 */
export function centerOut(n: number): number[] {
  const mid = Math.floor((n - 1) / 2);
  return Array.from({ length: Math.max(0, n) }, (_, rank) => {
    const off = Math.ceil(rank / 2);
    return rank % 2 === 1 ? mid + off : mid - off;
  });
}

/** The band a word sits on, and its CSS `order`, from `cloudOrder`. */
export interface CloudPlace {
  band: 'above' | 'middle' | 'below';
  order: number;
}

/** CSS `order` of the break before the middle band and the one after it. */
export const CLOUD_BREAKS = [999, 1999] as const;

/**
 * Where each rank goes among `n` words. The top `middle` ranks (default: a
 * third, at least 1 and at most 7) sit centre-out on the middle band; the
 * rest alternate above and below it, each band centre-out too, so the
 * small words frame the big ones.
 */
export function cloudOrder(n: number, middle?: number): CloudPlace[] {
  const count = Math.max(0, n);
  const mid = Math.min(count, middle ?? Math.min(7, Math.max(1, Math.ceil(count / 3))));
  const rest = count - mid;
  const aboveN = Math.ceil(rest / 2);
  const slotsMid = centerOut(mid);
  const slotsAbove = centerOut(aboveN);
  const slotsBelow = centerOut(rest - aboveN);
  return Array.from({ length: count }, (_, rank): CloudPlace => {
    if (rank < mid) return { band: 'middle', order: 1000 + (slotsMid[rank] as number) };
    const r = rank - mid;
    const i = Math.floor(r / 2);
    return r % 2 === 0
      ? { band: 'above', order: slotsAbove[i] as number }
      : { band: 'below', order: 2000 + (slotsBelow[i] as number) };
  });
}
