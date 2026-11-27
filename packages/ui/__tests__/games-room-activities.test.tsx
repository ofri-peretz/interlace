/**
 * The room activities (teams, breakouts, pair talk) on the room's own state and transport:
 * the same robustness checks run against each, because each rides in `RoomState.shared`.
 *
 * Reconnect, late join, a host that refreshes, 30+ players, and a network that delays, repeats and
 * reorders what it carries.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useRoom, type UseRoomResult } from '../src/games/live-room.js';
import {
  createMemoryRoomHub,
  createRoom,
  createRoomStore,
  MAX_SHARED_SIZE,
  type RoomHostEvent,
  type RoomMessage,
  type RoomState,
  type RoomTransport,
} from '../src/games/room-model.js';
import { seededRandom } from '../src/games/group-model.js';
import { autoBalance, createTeams, readTeams, renameTeam, teamOf, teamsEvent } from '../src/games/team-model.js';
import { breakoutsEvent, broadcast, groupOf, openBreakouts, readBreakouts } from '../src/games/breakout-model.js';
import { newCard, pairsEvent, partnerOf, readPairs, startPairs } from '../src/games/pair-model.js';
import { flakyReceiver } from './flaky-transport.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const HOST = 'host';
const CODE = 'K7Q4MZ';
const NOW = 4242;
const DECK = ['Best trip?', 'A tool you love?', 'Hardest bug?'];

interface Adapter {
  name: string;
  /** The host's event that starts the activity for these players. */
  begin(room: RoomState): RoomHostEvent;
  /** A later change to it. */
  change(room: RoomState): RoomHostEvent;
  /** What a screen shows of it, comparable. */
  view(room: RoomState | null): string;
  /** Whether the room puts this player somewhere. */
  placed(room: RoomState, id: string): boolean;
}

const json = (v: unknown) => JSON.stringify(v ?? null);

const ADAPTERS: Adapter[] = [
  {
    name: 'teams',
    begin: (r) => teamsEvent(autoBalance(createTeams(4), r.players, { random: seededRandom(1) })),
    change: (r) => teamsEvent(renameTeam(readTeams(r)!, 't1', 'Owls')),
    view: (r) => json(readTeams(r)),
    placed: (r, id) => !!readTeams(r) && teamOf(readTeams(r)!, id) !== null,
  },
  {
    name: 'breakouts',
    begin: (r) => breakoutsEvent(openBreakouts(r.players, { groups: 4, seconds: 600, now: NOW, random: seededRandom(1) })),
    change: (r) => breakoutsEvent(broadcast(readBreakouts(r)!, 'Wrap up in two minutes', NOW + 100)),
    view: (r) => json(readBreakouts(r)),
    placed: (r, id) => !!readBreakouts(r) && groupOf(readBreakouts(r)!, id) !== null,
  },
  {
    name: 'pairs',
    begin: (r) => pairsEvent(startPairs(r.players, DECK, { now: NOW, seconds: 300, random: seededRandom(1) })),
    change: (r) => pairsEvent(newCard(readPairs(r)!, 'a1', seededRandom(9))),
    view: (r) => json(readPairs(r)),
    placed: (r, id) => !!readPairs(r) && partnerOf(readPairs(r)!, id) !== null,
  },
];

// --- A room on an in-memory hub ---------------------------------------------------------------

type Hub = ReturnType<typeof createMemoryRoomHub>;

function Client({
  transport,
  id,
  host,
  onApi,
}: {
  transport: RoomTransport;
  id: string;
  host?: RoomState;
  onApi: (api: UseRoomResult) => void;
}) {
  const api = useRoom({ transport, selfId: id, host, code: host ? undefined : CODE, now: () => NOW });
  onApi(api);
  return null;
}

/** A host and `n` players, as React clients on one hub. */
function mount(n: number, options: { flakyPlayer?: string; host?: RoomState; hub?: Hub } = {}) {
  const hub = options.hub ?? createMemoryRoomHub();
  const apis = new Map<string, UseRoomResult>();
  const flaky = options.flakyPlayer ? flakyReceiver(hub.connect()) : null;
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  const transports = new Map<string, RoomTransport>(ids.map((id) => [id, id === options.flakyPlayer ? flaky!.transport : hub.connect()]));
  const hostTransport = hub.connect();
  const initial = options.host ?? createRoom({ code: CODE, hostId: HOST });
  const tree = (hostOn: boolean, hostState: RoomState) => (
    <>
      {hostOn ? <Client key="host" transport={hostTransport} id={HOST} host={hostState} onApi={(a) => apis.set(HOST, a)} /> : null}
      {ids.map((id) => (
        <Client key={id} transport={transports.get(id)!} id={id} onApi={(a) => apis.set(id, a)} />
      ))}
    </>
  );
  const view = render(tree(true, initial));
  return {
    hub,
    flaky,
    ids,
    api: (id: string) => apis.get(id)!,
    host: () => apis.get(HOST)!,
    room: (id: string) => apis.get(id)!.room,
    restartHost: (state: RoomState) => {
      view.rerender(tree(false, state));
      const next = hub.connect();
      // A new page: a new host client on the same hub.
      view.rerender(
        <>
          <Client key="host2" transport={next} id={HOST} host={state} onApi={(a) => apis.set(HOST, a)} />
          {ids.map((id) => (
            <Client key={id} transport={transports.get(id)!} id={id} onApi={(a) => apis.set(id, a)} />
          ))}
        </>,
      );
    },
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
    const m = mount(6);
    await joinAll(m);
    await act(async () => m.host().send(a.begin(m.host().room!)));
    await flush();
    const truth = a.view(m.host().room);
    expect(truth).not.toBe('null');
    for (const id of m.ids) expect(a.view(m.room(id))).toBe(truth);

    // A seventh phone opens after it all started.
    const lateTransport = m.hub.connect();
    let lateApi!: UseRoomResult;
    render(<Client transport={lateTransport} id="late" onApi={(x) => (lateApi = x)} />);
    await flush();
    expect(a.view(lateApi.room)).toBe(truth); // the activity arrives with the state, before it has joined
    await act(async () => lateApi.send({ type: 'join', playerId: 'late', name: 'Late Larry' }));
    await flush();
    expect(m.room('p0')!.players.map((p) => p.id)).toContain('late');
    expect(a.view(lateApi.room)).toBe(a.view(m.host().room));
  });

  it('keeps a player\'s place through a reconnect', async () => {
    const m = mount(6);
    await joinAll(m);
    await act(async () => m.host().send(a.begin(m.host().room!)));
    await flush();
    expect(a.placed(m.host().room!, 'p2')).toBe(true);
    const before = a.view(m.host().room);
    await act(async () => m.api('p2').send({ type: 'leave', playerId: 'p2' }));
    await flush();
    expect(m.host().room!.players.find((p) => p.id === 'p2')!.connected).toBe(false);
    expect(a.placed(m.host().room!, 'p2')).toBe(true); // away, not gone
    expect(a.view(m.host().room)).toBe(before);
    await act(async () => m.api('p2').send({ type: 'join', playerId: 'p2', name: 'Player 2' }));
    await flush();
    expect(m.host().room!.players.find((p) => p.id === 'p2')!.connected).toBe(true);
    expect(a.view(m.room('p2'))).toBe(before);
  });

  it('survives the host\'s page being refreshed: the saved room comes back and every phone follows', async () => {
    const storage = new Map<string, string>();
    const store = createRoomStore(
      { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) },
      'room',
      { hostId: HOST },
    );
    const m = mount(8);
    await joinAll(m);
    await act(async () => m.host().send(a.begin(m.host().room!)));
    await flush();
    store.save(m.host().room!);
    // Two more changes happen that the save misses (the page dies before it saves them).
    await act(async () => m.host().send(a.change(m.host().room!)));
    await flush();
    const lost = a.view(m.host().room);
    const phoneSeq = m.room('p0')!.seq;

    const restored = store.load()!;
    expect(restored.seq).toBeGreaterThan(phoneSeq); // newer than anything a phone holds
    m.restartHost(restored);
    await flush();
    const truth = a.view(m.host().room);
    expect(truth).not.toBe(lost); // the host's truth is its save
    for (const id of m.ids) expect(a.view(m.room(id))).toBe(truth);
    // Phones that were open said so again, and the host shows them present.
    expect(m.host().room!.players.every((p) => p.connected)).toBe(true);
    // And the room goes on: the next change reaches every phone.
    await act(async () => m.host().send(a.change(m.host().room!)));
    await flush();
    for (const id of m.ids) expect(a.view(m.room(id))).toBe(a.view(m.host().room));
  });

  it('holds 40 players: all placed, all screens agree, well inside the size limit', async () => {
    const m = mount(40);
    await joinAll(m);
    expect(m.host().room!.players).toHaveLength(40);
    await act(async () => m.host().send(a.begin(m.host().room!)));
    await flush();
    const room = m.host().room!;
    for (const id of m.ids) {
      expect(a.placed(room, id)).toBe(true);
      expect(a.placed(m.room(id)!, id)).toBe(true);
    }
    const truth = a.view(room);
    expect(truth.length).toBeLessThan(MAX_SHARED_SIZE / 4);
    for (const id of m.ids) expect(a.view(m.room(id))).toBe(truth);
  });

  it('fits a full room of 200 within the limit', () => {
    let room = createRoom({ code: CODE, hostId: HOST });
    for (let i = 0; i < 200; i++) {
      const event = { type: 'join' as const, playerId: `player-${i}-${'x'.repeat(8)}`, name: `Player ${i}` };
      room = { ...room, players: [...room.players, { id: event.playerId, name: event.name, connected: true }], scores: { ...room.scores, [event.playerId]: 0 } };
    }
    expect(JSON.stringify((a.begin(room) as { value: unknown }).value).length).toBeLessThan(MAX_SHARED_SIZE);
  });

  it('settles on the newest state when a phone gets messages late, twice and in reverse', async () => {
    const m = mount(5, { flakyPlayer: 'p4' });
    await joinAll(m);
    await act(async () => m.host().send(a.begin(m.host().room!)));
    await flush();
    m.flaky!.hold();
    await act(async () => m.host().send(a.change(m.host().room!)));
    await act(async () => m.host().send({ type: 'lock', locked: true }));
    await act(async () => m.host().send({ type: 'lock', locked: false }));
    await flush();
    expect(m.flaky!.held().length).toBeGreaterThanOrEqual(3);
    const stale = a.view(m.room('p4'));
    expect(stale).not.toBe(a.view(m.host().room));
    act(() => m.flaky!.release({ order: 'reverse', repeat: 3 }));
    await flush();
    expect(a.view(m.room('p4'))).toBe(a.view(m.host().room));
    expect(m.room('p4')!.seq).toBe(m.host().room!.seq);
    expect(m.room('p4')!.locked).toBe(false);
  });

  it('never goes back to an older state when one arrives after a newer one', async () => {
    const m = mount(3, { flakyPlayer: 'p2' });
    await joinAll(m);
    await act(async () => m.host().send(a.begin(m.host().room!)));
    await flush();
    const older: RoomMessage = { kind: 'state', state: m.room('p2')!, at: NOW };
    await act(async () => m.host().send(a.change(m.host().room!)));
    await flush();
    const newest = a.view(m.room('p2'));
    m.flaky!.hold();
    // The network hands the phone an older copy of the room, twice, after the newer one.
    const other = m.hub.connect();
    other.send(older);
    other.send(older);
    await flush();
    act(() => m.flaky!.release());
    await flush();
    expect(a.view(m.room('p2'))).toBe(newest);
  });

  it('drops a removed player from what every screen shows', async () => {
    const m = mount(6);
    await joinAll(m);
    await act(async () => m.host().send(a.begin(m.host().room!)));
    await flush();
    await act(async () => m.host().send({ type: 'remove', playerId: 'p1' }));
    await flush();
    for (const id of m.ids.filter((x) => x !== 'p1')) {
      const room = m.room(id)!;
      expect(room.players.some((p) => p.id === 'p1')).toBe(false);
      expect(a.placed(room, 'p1')).toBe(false);
    }
  });

  it('refuses a player who tries to set it', async () => {
    const m = mount(3);
    await joinAll(m);
    await act(async () => m.api('p0').send(a.begin(m.host().room!)));
    await flush();
    expect(a.view(m.host().room)).toBe('null');
  });
});
