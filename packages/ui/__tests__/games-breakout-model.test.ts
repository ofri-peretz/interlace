/**
 * Breakouts: the split, the timer, messages to every group, the recall, and reading them back from
 * a room as untrusted data.
 */
import { describe, expect, it } from 'vitest';

import { applyRoomEvent, createRoom, type RoomState } from '../src/games/room-model.js';
import { seededRandom } from '../src/games/group-model.js';
import {
  breakoutSecondsLeft,
  breakoutsEvent,
  broadcast,
  decodeBreakouts,
  extendBreakouts,
  groupMembers,
  groupOf,
  MAX_GROUPS,
  MAX_MESSAGE,
  moveToGroup,
  openBreakouts,
  placeNewcomers,
  readBreakouts,
  recallBreakouts,
  reopenBreakouts,
  type BreakoutsState,
} from '../src/games/breakout-model.js';

const HOST = 'host';
const NOW = 1_000_000;

function roomOf(n: number): RoomState {
  let r = createRoom({ code: 'K7Q4MZ', hostId: HOST });
  for (let i = 0; i < n; i++) r = applyRoomEvent(r, { type: 'join', playerId: `p${i}`, name: `Player ${i}` }, `p${i}`);
  return r;
}

const open = (n: number, options: Partial<Parameters<typeof openBreakouts>[1]> = {}) => {
  const room = roomOf(n);
  return { room, state: openBreakouts(room.players, { now: NOW, random: seededRandom(7), ...options })! };
};

const sizes = (state: BreakoutsState, room: RoomState) => state.groups.map((g) => groupMembers(state, g.id, room.players).length);

describe('openBreakouts', () => {
  it('splits into the number of groups asked for, within one person of each other', () => {
    for (const [n, g] of [[3, 2], [10, 3], [31, 5], [40, 8], [120, 12]] as const) {
      const { room, state } = open(n, { groups: g });
      expect(state.groups).toHaveLength(g);
      const s = sizes(state, room);
      expect(Math.max(...s) - Math.min(...s)).toBeLessThanOrEqual(1);
      expect(s.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it('works out the count from a group size, and falls back to two groups', () => {
    expect(open(20, { size: 5 }).state.groups).toHaveLength(4);
    expect(open(7, { size: 5 }).state.groups).toHaveLength(1);
    expect(open(20, { size: 0 }).state.groups).toHaveLength(2);
    expect(open(20).state.groups).toHaveLength(2);
    expect(open(20, { groups: 3, size: 5 }).state.groups).toHaveLength(3);
  });

  it('never makes more groups than people, or than the limit', () => {
    expect(open(2, { groups: 9 }).state.groups).toHaveLength(2);
    expect(open(1).state.groups).toHaveLength(1);
    expect(open(200, { groups: 500 }).state.groups).toHaveLength(MAX_GROUPS);
    expect(open(5, { groups: 0 }).state.groups).toHaveLength(1);
  });

  it('names groups, with a default for the rest', () => {
    const { state } = open(6, { groups: 3, names: ['Lake', '  ', 'x'.repeat(40)] });
    expect(state.groups.map((g) => g.name)).toEqual(['Lake', 'Group 2', 'x'.repeat(24)]);
    expect(state.groups.map((g) => g.id)).toEqual(['g1', 'g2', 'g3']);
  });

  it('starts open, with a timer from the clock it is given, or none', () => {
    const { state } = open(4, { seconds: 90 });
    expect(state).toMatchObject({ status: 'open', startedAt: NOW, endsAt: NOW + 90_000, message: null, recalledAt: null });
    expect(open(4).state.endsAt).toBeNull();
    expect(open(4, { seconds: -5 }).state.endsAt).toBe(NOW);
  });

  it('is repeatable with a seeded random, and null for an empty room', () => {
    const a = open(12, { groups: 3 }).state;
    expect(open(12, { groups: 3 }).state).toEqual(a);
    expect(open(12, { groups: 3, random: seededRandom(99) }).state).not.toEqual(a);
    expect(openBreakouts([], { now: NOW })).toBeNull();
  });
});

describe('messages and the clock', () => {
  it('broadcasts one message at a time, counting them, cleaned and cut', () => {
    const { state } = open(6);
    const one = broadcast(state, '  Wrap  up   in two minutes ', NOW + 1);
    expect(one.message).toEqual({ n: 1, text: 'Wrap up in two minutes', at: NOW + 1 });
    expect(broadcast(one, 'Next', NOW + 2).message).toMatchObject({ n: 2, text: 'Next' });
    expect(broadcast(state, 'x'.repeat(500), NOW).message!.text).toHaveLength(MAX_MESSAGE);
    expect(broadcast(state, 'line one\n\nline two', NOW).message!.text).toBe('line one\n\nline two');
    expect(state.message).toBeNull(); // never mutated
  });

  it('ignores an empty message, and any message once everyone is recalled', () => {
    const { state } = open(6);
    expect(broadcast(state, '   ', NOW)).toBe(state);
    const back = recallBreakouts(state, NOW);
    expect(broadcast(back, 'hello', NOW)).toBe(back);
  });

  it('recalls everyone: stops the timer, clears the message, keeps the groups', () => {
    const { state } = open(6, { seconds: 60 });
    const back = recallBreakouts(broadcast(state, 'hi', NOW), NOW + 5);
    expect(back).toMatchObject({ status: 'recalled', endsAt: null, message: null, recalledAt: NOW + 5 });
    expect(back.groups).toEqual(state.groups);
    expect(recallBreakouts(back, NOW + 9)).toBe(back);
  });

  it('can send everyone back out with a fresh timer', () => {
    const { state } = open(6, { seconds: 60 });
    expect(reopenBreakouts(state, NOW)).toBe(state);
    const back = recallBreakouts(state, NOW + 5);
    expect(reopenBreakouts(back, NOW + 10, 30)).toMatchObject({ status: 'open', startedAt: NOW + 10, endsAt: NOW + 10 + 30_000, recalledAt: null });
    expect(reopenBreakouts(back, NOW + 10).endsAt).toBeNull();
    expect(reopenBreakouts(back, NOW + 10, -3).endsAt).toBe(NOW + 10);
  });

  it('gives more time from the deadline, or from now once it has passed or there was none', () => {
    const { state } = open(6, { seconds: 60 });
    expect(extendBreakouts(state, 30, NOW + 10_000).endsAt).toBe(NOW + 90_000);
    expect(extendBreakouts(state, 30, NOW + 100_000).endsAt).toBe(NOW + 130_000);
    expect(extendBreakouts(open(6).state, 30, NOW).endsAt).toBe(NOW + 30_000);
    expect(extendBreakouts(state, 0, NOW)).toBe(state);
    expect(extendBreakouts(state, Number.NaN, NOW)).toBe(state);
    const back = recallBreakouts(state, NOW);
    expect(extendBreakouts(back, 30, NOW)).toBe(back);
  });

  it('counts whole seconds left, never below 0', () => {
    const { state } = open(4, { seconds: 10 });
    expect(breakoutSecondsLeft(state, NOW)).toBe(10);
    expect(breakoutSecondsLeft(state, NOW + 9_001)).toBe(1);
    expect(breakoutSecondsLeft(state, NOW + 50_000)).toBe(0);
    expect(breakoutSecondsLeft(open(4).state, NOW)).toBeNull();
  });
});

describe('who is where', () => {
  it('finds a player\'s group and a group\'s players, in room order', () => {
    const { room, state } = open(9, { groups: 3 });
    const all = state.groups.flatMap((g) => groupMembers(state, g.id, room.players).map((p) => p.id));
    expect(all.sort()).toEqual(room.players.map((p) => p.id).sort());
    const mine = groupOf(state, 'p4')!;
    expect(groupMembers(state, mine.id, room.players).map((p) => p.id)).toContain('p4');
    expect(groupOf(state, 'nobody')).toBeNull();
    expect(groupOf(state, 'constructor')).toBeNull();
    expect(groupMembers({ ...state, members: {} }, 'g1', room.players)).toEqual([]);
  });

  it('moves a player to another group, and returns the same object when nothing changes', () => {
    const { state } = open(6, { groups: 2 });
    const from = groupOf(state, 'p0')!.id;
    const to = from === 'g1' ? 'g2' : 'g1';
    expect(groupOf(moveToGroup(state, 'p0', to), 'p0')!.id).toBe(to);
    expect(moveToGroup(state, 'p0', from)).toBe(state);
    expect(moveToGroup(state, 'p0', 'g9')).toBe(state);
    expect(groupOf(moveToGroup(state, 'newcomer', 'g1'), 'newcomer')!.id).toBe('g1');
  });

  it('puts a latecomer in the smallest group, only while the groups are open', () => {
    const room = roomOf(7);
    const state = openBreakouts(room.players.slice(0, 6), { groups: 3, now: NOW, random: seededRandom(1) })!;
    expect(placeNewcomers(state, room.players.slice(0, 6))).toBe(state);
    const placed = placeNewcomers(state, room.players);
    expect(sizes(placed, room).sort()).toEqual([2, 2, 3]);
    const two = placeNewcomers(openBreakouts(room.players.slice(0, 2), { groups: 2, now: NOW })!, room.players);
    expect(sizes(two, room)).toEqual([4, 3]);
    const back = recallBreakouts(state, NOW);
    expect(placeNewcomers(back, room.players)).toBe(back);
  });
});

describe('reading breakouts from a room', () => {
  const share = (room: RoomState, value: unknown) => applyRoomEvent(room, { type: 'share', key: 'breakouts', value }, HOST);

  it('round-trips through the room, and drops players who left it', () => {
    const { room, state } = open(6, { groups: 2, seconds: 60 });
    const message = broadcast(state, 'Hello', NOW + 1);
    let shared = share(room, message);
    expect(readBreakouts(shared)).toEqual(message);
    shared = applyRoomEvent(shared, { type: 'remove', playerId: 'p0' }, HOST);
    expect(Object.keys(readBreakouts(shared)!.members)).not.toContain('p0');
    expect(readBreakouts(null)).toBeNull();
    expect(readBreakouts(roomOf(2))).toBeNull();
  });

  it('sets and clears through a share event', () => {
    const { room, state } = open(4);
    expect(breakoutsEvent(state)).toEqual({ type: 'share', key: 'breakouts', value: state });
    const on = applyRoomEvent(room, breakoutsEvent(state), HOST);
    expect(readBreakouts(on)).toEqual(state);
    expect(readBreakouts(applyRoomEvent(on, breakoutsEvent(null), HOST))).toBeNull();
  });

  const good = (): Record<string, unknown> => JSON.parse(JSON.stringify(open(4, { seconds: 30 }).state));

  it.each([
    ['not an object', () => 4],
    ['no groups', () => ({ ...good(), groups: [] })],
    ['groups not a list', () => ({ ...good(), groups: 'x' })],
    ['too many groups', () => ({ ...good(), groups: Array.from({ length: MAX_GROUPS + 1 }, (_, i) => ({ id: `g${i}`, name: 'x' })) })],
    ['an unknown status', () => ({ ...good(), status: 'paused' })],
    ['no start time', () => ({ ...good(), startedAt: 'now' })],
    ['a bad group', () => ({ ...good(), groups: [{ id: 'g 1', name: 'x' }] })],
    ['a group that is not an object', () => ({ ...good(), groups: [3] })],
    ['a group without a name', () => ({ ...good(), groups: [{ id: 'g1' }] })],
    ['a repeated group id', () => ({ ...good(), groups: [{ id: 'g1', name: 'a' }, { id: 'g1', name: 'b' }] })],
    ['a bad end time', () => ({ ...good(), endsAt: 'soon' })],
    ['a bad recall time', () => ({ ...good(), recalledAt: 'soon' })],
  ])('reads %s as no breakouts', (_label, make) => {
    expect(decodeBreakouts(make())).toBeNull();
  });

  it('keeps what it can use', () => {
    const raw = {
      ...good(),
      groups: [{ id: 'g1', name: '  ' }, { id: 'g2', name: 'Lake' }],
      members: { a: 'g1', b: 'g7', c: 4 },
      endsAt: undefined,
      recalledAt: undefined,
      message: { n: 2, text: '  hi  there ', at: 5 },
    };
    const s = decodeBreakouts(raw)!;
    expect(s.groups.map((g) => g.name)).toEqual(['Group 1', 'Lake']);
    expect(s.members).toEqual({ a: 'g1' });
    expect(s.endsAt).toBeNull();
    expect(s.recalledAt).toBeNull();
    expect(s.message).toEqual({ n: 2, text: 'hi there', at: 5 });
    for (const message of [null, 4, { n: 0, text: 'x', at: 1 }, { n: 1.5, text: 'x', at: 1 }, { n: 1, text: 4, at: 1 }, { n: 1, text: 'x' }])
      expect(decodeBreakouts({ ...raw, message })!.message).toBeNull();
    expect(decodeBreakouts({ ...raw, members: 'no' })!.members).toEqual({});
  });

  it('reads a recalled state back whole', () => {
    const { state } = open(4, { seconds: 30 });
    const back = recallBreakouts(state, NOW + 9);
    expect(decodeBreakouts(JSON.parse(JSON.stringify(back)))).toEqual(back);
  });
});
