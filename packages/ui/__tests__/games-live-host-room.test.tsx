/**
 * The two activities only the host drives (the picture reveal and the room goal), on the room's own state
 * and transport: reconnect, late join, a host that refreshes, 40 players, a network that delays, repeats and
 * reorders what it carries, and a phone that tries to move them.
 *
 * Reconnect, late join, a host that refreshes, 40 players, repeated and lost moves, and a network
 * that delays, repeats and reorders what it carries.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { submitEvent } from '../src/games/live-activities-model.js';
import { GOAL_KEY, REVEAL_KEY, goalActivity, readGoal, readReveal, revealActivity } from '../src/games/live-host-model.js';
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
const settings: RoomSettings = { activities: { [REVEAL_KEY]: revealActivity, [GOAL_KEY]: goalActivity } };

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



describe('picture reveal on the room', () => {
  const start = () => submitEvent(REVEAL_KEY, HOST, 'b', { type: 'start', steps: 6, seed: 'haifa' });
  const step = (n: number, id: string) => submitEvent(REVEAL_KEY, HOST, id, { type: 'step', step: n });

  it('reaches every phone, and a phone that joins late has it with the room', async () => {
    const m = mount(4);
    await joinAll(m);
    await act(async () => m.host().send(start()));
    await act(async () => m.host().send(step(3, 's3')));
    await flush();
    for (const id of m.ids) expect(readReveal(m.room(id))).toMatchObject({ steps: 6, step: 3, revealed: false });
    let late!: UseRoomResult;
    render(<Client transport={m.hub.connect()} id="late" onApi={(x) => (late = x)} clock={() => 9_999_999} />);
    await flush();
    expect(readReveal(late.room)).toMatchObject({ step: 3, seed: 'haifa' });
  });

  it('survives the host being refreshed, and carries on from the saved step', async () => {
    const storage = new Map<string, string>();
    const store = createRoomStore({ getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) }, 'room', { hostId: HOST });
    const m = mount(5);
    await joinAll(m);
    await act(async () => m.host().send(start()));
    await act(async () => m.host().send(step(2, 's2')));
    await flush();
    store.save(m.host().room!);
    m.restartHost(store.load()!);
    await flush();
    for (const id of m.ids) expect(readReveal(m.room(id))).toMatchObject({ step: 2 });
    await act(async () => m.host().send(step(4, 's4')));
    await flush();
    for (const id of m.ids) expect(readReveal(m.room(id))).toMatchObject({ step: 4 });
  });

  it('settles on the newest step when a phone gets messages late, twice and in reverse', async () => {
    const m = mount(5, { flakyPlayer: 'p4' });
    await joinAll(m);
    await act(async () => m.host().send(start()));
    await flush();
    m.flaky!.hold();
    for (const n of [1, 2, 3]) await act(async () => m.host().send(step(n, `f${n}`)));
    await act(async () => m.host().send(submitEvent(REVEAL_KEY, HOST, 'rv', { type: 'reveal' })));
    await flush();
    act(() => m.flaky!.release({ order: 'reverse', repeat: 3 }));
    await flush();
    expect(readReveal(m.room('p4'))).toMatchObject({ step: 6, revealed: true });
    expect(m.room('p4')!.seq).toBe(m.host().room!.seq);
  });

  it('refuses a phone that tries to start, step, reveal or cover it', async () => {
    const m = mount(3);
    await joinAll(m);
    await act(async () => m.host().send(start()));
    await act(async () => m.host().send(step(2, 's2')));
    for (const [id, action] of [['a', { type: 'step', step: 5 }], ['b', { type: 'reveal' }], ['c', { type: 'cover' }], ['d', { type: 'start', steps: 3, seed: 'x' }]] as const) {
      await act(async () => m.api('p1').send(submitEvent(REVEAL_KEY, 'p1', id, action, { retry: false })));
    }
    await flush();
    expect(readReveal(m.host().room)).toMatchObject({ steps: 6, step: 2, seed: 'haifa', revealed: false });
  });
});

describe('room goal on the room', () => {
  const start = () => submitEvent(GOAL_KEY, HOST, 'b', { type: 'start', label: 'Room goal', target: 400, milestones: [{ at: 100, label: 'Warm' }, { at: 300, label: 'Hot' }] });

  async function playRound(m: ReturnType<typeof mount>, points: Record<string, number>) {
    await act(async () => m.host().send({ type: 'countdown', startsAt: 1 }));
    await act(async () => m.host().send({ type: 'question', endsAt: null }));
    await act(async () => m.host().send({ type: 'reveal', points }));
    await flush();
  }

  it('fills from the room\'s own points with 40 players, and every screen agrees', async () => {
    const m = mount(40);
    await joinAll(m);
    await act(async () => m.host().send(start()));
    await playRound(m, Object.fromEntries(m.ids.map((id) => [id, 10])));
    await act(async () => m.host().send(submitEvent(GOAL_KEY, HOST, 'r1', { type: 'round', right: 36, answered: 40 })));
    await flush();
    for (const id of [HOST, ...m.ids]) {
      const goal = readGoal(id === HOST ? m.host().room : m.room(id))!;
      expect(goal).toMatchObject({ value: 400, streak: 1, target: 400 });
      expect(goal.tally).toMatchObject({ done: true, people: 40 });
    }
  });

  it('a late phone and a refreshed host have the same goal and the same value', async () => {
    const storage = new Map<string, string>();
    const store = createRoomStore({ getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) }, 'room', { hostId: HOST });
    const m = mount(4);
    await joinAll(m);
    await act(async () => m.host().send(start()));
    await playRound(m, { p0: 50, p1: 60 });
    store.save(m.host().room!);
    const truth = JSON.stringify(readGoal(m.host().room));
    let late!: UseRoomResult;
    render(<Client transport={m.hub.connect()} id="late" onApi={(x) => (late = x)} clock={() => 9_999_999} />);
    await flush();
    expect(JSON.stringify(readGoal(late.room))).toBe(truth);
    m.restartHost(store.load()!);
    await flush();
    expect(JSON.stringify(readGoal(m.host().room))).toBe(truth);
    for (const id of m.ids) expect(JSON.stringify(readGoal(m.room(id)))).toBe(truth);
  });

  it('settles when a phone gets messages late, twice and in reverse, and drops a removed player\'s points', async () => {
    const m = mount(5, { flakyPlayer: 'p4' });
    await joinAll(m);
    await act(async () => m.host().send(start()));
    await flush();
    m.flaky!.hold();
    await playRound(m, { p0: 100, p1: 100 });
    act(() => m.flaky!.release({ order: 'reverse', repeat: 3 }));
    await flush();
    expect(readGoal(m.room('p4'))?.value).toBe(200);
    expect(m.room('p4')!.seq).toBe(m.host().room!.seq);
    await act(async () => m.host().send({ type: 'remove', playerId: 'p1' }));
    await flush();
    for (const id of m.ids.filter((x) => x !== 'p1')) expect(readGoal(m.room(id))?.value).toBe(100);
  });

  it('refuses a phone that tries to start it, add a round or clear it', async () => {
    const m = mount(3);
    await joinAll(m);
    await act(async () => m.host().send(start()));
    for (const [id, action] of [['a', { type: 'round', right: 1, answered: 1 }], ['b', { type: 'clear' }], ['c', { type: 'start', label: 'Hijack', target: 5 }]] as const) {
      await act(async () => m.api('p1').send(submitEvent(GOAL_KEY, 'p1', id, action, { retry: false })));
    }
    await flush();
    expect(readGoal(m.host().room)).toMatchObject({ label: 'Room goal', rounds: [], target: 400 });
  });
});
