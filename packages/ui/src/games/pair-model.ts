/**
 * @interlace/ui — games/pair-model
 *
 * Pair talk for a live room: players are paired (one group of three when the number is odd), each
 * pair gets a prompt card and a timer, and "swap partners" pairs everyone again with someone new.
 * Pure, so the host and a server run the same rules.
 *
 * The state lives in the room (`RoomState.shared.pairs`, written with a `share` event), so a phone
 * that joins late or reconnects shows its partner and card at once, the newest `seq` wins whatever
 * order messages arrive in, and a host that restores the room restores the pairs, with the timer
 * still running to the same moment (`endsAt` is a host timestamp).
 *
 * ## Swapping
 *
 * `swapPartners` tries a number of shuffles and keeps the one with the fewest repeat pairings
 * (`seen` remembers every pairing so far). With enough players nobody meets the same person
 * twice; with few, repeats are kept as low as they can be. Cards are dealt from a shuffled deck,
 * one after another, so a card does not come round again before the whole deck has been used.
 */

import { readShared, type RoomHostEvent, type RoomPlayer, type RoomState } from './room-model.js';
import { isId, isRecord, shuffled, type Random } from './group-model.js';

/** The key in `RoomState.shared`. */
export const PAIRS_KEY = 'pairs';
/** The longest prompt, in characters. */
export const MAX_PROMPT = 200;
const MAX_DECK = 100;
const MAX_SEEN = 2_000;
const TRIES = 24;

export interface Pair {
  /** `a1`, `a2`, … */
  id: string;
  /** Player ids: two, or three when the room is odd, or one when a lone player waits for a partner. */
  members: string[];
  /** The card this pair talks about. Empty when the deck is empty. */
  prompt: string;
}

export interface PairsState {
  /** 1 for the first pairing, then up by one with each swap. */
  round: number;
  pairs: Pair[];
  /** The deck the cards are dealt from. */
  deck: string[];
  /** The deal order: indices into `deck`. */
  order: number[];
  /** How many cards have been dealt from `order` (it is reshuffled and starts again at the end). */
  cursor: number;
  /** Every pairing so far, as "idA|idB" with the ids sorted, so a swap can avoid repeats. */
  seen: string[];
  /** When this round started, in ms (host clock). */
  startedAt: number;
  /** When time is up, in ms (host clock). null: no timer. */
  endsAt: number | null;
}

export interface PairOptions {
  /** When the round starts, in ms (host clock). */
  now: number;
  /** How long each round lasts, in seconds. Leave out for no timer. */
  seconds?: number | null;
  /** @default Math.random */
  random?: Random;
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** All the pairings inside one group, as keys. */
const keysOf = (members: readonly string[]): string[] =>
  members.flatMap((a, i) => members.slice(i + 1).map((b) => key(a, b)));

/** A prompt as kept: trimmed, spaces collapsed, cut to `MAX_PROMPT`. */
function clipPrompt(text: string): string {
  return Array.from(text.trim().replace(/\s+/g, ' ')).slice(0, MAX_PROMPT).join('').trim();
}

/** Deals cards from the deck in its shuffled order, reshuffling when it runs out. */
function dealer(state: Pick<PairsState, 'deck' | 'order' | 'cursor'>, random?: Random) {
  let { order, cursor } = state;
  return {
    next(): string {
      if (!state.deck.length) return '';
      if (cursor >= order.length) {
        order = shuffled(
          state.deck.map((_, i) => i),
          random,
        );
        cursor = 0;
      }
      return state.deck[order[cursor++] as number] as string;
    },
    position: () => ({ order, cursor }),
  };
}

/** The groups for one round: pairs, and an odd player added to the pair that costs the fewest repeats. */
function arrange(ids: readonly string[], seen: ReadonlySet<string>, random?: Random): string[][] {
  let best: string[][] = [];
  let fewest = Infinity;
  for (let attempt = 0; attempt < TRIES && fewest > 0; attempt++) {
    const pool = shuffled(ids, random);
    const groups: string[][] = [];
    // Each player takes the first partner they have not met, if any is left.
    while (pool.length >= 2) {
      const a = pool.shift() as string;
      const fresh = pool.findIndex((b) => !seen.has(key(a, b)));
      groups.push([a, pool.splice(Math.max(0, fresh), 1)[0] as string]);
    }
    const odd = pool[0];
    if (odd !== undefined) {
      const cost = (g: string[]) => g.filter((m) => seen.has(key(m, odd))).length;
      const home = groups.reduce<string[] | null>((a, g) => (a && cost(a) <= cost(g) ? a : g), null);
      if (home) home.push(odd);
      else groups.push([odd]);
    }
    const repeats = groups.reduce((n, g) => n + keysOf(g).filter((k) => seen.has(k)).length, 0);
    if (repeats < fewest) {
      fewest = repeats;
      best = groups;
    }
  }
  return best;
}

function build(
  prev: Pick<PairsState, 'round' | 'deck' | 'order' | 'cursor' | 'seen'> | null,
  players: readonly RoomPlayer[],
  prompts: readonly string[],
  options: PairOptions,
): PairsState | null {
  if (!players.length) return null;
  const { now, seconds = null, random } = options;
  const deck = prev ? prev.deck : prompts.map(clipPrompt).filter(Boolean).slice(0, MAX_DECK);
  const deal = dealer(
    prev ?? {
      deck,
      order: shuffled(
        deck.map((_, i) => i),
        random,
      ),
      cursor: 0,
    },
    random,
  );
  const seen = new Set(prev?.seen);
  const pairs = arrange(
    players.map((p) => p.id),
    seen,
    random,
  ).map((members, i) => {
    keysOf(members).forEach((k) => seen.add(k));
    return { id: `a${i + 1}`, members, prompt: deal.next() };
  });
  return {
    round: (prev?.round ?? 0) + 1,
    pairs,
    deck,
    ...deal.position(),
    seen: [...seen].slice(-MAX_SEEN),
    startedAt: now,
    endsAt: seconds === null ? null : now + Math.max(0, seconds) * 1000,
  };
}

/** Pairs `players` for the first round and deals a card to each pair. Null when there is no one. */
export function startPairs(
  players: readonly RoomPlayer[],
  prompts: readonly string[],
  options: PairOptions,
): PairsState | null {
  return build(null, players, prompts, options);
}

/** Pairs `players` again, with new partners where it can and new cards, and a fresh timer. */
export function swapPartners(state: PairsState, players: readonly RoomPlayer[], options: PairOptions): PairsState | null {
  return build(state, players, [], options);
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const count = (v: unknown, min: number): v is number => num(v) && Number.isInteger(v) && v >= min;

/** Pairs from untrusted data (a `share` value), or null when it is not pairs. */
export function decodePairs(raw: unknown): PairsState | null {
  if (!isRecord(raw) || !Array.isArray(raw.pairs) || !Array.isArray(raw.deck) || !Array.isArray(raw.order)) return null;
  if (!count(raw.round, 1) || !count(raw.cursor, 0) || !num(raw.startedAt)) return null;
  const endsAt = raw.endsAt === null || raw.endsAt === undefined ? null : num(raw.endsAt) ? raw.endsAt : undefined;
  if (endsAt === undefined || raw.deck.length > MAX_DECK || raw.pairs.length > 1_000) return null;
  const deck = raw.deck.filter((d): d is string => typeof d === 'string').map(clipPrompt);
  const order = raw.order.filter((i): i is number => count(i, 0) && i < deck.length);
  const pairs: Pair[] = [];
  const placed = new Set<string>();
  for (const p of raw.pairs) {
    if (!isRecord(p) || !isId(p.id) || typeof p.prompt !== 'string' || !Array.isArray(p.members)) return null;
    const members: string[] = [];
    for (const m of p.members) {
      if (typeof m === 'string' && !placed.has(m)) {
        placed.add(m);
        members.push(m);
      }
    }
    if (!members.length || members.length > 3) return null;
    pairs.push({ id: p.id, members, prompt: clipPrompt(p.prompt) });
  }
  const seen = Array.isArray(raw.seen) ? raw.seen.filter((s): s is string => typeof s === 'string').slice(-MAX_SEEN) : [];
  return { round: raw.round, pairs, deck, order, cursor: raw.cursor, seen, startedAt: raw.startedAt, endsAt };
}

/** The room's pairs, with anyone no longer in the room dropped; null when none are set. */
export function readPairs(room: Pick<RoomState, 'shared' | 'players'> | null | undefined): PairsState | null {
  const state = readShared(room, PAIRS_KEY, decodePairs);
  if (!state || !room) return state;
  const here = new Set(room.players.map((p) => p.id));
  return {
    ...state,
    pairs: state.pairs
      .map((p) => ({ ...p, members: p.members.filter((m) => here.has(m)) }))
      .filter((p) => p.members.length > 0),
  };
}

/** The host event that sets the pairs for every screen, or removes them with null. */
export function pairsEvent(state: PairsState | null): RoomHostEvent {
  return { type: 'share', key: PAIRS_KEY, value: state };
}

/** The pair a player is in and who else is in it; null when they have no pair (joined after the pairing). */
export function partnerOf(state: PairsState, playerId: string): { pair: Pair; partners: string[] } | null {
  const pair = state.pairs.find((p) => p.members.includes(playerId));
  return pair ? { pair, partners: pair.members.filter((m) => m !== playerId) } : null;
}

/**
 * Pairs the players who have no pair yet (they joined after the pairing, or their partner was
 * removed): two or more are paired together; a last one joins a pair, making it three, or waits
 * alone if there is no pair. The same object when everyone has a pair.
 */
export function placeNewcomers(state: PairsState, players: readonly RoomPlayer[], random?: Random): PairsState {
  const loose = players.filter((p) => !state.pairs.some((pair) => pair.members.includes(p.id))).map((p) => p.id);
  if (!loose.length) return state;
  const pairs = state.pairs.map((p) => ({ ...p, members: [...p.members] }));
  const deal = dealer(state, random);
  const seen = new Set(state.seen);
  const nextId = () => `a${pairs.reduce((n, p) => Math.max(n, Number(p.id.slice(1)) || 0), 0) + 1}`;
  const rest = shuffled(loose, random);
  while (rest.length >= 2) {
    const members = [rest.pop() as string, rest.pop() as string];
    pairs.push({ id: nextId(), members, prompt: deal.next() });
    keysOf(members).forEach((k) => seen.add(k));
  }
  const lone = rest[0];
  if (lone !== undefined) {
    const home = pairs.find((p) => p.members.length === 2);
    if (home) {
      keysOf([...home.members, lone]).forEach((k) => seen.add(k));
      home.members.push(lone);
    } else pairs.push({ id: nextId(), members: [lone], prompt: deal.next() });
  }
  return { ...state, pairs, ...deal.position(), seen: [...seen].slice(-MAX_SEEN) };
}

/** Deals a pair a new card (the next in the deck). The same object when the pair or the deck is missing. */
export function newCard(state: PairsState, pairId: string, random?: Random): PairsState {
  if (!state.deck.length || !state.pairs.some((p) => p.id === pairId)) return state;
  const deal = dealer(state, random);
  const prompt = deal.next();
  return { ...state, ...deal.position(), pairs: state.pairs.map((p) => (p.id === pairId ? { ...p, prompt } : p)) };
}

/** Gives the pairs `seconds` more (from now, if time is up or there was no timer). */
export function extendPairs(state: PairsState, seconds: number, now: number): PairsState {
  if (!(seconds > 0)) return state;
  return { ...state, endsAt: Math.max(state.endsAt ?? now, now) + seconds * 1000 };
}

/** Whole seconds until time is up, 0 once it has passed, null with no timer. */
export function pairSecondsLeft(state: PairsState, now: number): number | null {
  return state.endsAt === null ? null : Math.max(0, Math.ceil((state.endsAt - now) / 1000));
}
