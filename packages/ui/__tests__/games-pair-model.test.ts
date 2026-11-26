/**
 * Pair talk: the pairing, the cards, swapping partners, newcomers, and reading pairs back from a
 * room as untrusted data.
 */
import { describe, expect, it } from 'vitest';

import { applyRoomEvent, createRoom, type RoomPlayer, type RoomState } from '../src/games/room-model.js';
import { seededRandom } from '../src/games/group-model.js';
import {
  decodePairs,
  extendPairs,
  MAX_PROMPT,
  newCard,
  pairSecondsLeft,
  pairsEvent,
  partnerOf,
  placeNewcomers,
  readPairs,
  startPairs,
  swapPartners,
  type PairsState,
} from '../src/games/pair-model.js';

const HOST = 'host';
const NOW = 5_000_000;
const DECK = ['Best trip?', 'A tool you love?', 'Hardest bug?', 'Favourite meeting?'];

function roomOf(n: number): RoomState {
  let r = createRoom({ code: 'K7Q4MZ', hostId: HOST });
  for (let i = 0; i < n; i++) r = applyRoomEvent(r, { type: 'join', playerId: `p${i}`, name: `Player ${i}` }, `p${i}`);
  return r;
}

const start = (n: number, seed = 1, prompts: readonly string[] = DECK, seconds: number | null = 120) =>
  startPairs(roomOf(n).players, prompts, { now: NOW, seconds, random: seededRandom(seed) })!;

const everyone = (s: PairsState) => s.pairs.flatMap((p) => p.members).sort();
const shape = (s: PairsState) => s.pairs.map((p) => p.members.length).sort();

describe('startPairs', () => {
  it('pairs an even room, everyone once, each pair with a card', () => {
    const s = start(30);
    expect(s.round).toBe(1);
    expect(s.pairs).toHaveLength(15);
    expect(shape(s).every((n) => n === 2)).toBe(true);
    expect(everyone(s)).toEqual(roomOf(30).players.map((p) => p.id).sort());
    expect(s.pairs.every((p) => DECK.includes(p.prompt))).toBe(true);
    expect(s.pairs.map((p) => p.id)).toEqual(Array.from({ length: 15 }, (_, i) => `a${i + 1}`));
  });

  it('makes one group of three when the room is odd, and a lone player waits', () => {
    expect(shape(start(7))).toEqual([2, 2, 3]);
    expect(shape(start(3))).toEqual([3]);
    expect(shape(start(1))).toEqual([1]);
    expect(start(1).pairs[0]!.members).toEqual(['p0']);
  });

  it('is null for an empty room, and repeatable with a seed', () => {
    expect(startPairs([], DECK, { now: NOW })).toBeNull();
    expect(start(10, 5)).toEqual(start(10, 5));
    expect(start(10, 5)).not.toEqual(start(10, 6));
  });

  it('times the round from the clock it is given, or not at all', () => {
    expect(start(4)).toMatchObject({ startedAt: NOW, endsAt: NOW + 120_000 });
    expect(start(4, 1, DECK, null).endsAt).toBeNull();
    expect(start(4, 1, DECK, -9).endsAt).toBe(NOW);
  });

  it('cleans the deck: spaces, length, empties and a cap', () => {
    const s = start(4, 1, ['  a   b ', '', '   ', 'x'.repeat(500)]);
    expect(s.deck).toEqual(['a b', 'x'.repeat(MAX_PROMPT)]);
    expect(start(4, 1, Array.from({ length: 300 }, (_, i) => `q${i}`)).deck).toHaveLength(100);
  });

  it('deals empty cards when there is no deck', () => {
    const s = start(4, 1, []);
    expect(s.pairs.every((p) => p.prompt === '')).toBe(true);
    expect(s.deck).toEqual([]);
  });

  it('deals different cards down the deck before any repeats', () => {
    const s = start(8, 1, DECK);
    expect(new Set(s.pairs.map((p) => p.prompt)).size).toBe(4);
    const more = start(10, 1, DECK);
    expect(more.pairs.map((p) => p.prompt).filter((x) => x === more.pairs[0]!.prompt).length).toBeLessThanOrEqual(2);
  });
});

describe('swapPartners', () => {
  it('pairs everyone again with new partners when it can, and a new round', () => {
    const room = roomOf(30);
    let s = startPairs(room.players, DECK, { now: NOW, random: seededRandom(3) })!;
    const met = (x: PairsState) => new Set(x.pairs.map((p) => [...p.members].sort().join('|')));
    const first = met(s);
    s = swapPartners(s, room.players, { now: NOW + 1000, seconds: 60, random: seededRandom(4) })!;
    expect(s.round).toBe(2);
    expect(s).toMatchObject({ startedAt: NOW + 1000, endsAt: NOW + 61_000 });
    expect([...met(s)].filter((k) => first.has(k))).toEqual([]);
    expect(everyone(s)).toEqual(room.players.map((p) => p.id).sort());
  });

  it('never repeats a pairing across many swaps while there are fresh partners', () => {
    const room = roomOf(20);
    let s = startPairs(room.players, DECK, { now: NOW, random: seededRandom(11) })!;
    const seen = new Set<string>();
    const note = (x: PairsState) => {
      for (const p of x.pairs) {
        const key = [...p.members].sort().join('|');
        expect(seen.has(key), `repeat ${key} in round ${x.round}`).toBe(false);
        seen.add(key);
      }
    };
    note(s);
    for (let round = 2; round <= 8; round++) {
      s = swapPartners(s, room.players, { now: NOW + round, random: seededRandom(round) })!;
      note(s);
    }
  });

  it('keeps repeats as low as they can be when there are few players', () => {
    const room = roomOf(4);
    let s = startPairs(room.players, DECK, { now: NOW, random: seededRandom(1) })!;
    for (let r = 0; r < 3; r++) {
      s = swapPartners(s, room.players, { now: NOW, random: seededRandom(r) })!;
      expect(everyone(s)).toEqual(['p0', 'p1', 'p2', 'p3']);
    }
    expect(s.round).toBe(4);
  });

  it('pairs only the players it is given, so someone who left is not paired', () => {
    const room = roomOf(6);
    const s = startPairs(room.players, DECK, { now: NOW, random: seededRandom(1) })!;
    const left = swapPartners(s, room.players.slice(0, 5), { now: NOW, random: seededRandom(2) })!;
    expect(everyone(left)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(shape(left)).toEqual([2, 3]);
    expect(swapPartners(s, [], { now: NOW })).toBeNull();
  });

  it('prefers the pair that adds the fewest repeats to the odd player', () => {
    const room = roomOf(5);
    let s = startPairs(room.players, DECK, { now: NOW, random: seededRandom(2) })!;
    for (let r = 0; r < 4; r++) s = swapPartners(s, room.players, { now: NOW, random: seededRandom(10 + r) })!;
    expect(shape(s)).toEqual([2, 3]);
  });

  it('keeps the history bounded', () => {
    const room = roomOf(80);
    let s = startPairs(room.players, DECK, { now: NOW, random: seededRandom(1) })!;
    for (let r = 0; r < 60; r++) s = swapPartners(s, room.players, { now: NOW, random: seededRandom(r) })!;
    expect(s.seen.length).toBeLessThanOrEqual(2000);
  });

  it('reshuffles the deck when it has been dealt through', () => {
    const room = roomOf(4);
    let s = startPairs(room.players, ['one', 'two'], { now: NOW, random: seededRandom(1) })!;
    for (let r = 0; r < 5; r++) {
      s = swapPartners(s, room.players, { now: NOW, random: seededRandom(r) })!;
      expect(s.pairs.every((p) => p.prompt === 'one' || p.prompt === 'two')).toBe(true);
    }
    expect(s.cursor).toBeLessThanOrEqual(2);
  });
});

describe('partners, newcomers and cards', () => {
  it('finds a player\'s partners and card', () => {
    const s = start(7);
    const mine = partnerOf(s, 'p0')!;
    expect(mine.pair.members).toContain('p0');
    expect(mine.partners).toEqual(mine.pair.members.filter((m) => m !== 'p0'));
    expect(partnerOf(s, 'ghost')).toBeNull();
  });

  it('pairs latecomers together, a last one joins a pair, and nobody is left out', () => {
    const room = roomOf(9);
    const s = startPairs(room.players.slice(0, 4), DECK, { now: NOW, random: seededRandom(1) })!;
    expect(placeNewcomers(s, room.players.slice(0, 4))).toBe(s);
    const five = placeNewcomers(s, room.players.slice(0, 9), seededRandom(2));
    expect(everyone(five)).toEqual(room.players.map((p) => p.id).sort());
    expect(shape(five)).toEqual([2, 2, 2, 3]);
    expect(five.pairs.every((p) => p.prompt !== '')).toBe(true);
    expect(five.pairs.map((p) => p.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
    const ids = new Set(five.pairs.map((p) => p.id));
    expect(ids.size).toBe(4);
  });

  it('makes a lone newcomer a trio when there is a pair, and a waiting pair when there is none', () => {
    const room = roomOf(4);
    const s = startPairs(room.players.slice(0, 3), DECK, { now: NOW, random: seededRandom(1) })!; // one trio
    const joined = placeNewcomers(s, room.players.slice(0, 4));
    expect(shape(joined)).toEqual([1, 3]);
    expect(partnerOf(joined, 'p3')!.partners).toEqual([]);
    const empty = placeNewcomers({ ...s, pairs: [] }, room.players.slice(0, 1));
    expect(shape(empty)).toEqual([1]);
    expect(empty.pairs[0]!.id).toBe('a1');
    // An id that is not a1, a2, … does not confuse the numbering.
    const odd = placeNewcomers({ ...s, pairs: [{ id: 'front', members: ['p0', 'p1'], prompt: '' }] }, room.players.slice(0, 4));
    expect(odd.pairs.map((p) => p.id)).toEqual(['front', 'a1']);
  });

  it('deals empty cards to newcomers when there is no deck', () => {
    const room = roomOf(5);
    const s = startPairs(room.players.slice(0, 2), [], { now: NOW, random: seededRandom(1) })!;
    const more = placeNewcomers(s, room.players, seededRandom(1));
    expect(more.pairs.every((p) => p.prompt === '')).toBe(true);
  });

  it('reshuffles for newcomers when the deck is used up', () => {
    const room = roomOf(8);
    const s = startPairs(room.players.slice(0, 2), ['solo'], { now: NOW, random: seededRandom(1) })!;
    const more = placeNewcomers(s, room.players, seededRandom(1));
    expect(more.pairs.map((p) => p.prompt)).toEqual(['solo', 'solo', 'solo', 'solo']);
  });

  it('gives one pair a new card, and nothing else changes', () => {
    const s = start(6, 1, DECK);
    const next = newCard(s, 'a1', seededRandom(1));
    expect(next.pairs[0]!.prompt).not.toBe(s.pairs[0]!.prompt);
    expect(next.pairs.slice(1)).toEqual(s.pairs.slice(1));
    expect(next.cursor).toBe(s.cursor + 1);
    expect(newCard(s, 'zz')).toBe(s);
    expect(newCard(start(6, 1, []), 'a1')).toEqual(start(6, 1, []));
    // At the end of the deck the cards are reshuffled and go on.
    let t = start(2, 1, ['a', 'b']);
    for (let i = 0; i < 6; i++) t = newCard(t, 'a1', seededRandom(i));
    expect(['a', 'b']).toContain(t.pairs[0]!.prompt);
  });

  it('gives more time, from the deadline or from now', () => {
    const s = start(4, 1, DECK, 60);
    expect(extendPairs(s, 30, NOW + 10_000).endsAt).toBe(NOW + 90_000);
    expect(extendPairs(s, 30, NOW + 100_000).endsAt).toBe(NOW + 130_000);
    expect(extendPairs(start(4, 1, DECK, null), 30, NOW).endsAt).toBe(NOW + 30_000);
    expect(extendPairs(s, 0, NOW)).toBe(s);
    expect(extendPairs(s, Number.NaN, NOW)).toBe(s);
    expect(pairSecondsLeft(s, NOW)).toBe(60);
    expect(pairSecondsLeft(s, NOW + 999_999)).toBe(0);
    expect(pairSecondsLeft(start(4, 1, DECK, null), NOW)).toBeNull();
  });
});

describe('reading pairs from a room', () => {
  const share = (room: RoomState, value: unknown) => applyRoomEvent(room, { type: 'share', key: 'pairs', value }, HOST);

  it('round-trips through the room, and drops players who left it', () => {
    const room = roomOf(6);
    const s = startPairs(room.players, DECK, { now: NOW, random: seededRandom(1) })!;
    let shared = share(room, s);
    expect(readPairs(shared)).toEqual(s);
    shared = applyRoomEvent(shared, { type: 'remove', playerId: 'p0' }, HOST);
    const read = readPairs(shared)!;
    expect(everyone(read)).not.toContain('p0');
    const emptied = readPairs(
      applyRoomEvent(share(roomOf(2), { ...startPairs(roomOf(2).players, DECK, { now: NOW })!, pairs: [{ id: 'a1', members: ['gone'], prompt: '' }] }), { type: 'close' }, HOST),
    )!;
    expect(emptied.pairs).toEqual([]);
    expect(readPairs(null)).toBeNull();
    expect(readPairs(roomOf(2))).toBeNull();
  });

  it('sets and clears through a share event', () => {
    const room = roomOf(4);
    const s = start(4);
    expect(pairsEvent(s)).toEqual({ type: 'share', key: 'pairs', value: s });
    expect(readPairs(applyRoomEvent(room, pairsEvent(s), HOST))).toEqual(s);
    expect(readPairs(applyRoomEvent(applyRoomEvent(room, pairsEvent(s), HOST), pairsEvent(null), HOST))).toBeNull();
  });

  const good = (): Record<string, unknown> => JSON.parse(JSON.stringify(start(6, 1, DECK, 60)));

  it.each([
    ['not an object', () => 4],
    ['pairs not a list', () => ({ ...good(), pairs: 1 })],
    ['a deck that is not a list', () => ({ ...good(), deck: 'x' })],
    ['an order that is not a list', () => ({ ...good(), order: 'x' })],
    ['a round of 0', () => ({ ...good(), round: 0 })],
    ['a fractional round', () => ({ ...good(), round: 1.5 })],
    ['a negative cursor', () => ({ ...good(), cursor: -1 })],
    ['no start time', () => ({ ...good(), startedAt: null })],
    ['a bad end time', () => ({ ...good(), endsAt: 'soon' })],
    ['an enormous deck', () => ({ ...good(), deck: Array.from({ length: 101 }, () => 'q') })],
    ['an enormous pair list', () => ({ ...good(), pairs: new Array(1001).fill(0) })],
    ['a pair that is not an object', () => ({ ...good(), pairs: [3] })],
    ['a pair with a bad id', () => ({ ...good(), pairs: [{ id: 'a 1', members: ['x'], prompt: '' }] })],
    ['a pair without a prompt', () => ({ ...good(), pairs: [{ id: 'a1', members: ['x'] }] })],
    ['a pair without members', () => ({ ...good(), pairs: [{ id: 'a1', members: 'x', prompt: '' }] })],
    ['a pair with no usable member', () => ({ ...good(), pairs: [{ id: 'a1', members: [3], prompt: '' }] })],
    ['a group of four', () => ({ ...good(), pairs: [{ id: 'a1', members: ['a', 'b', 'c', 'd'], prompt: '' }] })],
  ])('reads %s as no pairs', (_label, make) => {
    expect(decodePairs(make())).toBeNull();
  });

  it('keeps what it can use', () => {
    const s = decodePairs({
      ...good(),
      deck: ['  a  ', 7, 'b'],
      order: [0, 1, 5, -1, 'x'],
      pairs: [
        { id: 'a1', members: ['x', 'y', 'x'], prompt: '  hi  ' },
        { id: 'a2', members: ['y', 'z'], prompt: 'p' },
      ],
      seen: ['x|y', 4],
      endsAt: undefined,
    })!;
    expect(s.deck).toEqual(['a', 'b']);
    expect(s.order).toEqual([0, 1]);
    expect(s.pairs.map((p) => p.members)).toEqual([['x', 'y'], ['z']]);
    expect(s.pairs[0]!.prompt).toBe('hi');
    expect(s.seen).toEqual(['x|y']);
    expect(s.endsAt).toBeNull();
    expect(decodePairs({ ...good(), seen: 'no' })!.seen).toEqual([]);
  });

  it('reads a whole state back, equal', () => {
    const s = start(9, 4);
    expect(decodePairs(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
