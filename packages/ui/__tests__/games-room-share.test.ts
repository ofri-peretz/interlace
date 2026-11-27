/**
 * The room's shared extras and its save: the `share` event, `readShared`, keeping a room across a
 * host's refresh (`serializeRoom`, `restoreRoom`, `createRoomStore`) and the transports' types.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  applyRoomEvent,
  createBroadcastRoomTransport,
  createMemoryRoomHub,
  createRoom,
  createRoomStore,
  MAX_SHARED_SIZE,
  readShared,
  rejectRoomEvent,
  RESTORE_SEQ_JUMP,
  restoreRoom,
  serializeRoom,
  type RoomState,
} from '../src/games/room-model.js';

const HOST = 'host';
const join = (id: string, name = id.toUpperCase()) => ({ type: 'join' as const, playerId: id, name });

function roomWith(...ids: string[]): RoomState {
  return ids.reduce(
    (s, id) => applyRoomEvent(s, join(id), id),
    createRoom({ code: 'K7Q4MZ', hostId: HOST, rounds: 3 }),
  );
}

describe('share event', () => {
  it('lets the host set and clear a named extra, and bumps seq', () => {
    const r = roomWith('a');
    expect(r.shared).toBeUndefined();
    const set = applyRoomEvent(r, { type: 'share', key: 'teams', value: { n: 1 } }, HOST);
    expect(set.shared).toEqual({ teams: { n: 1 } });
    expect(set.seq).toBe(r.seq + 1);
    const two = applyRoomEvent(set, { type: 'share', key: 'pairs', value: [1] }, HOST);
    expect(two.shared).toEqual({ teams: { n: 1 }, pairs: [1] });
    const cleared = applyRoomEvent(two, { type: 'share', key: 'teams', value: null }, HOST);
    expect(cleared.shared).toEqual({ pairs: [1] });
  });

  it('is the host\'s alone, and never works in a closed room', () => {
    const r = roomWith('a');
    expect(rejectRoomEvent(r, { type: 'share', key: 'teams', value: 1 }, 'a')).toBe('not-host');
    expect(applyRoomEvent(r, { type: 'share', key: 'teams', value: 1 }, 'a')).toBe(r);
    const closed = applyRoomEvent(r, { type: 'close' }, HOST);
    expect(rejectRoomEvent(closed, { type: 'share', key: 'teams', value: 1 }, HOST)).toBe('closed');
  });

  it.each(['', 'Teams', '__proto__', 'a b', '1teams', 'x'.repeat(33), 'té'])('refuses the key %j', (key) => {
    expect(rejectRoomEvent(roomWith('a'), { type: 'share', key, value: 1 }, HOST)).toBe('bad-share');
  });

  it('refuses a value that is not JSON, or weighs too much', () => {
    const r = roomWith('a');
    expect(rejectRoomEvent(r, { type: 'share', key: 'teams', value: undefined }, HOST)).toBe('bad-share');
    expect(rejectRoomEvent(r, { type: 'share', key: 'teams', value: () => 1 }, HOST)).toBe('bad-share');
    expect(rejectRoomEvent(r, { type: 'share', key: 'teams', value: 'x'.repeat(MAX_SHARED_SIZE) }, HOST)).toBe('bad-share');
    expect(rejectRoomEvent(r, { type: 'share', key: 'teams', value: 'x'.repeat(MAX_SHARED_SIZE - 2) }, HOST)).toBeNull();
  });

  it('survives a restart, and a removed player\'s extras stay for the readers to filter', () => {
    let r = applyRoomEvent(roomWith('a', 'b'), { type: 'share', key: 'teams', value: { t: 1 } }, HOST);
    r = applyRoomEvent(r, { type: 'countdown', startsAt: 1 }, HOST);
    r = applyRoomEvent(r, { type: 'restart' }, HOST);
    expect(r.shared).toEqual({ teams: { t: 1 } });
    r = applyRoomEvent(r, { type: 'remove', playerId: 'a' }, HOST);
    expect(r.shared).toEqual({ teams: { t: 1 } });
  });
});

describe('readShared', () => {
  const decode = (raw: unknown) => (typeof raw === 'number' ? raw : null);

  it('reads a value through the decoder, and null for anything else', () => {
    const r = applyRoomEvent(roomWith('a'), { type: 'share', key: 'n', value: 7 }, HOST);
    expect(readShared(r, 'n', decode)).toBe(7);
    expect(readShared(r, 'absent', decode)).toBeNull();
    expect(readShared(null, 'n', decode)).toBeNull();
    expect(readShared(undefined, 'n', decode)).toBeNull();
    expect(readShared(roomWith('a'), 'n', decode)).toBeNull();
    const text = applyRoomEvent(roomWith('a'), { type: 'share', key: 'n', value: 'x' }, HOST);
    expect(readShared(text, 'n', decode)).toBeNull();
  });

  it('never reads what an object inherits, and a decoder that throws is a null', () => {
    const r = applyRoomEvent(roomWith('a'), { type: 'share', key: 'n', value: 1 }, HOST);
    const seen = vi.fn(() => 'got');
    expect(readShared(r, 'constructor', seen)).toBeNull();
    expect(readShared(r, 'toString', seen)).toBeNull();
    expect(seen).not.toHaveBeenCalled();
    expect(
      readShared(r, 'n', () => {
        throw new Error('bad data');
      }),
    ).toBeNull();
  });
});

describe('restoreRoom', () => {
  function busy(): RoomState {
    let r = roomWith('a', 'b', 'c');
    r = applyRoomEvent(r, { type: 'countdown', startsAt: 1000 }, HOST);
    r = applyRoomEvent(r, { type: 'question', endsAt: 9000, prompt: ['x', 'y'] }, HOST);
    r = applyRoomEvent(r, { type: 'answer', playerId: 'a', value: 'x', at: 1500 }, 'a');
    r = applyRoomEvent(r, { type: 'share', key: 'teams', value: { t: 1 } }, HOST);
    return applyRoomEvent(r, { type: 'lock', locked: true }, HOST);
  }

  it('brings the room back, everyone away, with seq well ahead', () => {
    const before = busy();
    const after = restoreRoom(serializeRoom(before))!;
    expect(after).toMatchObject({
      code: 'K7Q4MZ',
      hostId: HOST,
      phase: 'question',
      locked: true,
      round: 1,
      rounds: 3,
      startsAt: 1000,
      endsAt: 9000,
      prompt: ['x', 'y'],
      shared: { teams: { t: 1 } },
      answers: { a: { value: 'x', at: 1500 } },
    });
    expect(after.players.map((p) => [p.id, p.name, p.connected])).toEqual([
      ['a', 'A', false],
      ['b', 'B', false],
      ['c', 'C', false],
    ]);
    expect(after.seq).toBe(before.seq + RESTORE_SEQ_JUMP);
  });

  it('refuses text that is not a saved room', () => {
    const good = JSON.parse(serializeRoom(busy())) as Record<string, unknown>;
    const bad = (patch: Record<string, unknown>) => restoreRoom(JSON.stringify({ ...good, ...patch }));
    expect(restoreRoom(null)).toBeNull();
    expect(restoreRoom(undefined)).toBeNull();
    expect(restoreRoom('')).toBeNull();
    expect(restoreRoom('{nope')).toBeNull();
    expect(restoreRoom('[1,2]')).toBeNull();
    expect(restoreRoom('7')).toBeNull();
    expect(bad({ code: '' })).toBeNull();
    expect(bad({ code: 5 })).toBeNull();
    expect(bad({ hostId: '' })).toBeNull();
    expect(bad({ phase: 'weird' })).toBeNull();
    expect(bad({ players: 'no' })).toBeNull();
    expect(bad({ players: [{ id: 'a' }] })).toBeNull();
    expect(bad({ players: [null] })).toBeNull();
    expect(bad({ seq: -1 })).toBeNull();
    expect(bad({ seq: 1.5 })).toBeNull();
    expect(bad({ round: 'x' })).toBeNull();
    expect(bad({ rounds: 'x' })).toBeNull();
    expect(bad({ startsAt: 'x' })).toBeNull();
    expect(bad({ endsAt: 'x' })).toBeNull();
    expect(bad({ codeExpiresAt: 'x' })).toBeNull();
    expect(restoreRoom(serializeRoom(busy()), { hostId: 'someone-else' })).toBeNull();
    expect(restoreRoom(serializeRoom(busy()), { hostId: HOST })).not.toBeNull();
  });

  it('rebuilds what it keeps: no duplicates, no bad numbers, no inherited keys', () => {
    const text = `{"code":"K7Q4MZ","hostId":"host","phase":"reveal","round":2,"seq":4,
      "players":[{"id":"a","name":"A","connected":true},{"id":"a","name":"Again","connected":true}],
      "removed":["z",7,null],
      "scores":{"a":5,"b":"x","__proto__":{"admin":true},"c":null},
      "answers":{"a":{"value":1,"at":3},"b":{"value":2},"c":5},
      "lastPoints":{"a":2,"b":null},
      "shared":{"teams":{"t":1},"__proto__":{"polluted":true}}}`;
    const r = restoreRoom(text)!;
    expect(r.players).toEqual([{ id: 'a', name: 'A', connected: false }]);
    expect(r.removed).toEqual(['z']);
    expect(Object.keys(r.scores)).toEqual(['a']);
    expect(r.scores.a).toBe(5);
    expect(r.answers).toEqual({ a: { value: 1, at: 3 } });
    expect(r.lastPoints).toEqual({ a: 2 });
    expect(r.rounds).toBeNull();
    expect(r.startsAt).toBeNull();
    expect(r.endsAt).toBeNull();
    expect(r.codeExpiresAt).toBeNull();
    expect(r.locked).toBe(false);
    expect(r.prompt).toBeNull();
    expect(r.solution).toBeNull();
    expect(Object.keys(r.shared!)).toEqual(['teams']);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(r.scores)).toBe(Object.prototype);
  });

  it('keeps a __proto__ key as data, never as a prototype', () => {
    const r = restoreRoom(
      '{"code":"A","hostId":"h","phase":"reveal","round":1,"seq":1,"players":[],"answers":{"__proto__":{"value":"x","at":1}},"scores":{"__proto__":9}}',
    )!;
    expect(Object.getPrototypeOf(r.answers)).toBe(Object.prototype);
    expect((r.answers as Record<string, unknown>).value).toBeUndefined();
    expect(Object.getPrototypeOf(r.scores)).toBe(Object.prototype);
    expect(Object.hasOwn(r.scores, '__proto__')).toBe(true);
  });

  it('keeps a missing removed list, extras and an integer round count', () => {
    const r = restoreRoom('{"code":"A","hostId":"h","phase":"lobby","round":0,"seq":0,"players":[],"rounds":4}')!;
    expect(r.removed).toEqual([]);
    expect(r.shared).toBeUndefined();
    expect(r.rounds).toBe(4);
    expect(r.seq).toBe(RESTORE_SEQ_JUMP);
  });
});

describe('createRoomStore', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  };

  it('saves, loads and clears a room', () => {
    const storage = memory();
    const store = createRoomStore(storage, 'room');
    expect(store.load()).toBeNull();
    const room = roomWith('a');
    store.save(room);
    expect(store.load()?.players.map((p) => p.id)).toEqual(['a']);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('only loads a room that is its own host\'s', () => {
    const storage = memory();
    createRoomStore(storage, 'room').save(roomWith('a'));
    expect(createRoomStore(storage, 'room', { hostId: 'other' }).load()).toBeNull();
    expect(createRoomStore(storage, 'room', { hostId: HOST }).load()).not.toBeNull();
  });

  it('never throws when storage is missing or broken', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    for (const storage of [broken, null, undefined]) {
      const store = createRoomStore(storage, 'room');
      expect(() => store.save(roomWith('a'))).not.toThrow();
      expect(store.load()).toBeNull();
      expect(() => store.clear()).not.toThrow();
    }
  });
});

describe('typed transports', () => {
  it('carry any message type', async () => {
    type Ping = { kind: 'ping'; n: number };
    const hub = createMemoryRoomHub<Ping>();
    const a = hub.connect();
    const b = hub.connect();
    const got: Ping[] = [];
    b.subscribe((m) => got.push(m));
    a.send({ kind: 'ping', n: 1 });
    await Promise.resolve();
    expect(got).toEqual([{ kind: 'ping', n: 1 }]);
  });

  it('a broadcast transport is null where there is no BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    expect(createBroadcastRoomTransport<{ kind: 'x' }>('room')).toBeNull();
    vi.unstubAllGlobals();
  });
});
