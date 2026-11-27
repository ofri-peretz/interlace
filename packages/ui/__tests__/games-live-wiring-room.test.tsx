/**
 * The rest of #243's activities that take input from everyone (the rating, quadrant, pin, ranking, points
 * split, dot vote, prediction, typed answer, word cloud, open wall and note board), on the room's own
 * state and transport: the same robustness checks as the Q&A board, reactions, hands and spectrum run
 * against each. Reconnect, late join, a host that refreshes, 40 players, repeated and lost moves, and a
 * network that delays, repeats and reorders what it carries.
 *
 * Reconnect, late join, a host that refreshes, 40 players, repeated and lost moves, and a network
 * that delays, repeats and reorders what it carries.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DOTS_KEY, PIN_KEY, POINTS_KEY, PREDICTION_KEY, QUADRANT_KEY, RANKING_KEY, RATING_KEY, TYPED_KEY,
  dotsActivity, pinActivity, pointsActivity, predictionActivity, quadrantActivity, rankingActivity, ratingActivity,
  readDots, readPin, readPoints, readPrediction, readQuadrant, readRanking, readRating, readTyped, typedActivity,
} from '../src/games/live-collect-model.js';
import { submitEvent } from '../src/games/live-activities-model.js';
import { CLOUD_KEY, NOTES_KEY, WALL_KEY, cloudActivity, notesActivity, readCloud, readNotes, readWall, wallActivity } from '../src/games/live-text-model.js';
import { useRoom, type UseRoomResult } from '../src/games/live-room.js';
import {
  createMemoryRoomHub,
  createRoom,
  createRoomStore,
  type RoomEvent,
  type RoomMessage,
  type RoomSettings,
  type RoomState,
  type RoomTransport,
} from '../src/games/room-model.js';
import { flakyReceiver, lossySender } from './flaky-transport.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const HOST = 'host';
const CODE = 'K7Q4MZ';
const settings: RoomSettings = {
  activities: {
    [RATING_KEY]: ratingActivity,
    [QUADRANT_KEY]: quadrantActivity,
    [PIN_KEY]: pinActivity,
    [RANKING_KEY]: rankingActivity,
    [POINTS_KEY]: pointsActivity,
    [DOTS_KEY]: dotsActivity,
    [PREDICTION_KEY]: predictionActivity,
    [TYPED_KEY]: typedActivity(),
    [CLOUD_KEY]: cloudActivity(),
    [WALL_KEY]: wallActivity(),
    [NOTES_KEY]: notesActivity(),
  },
};

const ORDERS = [['a', 'b', 'c'], ['b', 'c', 'a'], ['c', 'a', 'b']];

interface Adapter {
  name: string;
  /** The host's first move. */
  begin(): RoomEvent;
  /** Player `i`'s move, with this id. */
  move(i: number, id: string): RoomEvent;
  /** What a screen shows, comparable. */
  view(room: RoomState | null): string;
  /** How many contributions the room holds. */
  count(room: RoomState | null): number;
  /** Whether player `i`'s contribution is in the room. */
  has(room: RoomState, i: number): boolean;
}

const json = (v: unknown) => JSON.stringify(v ?? null);

const sub = (key: string, i: number, id: string, action: unknown) => submitEvent(key, `p${i}`, id, action);
const host = (key: string, action: unknown) => submitEvent(key, HOST, 'begin', action);

const ADAPTERS: Adapter[] = [
  {
    name: 'rating',
    begin: () => host(RATING_KEY, { type: 'start' }),
    move: (i, id) => sub(RATING_KEY, i, id, { type: 'send', value: 1 + (i % 5) }),
    view: (r) => json(readRating(r)),
    count: (r) => Object.keys(readRating(r)?.entries ?? {}).length,
    has: (r, i) => readRating(r)?.entries[`p${i}`] === 1 + (i % 5),
  },
  {
    name: 'quadrant',
    begin: () => host(QUADRANT_KEY, { type: 'start' }),
    move: (i, id) => sub(QUADRANT_KEY, i, id, { type: 'send', value: { x: (i * 7) % 101, y: (i * 13) % 101 } }),
    view: (r) => json(readQuadrant(r)),
    count: (r) => Object.keys(readQuadrant(r)?.entries ?? {}).length,
    has: (r, i) => readQuadrant(r)?.entries[`p${i}`]?.x === (i * 7) % 101,
  },
  {
    name: 'pin',
    begin: () => host(PIN_KEY, { type: 'start' }),
    move: (i, id) => sub(PIN_KEY, i, id, { type: 'send', value: { x: (i * 7) % 101, y: (i * 13) % 101 } }),
    view: (r) => json(readPin(r)),
    count: (r) => Object.keys(readPin(r)?.entries ?? {}).length,
    has: (r, i) => readPin(r)?.entries[`p${i}`]?.y === (i * 13) % 101,
  },
  {
    name: 'ranking',
    begin: () => host(RANKING_KEY, { type: 'start', items: ['a', 'b', 'c'] }),
    move: (i, id) => sub(RANKING_KEY, i, id, { type: 'send', value: ORDERS[i % 3] }),
    view: (r) => json(readRanking(r)),
    count: (r) => Object.keys(readRanking(r)?.entries ?? {}).length,
    has: (r, i) => readRanking(r)?.entries[`p${i}`]?.join() === ORDERS[i % 3]!.join(),
  },
  {
    name: 'points split',
    begin: () => host(POINTS_KEY, { type: 'start', options: ['a', 'b'] }),
    move: (i, id) => sub(POINTS_KEY, i, id, { type: 'send', value: { a: (i % 11) * 10, b: 100 - (i % 11) * 10 } }),
    view: (r) => json(readPoints(r)),
    count: (r) => Object.keys(readPoints(r)?.entries ?? {}).length,
    has: (r, i) => readPoints(r)?.entries[`p${i}`]?.a === (i % 11) * 10,
  },
  {
    name: 'dot vote',
    begin: () => host(DOTS_KEY, { type: 'start', ideas: ['a', 'b', 'c'], dots: 3 }),
    move: (i, id) => sub(DOTS_KEY, i, id, { type: 'send', value: { a: 1 + (i % 3) } }),
    view: (r) => json(readDots(r)),
    count: (r) => Object.keys(readDots(r)?.entries ?? {}).length,
    has: (r, i) => readDots(r)?.entries[`p${i}`]?.a === 1 + (i % 3),
  },
  {
    name: 'prediction',
    begin: () => host(PREDICTION_KEY, { type: 'start', options: ['yes', 'no'] }),
    move: (i, id) => sub(PREDICTION_KEY, i, id, { type: 'send', value: i % 2 ? 'yes' : 'no' }),
    view: (r) => json(readPrediction(r)),
    count: (r) => Object.keys(readPrediction(r)?.entries ?? {}).length,
    has: (r, i) => readPrediction(r)?.entries[`p${i}`] === (i % 2 ? 'yes' : 'no'),
  },
  {
    name: 'typed answer',
    begin: () => host(TYPED_KEY, { type: 'start' }),
    move: (i, id) => sub(TYPED_KEY, i, id, { type: 'send', value: `Answer ${i}` }),
    view: (r) => json(readTyped(r)),
    count: (r) => Object.keys(readTyped(r)?.entries ?? {}).length,
    has: (r, i) => readTyped(r)?.entries[`p${i}`] === `Answer ${i}`,
  },
  {
    name: 'word cloud',
    begin: () => host(CLOUD_KEY, { type: 'start' }),
    move: (i, id) => sub(CLOUD_KEY, i, id, { type: 'word', text: `Word${i}` }),
    view: (r) => json(readCloud(r)),
    count: (r) => readCloud(r)?.entries.length ?? 0,
    has: (r, i) => !!readCloud(r)?.entries.some((e) => e.by === `p${i}` && e.text === `Word${i}`),
  },
  {
    name: 'open wall',
    begin: () => host(WALL_KEY, { type: 'start', moderated: false }),
    move: (i, id) => sub(WALL_KEY, i, id, { type: 'post', text: `Post ${i}` }),
    view: (r) => json(readWall(r)),
    count: (r) => readWall(r)?.live.length ?? 0,
    has: (r, i) => !!readWall(r)?.live.some((p) => p.by === `p${i}` && p.text === `Post ${i}`),
  },
  {
    name: 'note board',
    begin: () => host(NOTES_KEY, { type: 'start', columns: [{ id: 'now', label: 'Now' }, { id: 'later', label: 'Later' }] }),
    move: (i, id) => sub(NOTES_KEY, i, id, { type: 'add', column: i % 2 ? 'now' : 'later', text: `Note ${i}` }),
    view: (r) => json(readNotes(r)),
    count: (r) => readNotes(r)?.notes.length ?? 0,
    has: (r, i) => !!readNotes(r)?.notes.some((n) => n.by === `p${i}` && n.text === `Note ${i}`),
  },
];

// --- A room on an in-memory hub, whose clock moves on each time it is read -----------------------------

type Hub = ReturnType<typeof createMemoryRoomHub<RoomMessage>>;

function Client({ transport, id, host, onApi, clock }: { transport: RoomTransport; id: string; host?: RoomState; onApi: (api: UseRoomResult) => void; clock: () => number }) {
  const api = useRoom({ transport, selfId: id, host, code: host ? undefined : CODE, settings, now: clock });
  onApi(api);
  return null;
}

function mount(n: number, options: { flakyPlayer?: string; lossyPlayer?: string; host?: RoomState; hub?: Hub } = {}) {
  const hub = options.hub ?? createMemoryRoomHub<RoomMessage>();
  const apis = new Map<string, UseRoomResult>();
  let t = 1_000_000;
  const clock = () => (t += 1500); // every stamp is a later moment: no rate limit trips by accident
  const flaky = options.flakyPlayer ? flakyReceiver(hub.connect()) : null;
  const lossy = options.lossyPlayer ? lossySender(hub.connect()) : null;
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const transports = new Map<string, RoomTransport>(ids.map((id) => [id, id === options.flakyPlayer ? flaky!.transport : id === options.lossyPlayer ? lossy!.transport : hub.connect()]));
  const tree = (hostKey: string, hostState: RoomState) => (
    <>
      <Client key={hostKey} transport={hub.connect()} id={HOST} host={hostState} onApi={(a) => apis.set(HOST, a)} clock={clock} />
      {ids.map((id) => (
        <Client key={id} transport={transports.get(id)!} id={id} onApi={(a) => apis.set(id, a)} clock={clock} />
      ))}
    </>
  );
  const view = render(tree('host', options.host ?? createRoom({ code: CODE, hostId: HOST })));
  return {
    hub,
    flaky,
    lossy,
    ids,
    api: (id: string) => apis.get(id)!,
    host: () => apis.get(HOST)!,
    room: (id: string) => apis.get(id)!.room,
    restartHost: (state: RoomState) => view.rerender(tree('host2', state)),
  };
}

const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};
async function joinAll(m: ReturnType<typeof mount>) {
  await flush();
  for (const id of m.ids) await act(async () => m.api(id).send({ type: 'join', playerId: id, name: `Player ${id.slice(1)}` }));
  await flush();
}


describe.each(ADAPTERS)('$name on the room', (a) => {
  it('reaches every phone, and a phone that joins late has it with the room', async () => {
    const m = mount(5);
    await joinAll(m);
    await act(async () => m.host().send(a.begin()));
    for (let i = 0; i < 3; i++) await act(async () => m.api(`p${i}`).send(a.move(i, `mv${i}`)));
    await flush();
    const truth = a.view(m.host().room);
    expect(truth).not.toBe('null');
    expect(a.count(m.host().room)).toBeGreaterThan(0);
    for (const id of m.ids) expect(a.view(m.room(id))).toBe(truth);

    let lateApi!: UseRoomResult;
    render(<Client transport={m.hub.connect()} id="late" onApi={(x) => (lateApi = x)} clock={() => 9_999_999} />);
    await flush();
    expect(a.view(lateApi.room)).toBe(truth);
    await act(async () => lateApi.send({ type: 'join', playerId: 'late', name: 'Late Larry' }));
    await flush();
    expect(a.view(lateApi.room)).toBe(a.view(m.host().room));
  });

  it('keeps a person\'s contribution through a reconnect, and does not count a resent move twice', async () => {
    const m = mount(4);
    await joinAll(m);
    await act(async () => m.host().send(a.begin()));
    await act(async () => m.api('p1').send(a.move(1, 'only-once')));
    await flush();
    const before = a.count(m.host().room);
    await act(async () => m.api('p1').send({ type: 'leave', playerId: 'p1' }));
    await flush();
    expect(a.has(m.host().room!, 1)).toBe(true);
    await act(async () => m.api('p1').send({ type: 'join', playerId: 'p1', name: 'Player 1' }));
    await act(async () => m.api('p1').send(a.move(1, 'only-once'))); // the same move, sent again after coming back
    await flush();
    expect(a.count(m.host().room)).toBe(before);
    expect(a.has(m.room('p1')!, 1)).toBe(true);
  });

  it('survives the host\'s page being refreshed: the save comes back, a repeated move is still counted once, and the next one works', async () => {
    const storage = new Map<string, string>();
    const store = createRoomStore({ getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) }, 'room', { hostId: HOST });
    const m = mount(6);
    await joinAll(m);
    await act(async () => m.host().send(a.begin()));
    await act(async () => m.api('p0').send(a.move(0, 'before-refresh')));
    await flush();
    store.save(m.host().room!);
    const truth = a.view(m.host().room);
    await act(async () => m.api('p1').send(a.move(1, 'lost-with-the-page')));
    await flush();

    m.restartHost(store.load()!);
    await flush();
    expect(a.view(m.host().room)).toBe(truth);
    for (const id of m.ids) expect(a.view(m.room(id))).toBe(truth);
    expect(m.host().room!.players.every((p) => p.connected)).toBe(true);
    const count = a.count(m.host().room);
    await act(async () => m.api('p0').send(a.move(0, 'before-refresh'))); // the phone's own resend of a move the save already holds
    await flush();
    expect(a.count(m.host().room)).toBe(count);
    await act(async () => m.api('p2').send(a.move(2, 'after-refresh')));
    await flush();
    expect(a.has(m.host().room!, 2)).toBe(true);
    for (const id of m.ids) expect(a.view(m.room(id))).toBe(a.view(m.host().room));
  });

  it('holds 40 players each making a move: all applied, every screen agrees', async () => {
    const m = mount(40);
    await joinAll(m);
    await act(async () => m.host().send(a.begin()));
    for (let i = 0; i < 40; i++) await act(async () => m.api(`p${i}`).send(a.move(i, `big${i}`)));
    await flush();
    const room = m.host().room!;
    for (let i = 0; i < 40; i++) expect(a.has(room, i)).toBe(true);
    expect(a.count(room)).toBe(40);
    const truth = a.view(room);
    expect(truth.length).toBeLessThan(60_000);
    for (const id of m.ids) expect(a.view(m.room(id))).toBe(truth);
  });

  it('applies a move the network delivers three times once', async () => {
    const m = mount(3);
    await joinAll(m);
    await act(async () => m.host().send(a.begin()));
    const spy = m.hub.connect();
    for (let i = 0; i < 3; i++) await act(async () => spy.send({ kind: 'intent', from: 'p1', event: a.move(1, 'thrice') }));
    await flush();
    expect(a.count(m.host().room)).toBe(1);
  });

  it('takes a move as the player the room says sent it, never the one the move names', async () => {
    const m = mount(3);
    await joinAll(m);
    await act(async () => m.host().send(a.begin()));
    await act(async () => m.api('p0').send(a.move(1, 'forged'))); // p0's phone, a move that says it is from p1
    await flush();
    expect(a.has(m.host().room!, 1)).toBe(false);
    expect(a.count(m.host().room)).toBe(0);
  });

  it('does not let a delayed repeat of an old move change anything', async () => {
    const m = mount(3);
    await joinAll(m);
    await act(async () => m.host().send(a.begin()));
    await act(async () => m.api('p1').send(a.move(1, 'first')));
    await act(async () => m.api('p2').send(a.move(2, 'second')));
    await flush();
    const before = a.view(m.host().room);
    const spy = m.hub.connect();
    await act(async () => spy.send({ kind: 'intent', from: 'p1', event: a.move(1, 'first') })); // the first move arrives again, late
    await flush();
    expect(a.view(m.host().room)).toBe(before);
    for (const id of m.ids) expect(a.view(m.room(id))).toBe(before);
  });

  it('settles on the newest state when a phone gets messages late, twice and in reverse', async () => {
    const m = mount(5, { flakyPlayer: 'p4' });
    await joinAll(m);
    await act(async () => m.host().send(a.begin()));
    await flush();
    m.flaky!.hold();
    for (let i = 0; i < 3; i++) await act(async () => m.api(`p${i}`).send(a.move(i, `f${i}`)));
    await flush();
    expect(m.flaky!.held().length).toBeGreaterThanOrEqual(3);
    expect(a.view(m.room('p4'))).not.toBe(a.view(m.host().room));
    act(() => m.flaky!.release({ order: 'reverse', repeat: 3 }));
    await flush();
    expect(a.view(m.room('p4'))).toBe(a.view(m.host().room));
    expect(m.room('p4')!.seq).toBe(m.host().room!.seq);
  });

  it('sends a move again when the first is lost on the way, and it counts once', async () => {
    vi.useFakeTimers();
    const m = mount(3, { lossyPlayer: 'p2' });
    await joinAll(m);
    await act(async () => m.host().send(a.begin()));
    await flush();
    m.lossy!.drop(1);
    await act(async () => m.api('p2').send(a.move(2, 'lost-once')));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(a.has(m.host().room!, 2)).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(a.has(m.host().room!, 2)).toBe(true);
    expect(a.count(m.host().room)).toBe(1);
  });

  it('drops a removed player\'s contribution from what every screen shows', async () => {
    const m = mount(5);
    await joinAll(m);
    await act(async () => m.host().send(a.begin()));
    for (let i = 0; i < 3; i++) await act(async () => m.api(`p${i}`).send(a.move(i, `r${i}`)));
    await flush();
    await act(async () => m.host().send({ type: 'remove', playerId: 'p1' }));
    await flush();
    for (const id of m.ids.filter((x) => x !== 'p1')) {
      expect(a.has(m.room(id)!, 1)).toBe(false);
      expect(a.has(m.room(id)!, 0)).toBe(true);
      expect(a.has(m.room(id)!, 2)).toBe(true);
    }
    expect(a.has(m.host().room!, 1)).toBe(false);
  });
});
