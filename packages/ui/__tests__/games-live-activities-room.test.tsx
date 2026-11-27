/**
 * The room's activities that take input from everyone (the Q&A board, reactions, raised hands and
 * the spectrum, from #243's models), on the room's own state and transport: the same robustness
 * checks run against each.
 *
 * Reconnect, late join, a host that refreshes, 40 players, repeated and lost moves, and a network
 * that delays, repeats and reorders what it carries.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BOARD_KEY,
  HANDS_KEY,
  REACTIONS_KEY,
  SPECTRUM_KEY,
  boardActivity,
  handsActivity,
  reactionsActivity,
  readBoard,
  readHands,
  readReactions,
  readSpectrum,
  spectrumActivity,
  submitEvent,
} from '../src/games/live-activities-model.js';
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
    [BOARD_KEY]: boardActivity(),
    [REACTIONS_KEY]: reactionsActivity({ kinds: ['clap', 'heart'] }),
    [HANDS_KEY]: handsActivity,
    [SPECTRUM_KEY]: spectrumActivity(),
  },
};

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

const ADAPTERS: Adapter[] = [
  {
    name: 'Q&A',
    begin: () => submitEvent(BOARD_KEY, HOST, 'begin', { type: 'begin', moderated: false }),
    move: (i, id) => submitEvent(BOARD_KEY, `p${i}`, id, { type: 'ask', text: `Question from ${i}` }),
    view: (r) => json(readBoard(r)),
    count: (r) => readBoard(r)?.questions.length ?? 0,
    has: (r, i) => !!readBoard(r)?.questions.some((q) => q.text === `Question from ${i}`),
  },
  {
    name: 'reactions',
    begin: () => submitEvent(REACTIONS_KEY, HOST, 'begin', { type: 'start' }),
    move: (i, id) => submitEvent(REACTIONS_KEY, `p${i}`, id, { type: 'react', kind: 'clap' }, { retry: false }),
    view: (r) => json(readReactions(r)),
    count: (r) => readReactions(r)?.totals.clap ?? 0,
    has: (r, i) => !!readReactions(r)?.recent.some((x) => x.by === `p${i}`),
  },
  {
    name: 'raised hands',
    begin: () => submitEvent(HANDS_KEY, HOST, 'begin', { type: 'start' }),
    move: (i, id) => submitEvent(HANDS_KEY, `p${i}`, id, { type: 'raise' }),
    view: (r) => json(readHands(r)),
    count: (r) => readHands(r)?.hands.length ?? 0,
    has: (r, i) => !!readHands(r)?.hands.some((h) => h.by === `p${i}`),
  },
  {
    name: 'spectrum',
    begin: () => submitEvent(SPECTRUM_KEY, HOST, 'begin', { type: 'start' }),
    move: (i, id) => submitEvent(SPECTRUM_KEY, `p${i}`, id, { type: 'place', value: (i * 7) % 101 }),
    view: (r) => json(readSpectrum(r)),
    count: (r) => Object.keys(readSpectrum(r)?.placed ?? {}).length,
    has: (r, i) => !!readSpectrum(r) && Object.hasOwn(readSpectrum(r)!.placed, `p${i}`),
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
    if (a.name !== 'reactions') for (let i = 0; i < 40; i++) expect(a.has(room, i)).toBe(true);
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
    if (a.name === 'reactions') {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      expect(a.count(m.host().room)).toBe(0); // a reaction is not sent again, however long the phone waits
      return;
    }
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
    if (a.name === 'reactions') return; // the room's totals are not a person's
    for (const id of m.ids.filter((x) => x !== 'p1')) {
      expect(a.has(m.room(id)!, 1)).toBe(false);
      expect(a.has(m.room(id)!, 0)).toBe(true);
      expect(a.has(m.room(id)!, 2)).toBe(true);
    }
    expect(a.has(m.host().room!, 1)).toBe(false);
  });
});
