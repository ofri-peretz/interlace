/**
 * Live rooms: the QR encoder, the room rules every client shares, the
 * transports, and the screens a host and a player see.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { encodeQr, qrCapacity, qrPath, type QrMatrix } from '../src/games/qr-model.js';
import {
  answerProgress,
  applyRoomEvent,
  cleanName,
  clockOffset,
  connectedPlayers,
  createBroadcastRoomTransport,
  createMemoryRoomHub,
  createRoom,
  formatJoinCode,
  JOIN_CODE_ALPHABET,
  makeJoinCode,
  normalizeJoinCode,
  rejectRoomEvent,
  roomStandings,
  type RoomEvent,
  type RoomMessage,
  type RoomState,
} from '../src/games/room-model.js';
import { QrCode } from '../src/games/qr-code.js';
import { JoinCode } from '../src/games/join-code.js';
import { LiveRoom, useRoom, useSecondsLeft } from '../src/games/live-room.js';
import { Podium } from '../src/games/podium.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// --- QR -------------------------------------------------------------------------

/** Reads the 15 format bits next to the top-left finder and checks them. */
function formatInfo(m: QrMatrix): { level: number; mask: number } {
  const g = (x: number, y: number) => (m.modules[y]![x] ? 1 : 0);
  const seq = [g(8, 0), g(8, 1), g(8, 2), g(8, 3), g(8, 4), g(8, 5), g(8, 7), g(8, 8), g(7, 8)];
  for (let i = 9; i < 15; i++) seq.push(g(14 - i, 8));
  const bits = seq.reduce((acc, b, i) => acc | (b << i), 0) ^ 0x5412;
  const data = bits >>> 10;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  expect(bits & 0x3ff).toBe(rem & 0x3ff);
  return { level: data >>> 3, mask: data & 7 };
}

function finderAt(m: QrMatrix, x0: number, y0: number) {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      expect(m.modules[y0 + y]![x0 + x]).toBe(ring !== 2);
    }
  }
}

describe('qr-model', () => {
  it('picks the smallest version that holds the text', () => {
    expect(encodeQr('HELLO').version).toBe(1);
    expect(encodeQr('https://example.com/play?code=K7Q4MZ').version).toBe(3);
    const big = encodeQr('x'.repeat(400), { errorCorrection: 'L' });
    expect(big.version).toBeGreaterThan(9); // 16-bit length field
    expect(big.size).toBe(big.version * 4 + 17);
  });

  it('draws finders, timing, the dark module and valid format bits', () => {
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      const m = encodeQr('https://example.com/join/ABC234', {
        errorCorrection: level,
      });
      finderAt(m, 0, 0);
      finderAt(m, m.size - 7, 0);
      finderAt(m, 0, m.size - 7);
      for (let i = 8; i < m.size - 8; i++) {
        expect(m.modules[6]![i]).toBe(i % 2 === 0);
        expect(m.modules[i]![6]).toBe(i % 2 === 0);
      }
      expect(m.modules[m.size - 8]![8]).toBe(true);
      const info = formatInfo(m);
      expect(info.mask).toBe(m.mask);
      expect(info.level).toBe({ L: 1, M: 0, Q: 3, H: 2 }[level]);
    }
  });

  it('covers every version, with version info from 7 and the odd step of 32', () => {
    for (const v of [1, 2, 6, 7, 14, 32, 40]) {
      const m = encodeQr('v', { minVersion: v });
      expect(m.version).toBe(v);
      expect(m.modules).toHaveLength(v * 4 + 17);
    }
    expect(encodeQr('v', { minVersion: 99 }).version).toBe(40);
    expect(encodeQr('v', { minVersion: -3 }).version).toBe(1);
  });

  it('is deterministic and encodes UTF-8', () => {
    const a = encodeQr('Grüße, שלום, مرحبا');
    const b = encodeQr('Grüße, שלום, مرحبا');
    expect(a.modules).toEqual(b.modules);
    expect(a.version).toBe(3); // 29 bytes in UTF-8: more than version 2 holds at M (26)
  });

  it('knows its capacity and refuses what does not fit', () => {
    expect(qrCapacity(1, 'L')).toBe(17);
    expect(qrCapacity(1)).toBe(14);
    expect(qrCapacity(40, 'L')).toBe(2953);
    expect(() => encodeQr('x'.repeat(2954), { errorCorrection: 'L' })).toThrow(RangeError);
  });

  it('turns the matrix into one path of runs inside the quiet zone', () => {
    const tiny = {
      size: 3,
      modules: [
        [true, true, false],
        [false, false, false],
        [true, false, true],
      ],
    };
    expect(qrPath(tiny)).toBe('M4 4h2v1h-2zM4 6h1v1h-1zM6 6h1v1h-1z');
    expect(qrPath(tiny, 0)).toBe('M0 0h2v1h-2zM0 2h1v1h-1zM2 2h1v1h-1z');
  });
});

describe('QrCode', () => {
  it('renders a named image on the light scheme by default', () => {
    const { container } = render(<QrCode value="https://example.com" label="QR code to join" />);
    const svg = screen.getByRole('img', { name: 'QR code to join' });
    expect(svg.getAttribute('viewBox')).toBe('0 0 33 33');
    expect(container.firstElementChild?.getAttribute('data-scheme')).toBe('light');
    expect(container.querySelector('path')?.getAttribute('d')).toMatch(/^M4 4h7v1h-7z/);
  });

  it('follows the page when asked, with its own margin', () => {
    const { container } = render(<QrCode value="x" label="QR" scheme="inherit" margin={0} size="fill" />);
    expect(container.firstElementChild?.hasAttribute('data-scheme')).toBe(false);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 21 21');
  });

  it('draws an empty, still-named box when the value is too long to encode', () => {
    const { container } = render(<QrCode value={'x'.repeat(3000)} label="QR" />);
    expect(container.firstElementChild?.getAttribute('data-state')).toBe('too-long');
    expect(screen.getByRole('img', { name: 'QR' })).toBeTruthy();
    expect(container.querySelector('path')).toBeNull();
  });
});

// --- Join codes -----------------------------------------------------------------

describe('join codes', () => {
  it('makes codes from the unambiguous alphabet', () => {
    const code = makeJoinCode();
    expect(code).toHaveLength(6);
    for (const ch of code) expect(JOIN_CODE_ALPHABET).toContain(ch);
    expect(JOIN_CODE_ALPHABET).not.toMatch(/[01ILOUV]/);
  });

  it('uses the random source it is given', () => {
    let i = 0;
    const seq = [0, 0.5, 0.999999];
    expect(makeJoinCode({ length: 3, alphabet: '0123456789' }, () => seq[i++]!)).toBe('059');
  });

  it('draws from crypto without bias, rejecting bytes past the alphabet', () => {
    const bytes = [31, 29, 0, 255, 28, 1, 2, 3];
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array) => {
        a.set(bytes.splice(0, a.length).concat(Array(a.length).fill(0)).slice(0, a.length));
        return a;
      },
    });
    // 31, 29 and 255 (mask 31) are past the 29-letter alphabet and skipped.
    expect(makeJoinCode({ length: 3 })).toBe('2Z3');
    expect(makeJoinCode({ length: 1, alphabet: 'A' })).toBe('A');
    expect(() => makeJoinCode({ alphabet: '' })).toThrow(RangeError);
  });

  it('falls back to Math.random without crypto', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(makeJoinCode({ length: 4 })).toBe('2222');
  });

  it('reads what people type', () => {
    expect(normalizeJoinCode(' k7q-4mz ')).toBe('K7Q4MZ');
    expect(normalizeJoinCode('k7q 4m')).toBeNull();
    expect(normalizeJoinCode('K7Q4M0')).toBeNull();
    expect(normalizeJoinCode('1234', { length: 4, alphabet: '0123456789' })).toBe('1234');
  });

  it('groups a code for reading', () => {
    expect(formatJoinCode('K7Q4MZ')).toBe('K7Q 4MZ');
    expect(formatJoinCode('12345678', 4)).toBe('1234 5678');
    expect(formatJoinCode('K7Q4MZ', 0)).toBe('K7Q4MZ');
  });
});

// --- Room rules -----------------------------------------------------------------

const HOST = 'host';
const join = (id: string, name = id): RoomEvent => ({
  type: 'join',
  playerId: id,
  name,
});

function roomWith(...ids: string[]): RoomState {
  return ids.reduce(
    (s, id) => applyRoomEvent(s, join(id, id.toUpperCase()), id),
    createRoom({ code: 'K7Q4MZ', hostId: HOST, rounds: 2 }),
  );
}

describe('room-model', () => {
  it('starts in an open lobby', () => {
    const r = createRoom({ code: 'ABC', hostId: HOST });
    expect(r).toMatchObject({
      phase: 'lobby',
      locked: false,
      round: 0,
      rounds: null,
      seq: 0,
      players: [],
    });
  });

  it('lets players join, reconnect and leave, keeping their score', () => {
    let r = roomWith('a', 'b');
    expect(r.players.map((p) => p.name)).toEqual(['A', 'B']);
    expect(r.seq).toBe(2);
    r = applyRoomEvent(r, { type: 'leave', playerId: 'a' }, 'a');
    expect(connectedPlayers(r).map((p) => p.id)).toEqual(['b']);
    r = { ...r, scores: { ...r.scores, a: 5 } };
    r = applyRoomEvent(r, join('a', '  New   name '), 'a');
    expect(r.players[0]).toEqual({
      id: 'a',
      name: 'New name',
      connected: true,
    });
    expect(r.scores.a).toBe(5);
  });

  it('refuses what a sender may not do', () => {
    const r = roomWith('a');
    expect(rejectRoomEvent(r, { type: 'lock', locked: true }, 'a')).toBe('not-host');
    expect(rejectRoomEvent(r, join('b'), 'a')).toBe('not-you');
    expect(rejectRoomEvent(r, join('b'), HOST)).toBeNull(); // the host may act for anyone
    expect(rejectRoomEvent(r, join('b', '   '), 'b')).toBe('name-empty');
    expect(rejectRoomEvent(r, join('b', 'a'), 'b')).toBe('name-taken');
    expect(rejectRoomEvent(r, { type: 'leave', playerId: 'zz' }, 'zz')).toBe('unknown-player');
    expect(rejectRoomEvent(r, { type: 'remove', playerId: 'zz' }, HOST)).toBe('unknown-player');
    expect(rejectRoomEvent(r, { type: 'answer', playerId: 'a', value: 1, at: 0 }, 'a')).toBe('wrong-phase');
    expect(rejectRoomEvent(r, { type: 'reveal', points: {} }, HOST)).toBe('wrong-phase');
    expect(applyRoomEvent(r, { type: 'lock', locked: true }, 'a')).toBe(r);
  });

  it('keeps a locked or full room shut, but lets the known back in', () => {
    let r = applyRoomEvent(roomWith('a'), { type: 'lock', locked: true }, HOST);
    expect(rejectRoomEvent(r, join('b'), 'b')).toBe('locked');
    r = applyRoomEvent(r, { type: 'leave', playerId: 'a' }, 'a');
    expect(rejectRoomEvent(r, join('a'), 'a')).toBeNull();
    const open = roomWith('a', 'b');
    expect(rejectRoomEvent(open, join('c'), 'c', { maxPlayers: 2 })).toBe('full');
    expect(cleanName('abcdefghij', 4)).toBe('abcd');
  });

  it('removes a player for good', () => {
    let r = roomWith('a', 'b');
    r = applyRoomEvent(r, { type: 'remove', playerId: 'a' }, HOST);
    expect(r.players.map((p) => p.id)).toEqual(['b']);
    expect(r.scores).toEqual({ b: 0 });
    expect(rejectRoomEvent(r, join('a'), 'a')).toBe('removed');
  });

  it('runs rounds: countdown, question, one answer each, reveal, podium', () => {
    let r = roomWith('a', 'b');
    r = applyRoomEvent(r, { type: 'countdown', startsAt: 1000 }, HOST);
    expect(r).toMatchObject({ phase: 'countdown', startsAt: 1000 });
    r = applyRoomEvent(r, { type: 'question', endsAt: 5000 }, HOST);
    expect(r).toMatchObject({
      phase: 'question',
      round: 1,
      endsAt: 5000,
      answers: {},
    });
    r = applyRoomEvent(r, { type: 'answer', playerId: 'a', value: 'x', at: 1200 }, 'a');
    expect(rejectRoomEvent(r, { type: 'answer', playerId: 'a', value: 'y', at: 1300 }, 'a')).toBe('already-answered');
    expect(rejectRoomEvent(r, { type: 'answer', playerId: 'zz', value: 'y', at: 1300 }, HOST)).toBe('unknown-player');
    expect(answerProgress(r)).toEqual({ answered: 1, total: 2 });
    r = applyRoomEvent(r, { type: 'reveal', points: { a: 800, b: Number.NaN } }, HOST);
    expect(r).toMatchObject({
      phase: 'reveal',
      scores: { a: 800, b: 0 },
      lastPoints: { a: 800, b: 0 },
    });
    r = applyRoomEvent(r, { type: 'countdown', startsAt: 9000 }, HOST);
    r = applyRoomEvent(r, { type: 'question', endsAt: null }, HOST);
    expect(r.round).toBe(2);
    r = applyRoomEvent(r, { type: 'answer', playerId: 'b', value: 'x', at: 1 }, 'b');
    r = applyRoomEvent(r, { type: 'remove', playerId: 'b' }, HOST);
    expect(r.answers).toEqual({});
    r = applyRoomEvent(r, { type: 'reveal', points: { a: 100 } }, HOST);
    r = applyRoomEvent(r, { type: 'podium' }, HOST);
    expect(r.phase).toBe('podium');
    expect(roomStandings(r).map((e) => [e.id, e.rank, e.score])).toEqual([['a', 1, 900]]);
  });

  it('carries what a round asks to every screen, and its answer only at the reveal', () => {
    let r = applyRoomEvent(roomWith('a'), { type: 'countdown', startsAt: 1 }, HOST);
    expect(r).toMatchObject({ prompt: null, solution: null });
    const prompt = { text: 'Which is larger?', choices: ['x', 'y'] };
    r = applyRoomEvent(r, { type: 'question', endsAt: null, prompt }, HOST);
    expect(r).toMatchObject({ prompt, solution: null });
    r = applyRoomEvent(r, { type: 'reveal', points: {}, solution: 'y' }, HOST);
    expect(r).toMatchObject({ prompt, solution: 'y' });
    r = applyRoomEvent(r, { type: 'question', endsAt: null }, HOST);
    expect(r).toMatchObject({ prompt: null, solution: null });
    r = applyRoomEvent(r, { type: 'reveal', points: {} }, HOST);
    expect(r.solution).toBeNull();
    r = applyRoomEvent(applyRoomEvent(r, { type: 'question', endsAt: null, prompt }, HOST), { type: 'restart' }, HOST);
    expect(r).toMatchObject({ prompt: null, solution: null });
  });

  it('counts a player with no score yet from zero', () => {
    let r = { ...roomWith('a'), scores: {} };
    expect(roomStandings(r)[0]?.score).toBe(0);
    r = applyRoomEvent(r, { type: 'countdown', startsAt: 1 }, HOST);
    r = applyRoomEvent(r, { type: 'question', endsAt: null }, HOST);
    r = applyRoomEvent(r, { type: 'reveal', points: { a: 2 } }, HOST);
    expect(r.scores).toEqual({ a: 2 });
  });

  it('restarts with the same players and closes for good', () => {
    let r = applyRoomEvent(roomWith('a'), { type: 'lock', locked: true }, HOST);
    r = applyRoomEvent(r, { type: 'countdown', startsAt: 1 }, HOST);
    r = applyRoomEvent(r, { type: 'question', endsAt: null }, HOST);
    r = applyRoomEvent(r, { type: 'reveal', points: { a: 3 } }, HOST);
    r = applyRoomEvent(r, { type: 'restart' }, HOST);
    expect(r).toMatchObject({ phase: 'lobby', round: 0, scores: { a: 0 }, locked: false });
    r = applyRoomEvent(r, { type: 'close' }, HOST);
    expect(r).toMatchObject({ phase: 'closed', locked: true });
    expect(rejectRoomEvent(r, join('b'), 'b')).toBe('closed');
  });
});

// --- Transports -----------------------------------------------------------------

describe('transports', () => {
  it('memory hub delivers to everyone else, a copy, on a microtask', async () => {
    const hub = createMemoryRoomHub();
    const a = hub.connect();
    const b = hub.connect();
    const got: RoomMessage[] = [];
    const mine: RoomMessage[] = [];
    const off = b.subscribe((m) => got.push(m));
    a.subscribe((m) => mine.push(m));
    const msg: RoomMessage = { kind: 'hello', from: 'a' };
    a.send(msg);
    expect(got).toEqual([]);
    await Promise.resolve();
    expect(got).toEqual([msg]);
    expect(got[0]).not.toBe(msg);
    expect(mine).toEqual([]);
    off();
    b.close?.();
    a.send(msg);
    await Promise.resolve();
    expect(got).toHaveLength(1);
  });

  it('broadcast channel transport, and null without one', async () => {
    const t1 = createBroadcastRoomTransport('room-test')!;
    const t2 = createBroadcastRoomTransport('room-test')!;
    const got = new Promise<RoomMessage>((resolve) => {
      const off = t2.subscribe((m) => {
        off();
        resolve(m);
      });
    });
    t1.send({ kind: 'hello', from: 'x' });
    expect(await got).toEqual({ kind: 'hello', from: 'x' });
    t1.close?.();
    t2.close?.();
    vi.stubGlobal('BroadcastChannel', undefined);
    expect(createBroadcastRoomTransport('room-test')).toBeNull();
  });
});

// --- useRoom ----------------------------------------------------------------------

function Client({
  hub,
  id,
  host,
  code,
  onRoom,
  onRejected,
}: {
  hub: ReturnType<typeof createMemoryRoomHub>;
  id: string;
  host?: RoomState;
  code?: string;
  onRoom: (r: ReturnType<typeof useRoom>) => void;
  onRejected?: (reason: string, type: string) => void;
}) {
  const [transport] = React.useState(() => hub.connect());
  const api = useRoom({ transport, selfId: id, host, code, onRejected, now: () => 4242 });
  onRoom(api);
  return null;
}

describe('useRoom', () => {
  it('syncs a host and players through a transport', async () => {
    const hub = createMemoryRoomHub();
    let host!: ReturnType<typeof useRoom>;
    let player!: ReturnType<typeof useRoom>;
    const rejected = vi.fn();
    const hostRejected = vi.fn();
    render(
      <>
        <Client
          hub={hub}
          id={HOST}
          host={createRoom({ code: 'K7Q4MZ', hostId: HOST })}
          onRoom={(r) => (host = r)}
          onRejected={hostRejected}
        />
        <Client hub={hub} id="p1" code="K7Q4MZ" onRoom={(r) => (player = r)} onRejected={rejected} />
      </>,
    );
    await act(async () => {});
    expect(host.isHost).toBe(true);
    expect(player.isHost).toBe(false);
    expect(player.room?.code).toBe('K7Q4MZ');

    await act(async () => player.send(join('p1', 'Dana')));
    expect(host.room?.players.map((p) => p.name)).toEqual(['Dana']);
    expect(player.room?.players.map((p) => p.name)).toEqual(['Dana']);

    await act(async () => player.send({ type: 'lock', locked: true }));
    expect(rejected).toHaveBeenCalledWith('not-host', 'lock');

    await act(async () => host.send({ type: 'reveal', points: {} }));
    expect(hostRejected).toHaveBeenCalledWith('wrong-phase', 'reveal');

    await act(async () => host.send({ type: 'countdown', startsAt: 0 }));
    await act(async () => host.send({ type: 'question', endsAt: null }));
    await act(async () => player.send({ type: 'answer', playerId: 'p1', value: 'x', at: -999 }));
    expect(host.room?.answers.p1?.at).toBe(4242); // stamped by the host on arrival

    const seq = player.room!.seq;
    await act(async () => host.send({ type: 'lock', locked: true }));
    expect(player.room?.locked).toBe(true);
    expect(player.room!.seq).toBe(seq + 1);
  });

  it('ignores other rooms and stale states', async () => {
    const hub = createMemoryRoomHub();
    const fake = hub.connect();
    let player!: ReturnType<typeof useRoom>;
    render(<Client hub={hub} id="p1" code="AAA" onRoom={(r) => (player = r)} />);
    const base = createRoom({ code: 'AAA', hostId: HOST });
    await act(async () =>
      fake.send({
        kind: 'state',
        state: { ...createRoom({ code: 'BBB', hostId: HOST }), seq: 9 },
      }),
    );
    expect(player.room).toBeNull();
    await act(async () => fake.send({ kind: 'state', state: { ...base, seq: 3 } }));
    await act(async () => fake.send({ kind: 'state', state: { ...base, seq: 2, locked: true } }));
    expect(player.room).toMatchObject({ seq: 3, locked: false });
    await act(async () =>
      fake.send({
        kind: 'rejected',
        to: 'someone-else',
        event: 'join',
        reason: 'full',
      }),
    );
  });

  it('reads deadlines on the host clock: a phone whose clock is 90 s slow agrees', async () => {
    const hub = createMemoryRoomHub();
    const fake = hub.connect();
    let player!: ReturnType<typeof useRoom>;
    render(<Client hub={hub} id="p1" code="AAA" onRoom={(r) => (player = r)} />);
    const base = createRoom({ code: 'AAA', hostId: HOST });
    const real = Date.now();
    // The host's clock runs 90 s ahead of this one; the two messages took 40 ms and 5 ms.
    await act(async () => fake.send({ kind: 'state', state: { ...base, seq: 1 }, at: real + 90_000 - 40 }));
    await act(async () => fake.send({ kind: 'state', state: { ...base, seq: 2 }, at: real + 90_000 - 5 }));
    expect(player.now() - Date.now()).toBeGreaterThan(89_900);
    expect(player.now() - Date.now()).toBeLessThanOrEqual(90_000);
  });

  it('host messages carry the host clock, and the host keeps its own', async () => {
    const hub = createMemoryRoomHub();
    const spy = hub.connect();
    const seen: RoomMessage[] = [];
    spy.subscribe((m) => seen.push(m));
    let host!: ReturnType<typeof useRoom>;
    render(<Client hub={hub} id={HOST} host={createRoom({ code: 'AAA', hostId: HOST })} onRoom={(r) => (host = r)} />);
    await act(async () => host.send({ type: 'lock', locked: true }));
    expect(seen.filter((m) => m.kind === 'state').every((m) => m.kind === 'state' && m.at === 4242)).toBe(true);
    expect(host.now()).toBe(4242);
  });

  it('a phone shown away comes back by itself, but not after leaving on purpose', async () => {
    const hub = createMemoryRoomHub();
    let host!: ReturnType<typeof useRoom>;
    let player!: ReturnType<typeof useRoom>;
    render(
      <>
        <Client hub={hub} id={HOST} host={createRoom({ code: 'AAA', hostId: HOST })} onRoom={(r) => (host = r)} />
        <Client hub={hub} id="p1" code="AAA" onRoom={(r) => (player = r)} />
      </>,
    );
    await act(async () => {});
    await act(async () => player.send(join('p1', 'Dana')));
    // The phone slept and its leave reached the host (e.g. pagehide on a lock screen).
    await act(async () => host.send({ type: 'leave', playerId: 'p1' }));
    await act(async () => {});
    expect(host.room?.players[0]).toMatchObject({ name: 'Dana', connected: true });

    // Leaving on purpose sticks.
    await act(async () => player.send({ type: 'leave', playerId: 'p1' }));
    await act(async () => {});
    expect(host.room?.players[0]?.connected).toBe(false);
  });

  it('says away when the page is closed, and asks again when it is seen', async () => {
    const hub = createMemoryRoomHub();
    let host!: ReturnType<typeof useRoom>;
    let player!: ReturnType<typeof useRoom>;
    render(
      <>
        <Client hub={hub} id={HOST} host={createRoom({ code: 'AAA', hostId: HOST })} onRoom={(r) => (host = r)} />
        <Client hub={hub} id="p1" code="AAA" onRoom={(r) => (player = r)} />
      </>,
    );
    await act(async () => {});
    await act(async () => player.send(join('p1', 'Dana')));
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    });
    await act(async () => {});
    expect(host.room?.players[0]?.connected).toBe(false);
    hidden.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {});
    expect(host.room?.players[0]?.connected).toBe(true);
    hidden.mockRestore();
  });

  it('sends a lost answer again until the host shows it, then stops', async () => {
    vi.useFakeTimers();
    const sent: RoomMessage[] = [];
    let listener: ((m: RoomMessage) => void) | null = null;
    const transport = {
      send: (m: RoomMessage) => void sent.push(m),
      subscribe: (l: (m: RoomMessage) => void) => ((listener = l), () => (listener = null)),
    };
    let player!: ReturnType<typeof useRoom>;
    function Phone() {
      player = useRoom({ transport, selfId: 'p1', code: 'AAA' });
      return null;
    }
    render(<Phone />);
    let state = applyRoomEvent(createRoom({ code: 'AAA', hostId: HOST }), join('p1', 'Dana'), 'p1');
    state = applyRoomEvent(state, { type: 'countdown', startsAt: 0 }, HOST);
    state = applyRoomEvent(state, { type: 'question', endsAt: null }, HOST);
    act(() => listener!({ kind: 'state', state }));
    act(() => player.send({ type: 'answer', playerId: 'p1', value: 'x', at: 0 }));
    const answers = () => sent.filter((m) => m.kind === 'intent' && m.event.type === 'answer').length;
    expect(answers()).toBe(1);
    // The first one was lost: no state shows it, so it goes again.
    act(() => void vi.advanceTimersByTime(3_000));
    expect(answers()).toBe(2);
    // The host has it now.
    act(() =>
      listener!({
        kind: 'state',
        state: applyRoomEvent(state, { type: 'answer', playerId: 'p1', value: 'x', at: 1 }, 'p1'),
      }),
    );
    act(() => void vi.advanceTimersByTime(9_000));
    expect(answers()).toBe(2);
    vi.useRealTimers();
  });

  it('gives up after a few tries, and does not reply to a repeated answer', async () => {
    vi.useFakeTimers();
    const sent: RoomMessage[] = [];
    const transport = { send: (m: RoomMessage) => void sent.push(m), subscribe: () => () => {} };
    let player!: ReturnType<typeof useRoom>;
    function Phone() {
      player = useRoom({ transport, selfId: 'p1', code: 'AAA' });
      return null;
    }
    render(<Phone />);
    act(() => player.send(join('p1', 'Dana')));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(sent.filter((m) => m.kind === 'intent').length).toBe(6);
    vi.useRealTimers();

    const hub = createMemoryRoomHub();
    const spy = hub.connect();
    const seen: RoomMessage[] = [];
    spy.subscribe((m) => seen.push(m));
    let host!: ReturnType<typeof useRoom>;
    render(<Client hub={hub} id={HOST} host={createRoom({ code: 'AAA', hostId: HOST })} onRoom={(r) => (host = r)} />);
    await act(async () => host.send(join('p1', 'Dana')));
    await act(async () => host.send({ type: 'countdown', startsAt: 0 }));
    await act(async () => host.send({ type: 'question', endsAt: null }));
    const answer = {
      kind: 'intent',
      from: 'p1',
      event: { type: 'answer', playerId: 'p1', value: 'x', at: 0 },
    } as const;
    await act(async () => spy.send(answer));
    await act(async () => spy.send(answer));
    expect(seen.some((m) => m.kind === 'rejected')).toBe(false);
    await act(async () => spy.send({ kind: 'intent', from: 'p2', event: { type: 'lock', locked: true } }));
    expect(seen.some((m) => m.kind === 'rejected' && m.reason === 'not-host')).toBe(true);
  });

  it('does nothing without a transport', () => {
    let api!: ReturnType<typeof useRoom>;
    function NoNet() {
      api = useRoom({ transport: null, selfId: 'p' });
      return null;
    }
    render(<NoNet />);
    act(() => api.send(join('p')));
    expect(api.room).toBeNull();
  });
});

describe('clockOffset', () => {
  it('takes the largest lower bound, and 0 with nothing to go on', () => {
    expect(clockOffset([])).toBe(0);
    expect(
      clockOffset([
        { at: 1000, local: 900 },
        { at: 2000, local: 1850 },
        { at: NaN, local: 1 },
      ]),
    ).toBe(150);
    expect(clockOffset([{ at: 100, local: 400 }])).toBe(-300);
  });
});

describe('useSecondsLeft', () => {
  it('counts down in whole seconds with timeouts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const seen: (number | null)[] = [];
    function Probe({ at }: { at: number | null }) {
      seen.push(useSecondsLeft(at));
      return null;
    }
    const { rerender } = render(<Probe at={2500} />);
    expect(seen.at(-1)).toBe(3);
    act(() => vi.advanceTimersByTime(500));
    expect(seen.at(-1)).toBe(2);
    act(() => vi.advanceTimersByTime(2000));
    expect(seen.at(-1)).toBe(0);
    rerender(<Probe at={null} />);
    expect(seen.at(-1)).toBeNull();
  });
});

// --- Screens --------------------------------------------------------------------

describe('JoinCode', () => {
  it('shows where to go, the code in groups and spelled out, and a QR', () => {
    render(<JoinCode code="K7Q4MZ" href="https://example.com/play?code=K7Q4MZ" />);
    expect(screen.getByText('Join at example.com')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Room code K 7 Q 4 M Z' }).textContent).toBe('K7Q 4MZ');
    expect(screen.getByRole('img', { name: 'QR code to join the room' })).toBeTruthy();
  });

  it('copies the link and says so, or says it could not', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { container } = render(<JoinCode code="ABC" href="example.com/x" where="example.com/x" size="stage" />);
    expect(screen.getByText('Join at example.com/x')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })));
    expect(writeText).toHaveBeenCalledWith('example.com/x');
    expect(container.querySelector('[data-slot="join-code-status"]')?.textContent).toBe('Link copied.');
    act(() => vi.advanceTimersByTime(2400));
    expect(container.querySelector('[data-slot="join-code-status"]')?.textContent).toBe('');
    writeText.mockRejectedValueOnce(new Error('no'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })));
    expect(container.querySelector('[data-slot="join-code-status"]')?.textContent).toMatch(/Copy failed/);
  });

  it('falls back to the text when the link is not a URL, and can hide copy', () => {
    render(<JoinCode code="ABC" href="example.org/join?c=ABC" copyable={false} />);
    expect(screen.getByText('Join at example.org')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('LiveRoom.Lobby', () => {
  const players = [
    { id: 'a', name: 'Dana', connected: true },
    { id: 'b', name: 'Sam', connected: false },
  ];

  it('takes its name from aria-label when given, for pages with more than one lobby', () => {
    const { container, rerender } = render(<LiveRoom.Lobby players={players} />);
    const section = container.querySelector('section')!;
    expect(section.getAttribute('aria-labelledby')).toBeTruthy();
    rerender(<LiveRoom.Lobby players={players} aria-label="Host lobby" />);
    expect(section.hasAttribute('aria-labelledby')).toBe(false);
    expect(screen.getByRole('region', { name: 'Host lobby' })).toBeTruthy();
  });

  it('lists players, marks you and who is away, and waits for the host', () => {
    render(<LiveRoom.Lobby players={players} selfId="a" />);
    expect(screen.getByRole('heading', { name: '1 player' })).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toBe('DanaYou');
    expect(items[1]?.textContent).toBe('Samaway');
    expect(screen.getByText('You are in. Waiting for the host to start.')).toBeTruthy();
  });

  it('shows the empty state, hides the away, and lets the host remove', () => {
    const onRemove = vi.fn();
    const { rerender } = render(<LiveRoom.Lobby players={[]} actions={<button type="button">Start</button>} />);
    expect(screen.getByText('Waiting for players to join.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '0 players' })).toBeTruthy();
    rerender(<LiveRoom.Lobby players={players} hideAway onRemove={onRemove} selfId="x" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Dana' }));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('announces and animates new players, but not the first render', () => {
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
    const { rerender, container } = render(<LiveRoom.Lobby players={players.slice(0, 1)} />);
    const announce = () => container.querySelector('[data-slot="room-lobby-announce"]')?.textContent;
    expect(announce()).toBe('');
    rerender(<LiveRoom.Lobby players={players} />);
    expect(announce()).toBe('Sam joined');
    expect(animate).toHaveBeenCalledTimes(1);
    rerender(
      <LiveRoom.Lobby
        players={[...players, { id: 'c', name: 'Kim', connected: true }, { id: 'd', name: 'Lee', connected: true }]}
      />,
    );
    expect(announce()).toBe('2 players joined');
    rerender(<LiveRoom.Lobby players={[...players]} />);
    expect(announce()).toBe('2 players joined');
    // @ts-expect-error cleanup of the stub
    delete HTMLElement.prototype.animate;
  });
});

describe('LiveRoom.Countdown', () => {
  it('counts to Go, announces twice and calls onDone once', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const onDone = vi.fn();
    const { container, rerender } = render(<LiveRoom.Countdown startsAt={13_000} onDone={onDone} />);
    const timer = screen.getByRole('timer', { name: 'Starting in' });
    const value = () => container.querySelector('[data-slot="room-countdown-value"]')?.textContent;
    const said = () => container.querySelector('[data-slot="room-countdown-announce"]')?.textContent;
    expect(value()).toBe('3');
    expect(said()).toBe('Starting in 3 seconds');
    expect(timer.getAttribute('data-state')).toBe('running');
    act(() => vi.advanceTimersByTime(1000));
    expect(value()).toBe('2');
    act(() => vi.advanceTimersByTime(2000));
    expect(value()).toBe('Go');
    expect(said()).toBe('Go');
    expect(timer.getAttribute('data-state')).toBe('done');
    rerender(<LiveRoom.Countdown startsAt={13_000} onDone={onDone} />);
    expect(onDone).toHaveBeenCalledTimes(1);
    rerender(<LiveRoom.Countdown startsAt={null} />);
    expect(screen.getByRole('timer').getAttribute('data-state')).toBe('idle');
  });
});

describe('LiveRoom.HostControls', () => {
  function Harness({
    initial,
    ...props
  }: { initial: RoomState } & Partial<React.ComponentProps<typeof LiveRoom.HostControls>>) {
    const [room, setRoom] = React.useState(initial);
    return <LiveRoom.HostControls room={room} send={(e) => setRoom((r) => applyRoomEvent(r, e, HOST))} {...props} />;
  }

  it('walks a game from the lobby to the podium and back', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const score = vi.fn((r: RoomState) => Object.fromEntries(Object.keys(r.answers).map((id) => [id, 100])));
    render(<Harness initial={roomWith('a', 'b')} minPlayers={3} score={score} roundSeconds={10} />);
    expect(screen.getByText('Needs 3 players to start. 2 so far.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    const { container } = render(<Harness initial={roomWith('a', 'b')} score={score} roundSeconds={10} />);
    const phase = () => container.querySelector('[data-slot="room-host-controls"]')?.getAttribute('data-phase');
    expect(screen.getByText('2 players are in.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(phase()).toBe('countdown');
    expect(screen.getByText('Starting…')).toBeTruthy();
    act(() => vi.advanceTimersByTime(3000));
    expect(phase()).toBe('question');
    expect(screen.getByText('0 of 2 answered')).toBeTruthy();
    act(() => vi.advanceTimersByTime(10_000));
    expect(phase()).toBe('reveal');
    expect(screen.getByText('Round 1 of 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.click(screen.getByRole('button', { name: 'Reveal now' }));
    expect(phase()).toBe('reveal');
    fireEvent.click(screen.getByRole('button', { name: 'Show the podium' }));
    expect(phase()).toBe('podium');
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(phase()).toBe('lobby');
    fireEvent.click(screen.getByRole('button', { name: 'Lock the room' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unlock the room' }));
    fireEvent.click(screen.getByRole('button', { name: 'End the game' }));
    expect(screen.getByText('The game has ended.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reveals early once everyone has answered, and can wait for the host', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let r = roomWith('a');
    r = applyRoomEvent(r, { type: 'countdown', startsAt: 0 }, HOST);
    r = applyRoomEvent(r, { type: 'question', endsAt: null }, HOST);
    r = applyRoomEvent(r, { type: 'answer', playerId: 'a', value: 1, at: 0 }, 'a');
    const { container } = render(<Harness initial={r} />);
    expect(screen.getByText('1 of 1 answered')).toBeTruthy();
    act(() => vi.advanceTimersByTime(600));
    expect(container.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('reveal');
    expect(screen.getByText('Round 1 of 2')).toBeTruthy();
    cleanup();

    let open = roomWith('a');
    open = applyRoomEvent(open, { type: 'countdown', startsAt: 0 }, HOST);
    const { container: c2 } = render(
      <Harness initial={{ ...open, rounds: null }} autoAdvance={false} roundSeconds={null} />,
    );
    act(() => vi.advanceTimersByTime(5000));
    expect(c2.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('countdown');
    cleanup();

    const q = applyRoomEvent({ ...open, rounds: null }, { type: 'question', endsAt: null }, HOST);
    const { container: c3 } = render(<Harness initial={q} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(c3.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('question');
    fireEvent.click(screen.getByRole('button', { name: 'Reveal now' }));
    expect(screen.getByText('Round 1')).toBeTruthy();
  });
});

describe('Podium', () => {
  const entries = [
    { id: 'a', name: 'Dana', score: 900 },
    { id: 'b', name: 'Sam', score: 1200 },
    { id: 'c', name: 'Kim', score: 700 },
    { id: 'd', name: 'Lee', score: 700 },
    { id: 'e', name: 'Ari', score: 100 },
  ];

  it('puts the top three in rank order and lists everyone else', () => {
    render(<Podium entries={entries} currentId="e" animate={false} locale="en-US" />);
    const top = screen.getByRole('list', { name: 'Top three' });
    const places = top.querySelectorAll('[data-slot="podium-place"]');
    expect([...places].map((p) => p.querySelector('[data-slot="podium-name"]')?.textContent)).toEqual([
      'Sam',
      'Dana',
      'Kim',
    ]);
    expect(places[2]?.getAttribute('data-place')).toBe('3');
    expect(top.textContent).toContain('1st');
    const rest = screen.getByRole('list', { name: 'Everyone else' });
    expect(rest.textContent).toBe('3rdLee7005thAriYou100');
  });

  it('can hide the rest, mark you on the podium and use its own words', () => {
    render(
      <Podium
        entries={entries.slice(0, 2)}
        currentId="b"
        showRest={false}
        animate={false}
        labels={{ place: (n) => `#${n}`, you: 'Me' }}
      />,
    );
    expect(screen.queryByRole('list', { name: 'Everyone else' })).toBeNull();
    expect(screen.getByRole('list').textContent).toBe('SamMe1,200#1Dana900#2');
  });

  it('rises 3rd, 2nd, 1st and then celebrates', () => {
    vi.useFakeTimers();
    const calls: { el: Element; delay: number }[] = [];
    const cancel = vi.fn();
    HTMLElement.prototype.animate = function (this: HTMLElement, _k: Keyframe[], o?: KeyframeAnimationOptions) {
      calls.push({ el: this, delay: Number(o?.delay ?? 0) });
      return { cancel } as unknown as Animation;
    } as HTMLElement['animate'];
    const { unmount } = render(<Podium entries={entries} />);
    const steps = calls.filter((c) => c.el.getAttribute('data-slot') === 'podium-step');
    expect(steps.map((s) => s.el.closest('[data-place]')?.getAttribute('data-place'))).toEqual(['3', '2', '1']);
    expect(steps.map((s) => s.delay)).toEqual([0, 350, 700]);
    act(() => vi.advanceTimersByTime(1350));
    expect(calls.some((c) => c.el.getAttribute('data-slot') === 'celebrate-ring')).toBe(true);
    unmount();
    expect(cancel).toHaveBeenCalled();
    calls.length = 0;
    render(<Podium entries={entries.slice(0, 1)} />);
    expect(calls.filter((c) => c.el.getAttribute('data-slot') === 'podium-step').map((s) => s.delay)).toEqual([0]);
    // @ts-expect-error cleanup of the stub
    delete HTMLElement.prototype.animate;
  });
});
