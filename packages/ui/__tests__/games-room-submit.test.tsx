/**
 * `submit`: a player's move in an activity, applied once, in the order the host got it, and sent
 * again until the host's state shows it.
 */
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useRoom, type UseRoomResult } from '../src/games/live-room.js';
import {
  ACK_KEEP,
  applyRoomEvent,
  createMemoryRoomHub,
  createRoom,
  MAX_SHARED_SIZE,
  rejectRoomEvent,
  restoreRoom,
  serializeRoom,
  type ActivityReducer,
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
const NOW = 7000;

/** A counter anyone may add to, with host-only reset, a size trap and a throwing move. */
const counter: ActivityReducer = (slice, action, ctx) => {
  const n = typeof slice === 'number' ? slice : 0;
  const a = action as { type?: string; by?: number } | null;
  if (a?.type === 'add') return { slice: n + (a.by ?? 1) };
  if (a?.type === 'reset') return ctx.host ? { slice: null } : { refuse: 'not-host' };
  if (a?.type === 'full') return { refuse: 'full' };
  if (a?.type === 'big') return { slice: 'x'.repeat(MAX_SHARED_SIZE) };
  if (a?.type === 'boom') throw new Error('bug in the activity');
  if (a?.type === 'at') return { slice: ctx.at };
  return { refuse: 'bad-action' };
};
const settings: RoomSettings = { activities: { counter } };

const room = (...ids: string[]): RoomState =>
  ids.reduce((s, id) => applyRoomEvent(s, { type: 'join', playerId: id, name: id.toUpperCase() }, id), createRoom({ code: 'K7Q4MZ', hostId: HOST }));

let n = 0;
const sub = (playerId: string, action: unknown, extra: Partial<Extract<RoomEvent, { type: 'submit' }>> = {}): RoomEvent => ({
  type: 'submit',
  playerId,
  id: `m${n++}`,
  key: 'counter',
  action,
  at: NOW,
  ...extra,
});
const apply = (r: RoomState, e: RoomEvent, from: string) => applyRoomEvent(r, e, from, settings);

describe('submit in the room model', () => {
  it('applies the activity\'s rule to its slice, remembers the move\'s id, and bumps seq', () => {
    const r = room('a');
    const e = sub('a', { type: 'add', by: 2 });
    const next = apply(r, e, 'a');
    expect(next.shared).toEqual({ counter: 2 });
    expect(next.acked).toEqual({ a: [(e as { id: string }).id] });
    expect(next.seq).toBe(r.seq + 1);
    expect(apply(next, sub('a', { type: 'add' }), 'a').shared).toEqual({ counter: 3 });
  });

  it('applies a move once however many times it arrives', () => {
    const r = apply(room('a'), sub('a', { type: 'add' }, { id: 'same' }), 'a');
    expect(rejectRoomEvent(r, sub('a', { type: 'add' }, { id: 'same' }), 'a', settings)).toBe('duplicate');
    expect(apply(r, sub('a', { type: 'add' }, { id: 'same' }), 'a')).toBe(r);
    expect(r.shared).toEqual({ counter: 1 });
  });

  it('does not take the same id from two people as one', () => {
    let r = apply(room('a', 'b'), sub('a', { type: 'add' }, { id: 'x' }), 'a');
    r = apply(r, sub('b', { type: 'add' }, { id: 'x' }), 'b');
    expect(r.shared).toEqual({ counter: 2 });
  });

  it('remembers only the last ACK_KEEP ids of a person, and forgets a removed player\'s', () => {
    let r = room('a', 'b');
    for (let i = 0; i < ACK_KEEP + 5; i++) r = apply(r, sub('a', { type: 'add' }, { id: `k${i}` }), 'a');
    expect(r.acked!.a).toHaveLength(ACK_KEEP);
    expect(r.acked!.a![0]).toBe('k5');
    r = apply(r, sub('b', { type: 'add' }), 'b');
    r = applyRoomEvent(r, { type: 'remove', playerId: 'a' }, HOST);
    expect(r.acked).not.toHaveProperty('a');
    expect(r.acked).toHaveProperty('b');
  });

  it('refuses a stranger, a bad id, a move with no arrival time, and an activity it does not run', () => {
    const r = room('a');
    expect(rejectRoomEvent(r, sub('zz', { type: 'add' }), 'zz', settings)).toBe('unknown-player');
    for (const id of ['', 'x'.repeat(65), undefined as unknown as string])
      expect(rejectRoomEvent(r, sub('a', { type: 'add' }, { id }), 'a', settings)).toBe('bad-action');
    expect(rejectRoomEvent(r, sub('a', { type: 'add' }, { at: undefined }), 'a', settings)).toBe('bad-action');
    expect(rejectRoomEvent(r, sub('a', { type: 'add' }, { at: Number.NaN }), 'a', settings)).toBe('bad-action');
    expect(rejectRoomEvent(r, sub('a', { type: 'add' }, { key: 'other' }), 'a', settings)).toBe('unknown-activity');
    expect(rejectRoomEvent(r, sub('a', { type: 'add' }, { key: 'Bad Key' }), 'a', settings)).toBe('unknown-activity');
    expect(rejectRoomEvent(r, sub('a', { type: 'add' }, { key: 'constructor' }), 'a', { activities: {} })).toBe('unknown-activity');
    expect(rejectRoomEvent(r, sub('a', { type: 'add' }), 'a')).toBe('unknown-activity'); // no activities at all
  });

  it('is a player\'s own move only: nobody submits for someone else', () => {
    expect(rejectRoomEvent(room('a', 'b'), sub('b', { type: 'add' }), 'a', settings)).toBe('not-you');
  });

  it('lets the host move, with the host flag, and tells the rule who asked', () => {
    let r = apply(room('a'), sub('a', { type: 'add' }), 'a');
    expect(rejectRoomEvent(r, sub('a', { type: 'reset' }), 'a', settings)).toBe('not-host');
    r = apply(r, sub(HOST, { type: 'reset' }), HOST);
    expect(r.shared).toEqual({});
    expect(r.acked).toHaveProperty(HOST);
  });

  it('hands the rule the arrival time and the players', () => {
    const r = apply(room('a'), sub('a', { type: 'at' }, { at: 12345 }), 'a');
    expect(r.shared).toEqual({ counter: 12345 });
  });

  it('passes on the rule\'s refusal, one that throws, and a slice that is too big', () => {
    const r = room('a');
    expect(rejectRoomEvent(r, sub('a', { type: 'full' }), 'a', settings)).toBe('full');
    expect(rejectRoomEvent(r, sub('a', { type: 'nonsense' }), 'a', settings)).toBe('bad-action');
    expect(rejectRoomEvent(r, sub('a', { type: 'boom' }), 'a', settings)).toBe('bad-action');
    expect(rejectRoomEvent(r, sub('a', { type: 'big' }), 'a', settings)).toBe('full');
  });

  it('is refused in a closed room', () => {
    const closed = applyRoomEvent(room('a'), { type: 'close' }, HOST);
    expect(rejectRoomEvent(closed, sub('a', { type: 'add' }), 'a', settings)).toBe('closed');
  });

  it('survives a restart, and the host\'s save keeps what was acknowledged', () => {
    let r = apply(room('a'), sub('a', { type: 'add' }, { id: 'keep-me' }), 'a');
    r = applyRoomEvent(r, { type: 'restart' }, HOST, settings);
    expect(r.shared).toEqual({ counter: 1 });
    const back = restoreRoom(serializeRoom(r))!;
    expect(back.acked).toEqual({ a: ['keep-me'] });
    expect(rejectRoomEvent(back, sub('a', { type: 'add' }, { id: 'keep-me' }), 'a', settings)).toBe('duplicate');
  });

  it('restores only well-formed acknowledgements', () => {
    const base = JSON.parse(serializeRoom(room('a'))) as Record<string, unknown>;
    const restored = restoreRoom(JSON.stringify({ ...base, acked: { a: ['ok', 7, '', 'x'.repeat(70)], b: 'nope', __proto__: ['x'] } }))!;
    expect(restored.acked).toEqual({ a: ['ok'] });
    expect(restoreRoom(JSON.stringify({ ...base, acked: {} }))!.acked).toBeUndefined();
  });

  it('does not read an inherited name as someone\'s acknowledgements', () => {
    const r = apply(room('a'), sub('a', { type: 'add' }, { id: 'first-of-a' }), 'a'); // the room now has acknowledgements
    const withOdd = { ...r, players: [...r.players, { id: 'constructor', name: 'C', connected: true }] };
    const odd = apply(withOdd, sub('constructor', { type: 'add' }, { id: 'first' }), 'constructor');
    expect(odd.shared).toEqual({ counter: 2 });
    expect(odd.acked!.constructor).toEqual(['first']);
    expect(rejectRoomEvent(withOdd, sub('constructor', { type: 'add' }, { id: 'any' }), 'constructor', settings)).toBeNull();
  });
});

// --- through useRoom -------------------------------------------------------------------------------------------

type Hub = ReturnType<typeof createMemoryRoomHub<RoomMessage>>;

function Client({ transport, id, host, onApi, onRejected, clock }: { transport: RoomTransport; id: string; host?: RoomState; onApi: (a: UseRoomResult) => void; onRejected?: (reason: string, type: string) => void; clock?: () => number }) {
  const api = useRoom({ transport, selfId: id, host, code: host ? undefined : 'K7Q4MZ', settings, onRejected, now: clock ?? (() => NOW) });
  onApi(api);
  return null;
}
const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};

async function setup(extra: { lossy?: boolean; flaky?: boolean; clock?: () => number } = {}) {
  const hub: Hub = createMemoryRoomHub<RoomMessage>();
  let host!: UseRoomResult;
  let phone!: UseRoomResult;
  let other!: UseRoomResult;
  const rejected = vi.fn();
  const lossy = extra.lossy ? lossySender(hub.connect()) : null;
  const flaky = extra.flaky ? flakyReceiver(hub.connect()) : null;
  const phoneTransport = lossy?.transport ?? flaky?.transport ?? hub.connect();
  render(
    <>
      <Client transport={hub.connect()} id={HOST} host={createRoom({ code: 'K7Q4MZ', hostId: HOST })} onApi={(a) => (host = a)} clock={extra.clock} />
      <Client transport={phoneTransport} id="p1" onApi={(a) => (phone = a)} onRejected={rejected} />
      <Client transport={hub.connect()} id="p2" onApi={(a) => (other = a)} />
    </>,
  );
  await flush();
  await act(async () => phone.send({ type: 'join', playerId: 'p1', name: 'P1' }));
  await act(async () => other.send({ type: 'join', playerId: 'p2', name: 'P2' }));
  await flush();
  return { hub, host: () => host, phone: () => phone, other: () => other, rejected, lossy, flaky };
}

describe('submit through useRoom', () => {
  it('a phone\'s move reaches the host, is stamped with the host\'s clock, and every phone sees it', async () => {
    const t = await setup();
    await act(async () => t.phone().send({ type: 'submit', playerId: 'p1', id: 'a1', key: 'counter', action: { type: 'at' }, at: -999 }));
    await flush();
    expect(t.host().room!.shared).toEqual({ counter: NOW });
    expect(t.other().room!.shared).toEqual({ counter: NOW });
    expect(t.phone().room!.acked!.p1).toEqual(['a1']);
  });

  it('the host\'s own move is stamped too', async () => {
    const t = await setup();
    await act(async () => t.host().send({ type: 'submit', playerId: HOST, id: 'h1', key: 'counter', action: { type: 'at' } }));
    expect(t.host().room!.shared).toEqual({ counter: NOW });
  });

  it('applies a move delivered three times once', async () => {
    const t = await setup();
    const spy = t.hub.connect();
    const move: RoomEvent = { type: 'submit', playerId: 'p1', id: 'dup', key: 'counter', action: { type: 'add' } };
    for (let i = 0; i < 3; i++) await act(async () => spy.send({ kind: 'intent', from: 'p1', event: move }));
    await flush();
    expect(t.host().room!.shared).toEqual({ counter: 1 });
  });

  it('applies moves in the order the host got them, whatever order a phone\'s screen saw the states in', async () => {
    const t = await setup({ flaky: true });
    t.flaky!.hold();
    for (const id of ['x1', 'x2', 'x3']) await act(async () => t.other().send({ type: 'submit', playerId: 'p2', id, key: 'counter', action: { type: 'add' } }));
    await flush();
    act(() => t.flaky!.release({ order: 'reverse', repeat: 2 }));
    await flush();
    expect(t.phone().room!.shared).toEqual({ counter: 3 });
    expect(t.phone().room!.seq).toBe(t.host().room!.seq);
  });

  it('sends a move again if the first was lost, until the state shows it, and the host applies it once', async () => {
    vi.useFakeTimers();
    const t = await setup({ lossy: true });
    t.lossy!.drop(1);
    await act(async () => t.phone().send({ type: 'submit', playerId: 'p1', id: 'lost-once', key: 'counter', action: { type: 'add' } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(t.host().room!.shared).toBeUndefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(t.host().room!.shared).toEqual({ counter: 1 });
    const sentBefore = t.lossy!.sent().length;
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(t.lossy!.sent().length).toBe(sentBefore); // it has seen the move land: no more sends
    expect(t.host().room!.shared).toEqual({ counter: 1 });
  });

  it('keeps sending several moves at once, each until it is shown, and gives up after a few tries', async () => {
    vi.useFakeTimers();
    const t = await setup({ lossy: true });
    t.lossy!.drop(1000);
    for (const id of ['m-a', 'm-b']) await act(async () => t.phone().send({ type: 'submit', playerId: 'p1', id, key: 'counter', action: { type: 'add' } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(40_000); });
    const sends = t.lossy!.sent().filter((m) => m.kind === 'intent' && m.event.type === 'submit');
    expect(sends.filter((m) => m.kind === 'intent' && m.event.type === 'submit' && m.event.id === 'm-a')).toHaveLength(6); // once, then five more
    expect(sends.filter((m) => m.kind === 'intent' && m.event.type === 'submit' && m.event.id === 'm-b')).toHaveLength(6);
  });

  it('does not send a move that says not to (a reaction that is late is no reaction)', async () => {
    vi.useFakeTimers();
    const t = await setup({ lossy: true });
    t.lossy!.drop(1000);
    await act(async () => t.phone().send({ type: 'submit', playerId: 'p1', id: 'once', key: 'counter', action: { type: 'add' }, retry: false }));
    await act(async () => { await vi.advanceTimersByTimeAsync(40_000); });
    expect(t.lossy!.sent().filter((m) => m.kind === 'intent' && m.event.type === 'submit')).toHaveLength(1);
  });

  it('stops sending a move the host refused, and tells the phone why', async () => {
    vi.useFakeTimers();
    const t = await setup({ lossy: true });
    await act(async () => t.phone().send({ type: 'submit', playerId: 'p1', id: 'no', key: 'counter', action: { type: 'reset' } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(t.rejected).toHaveBeenCalledWith('not-host', 'submit');
    const before = t.lossy!.sent().length;
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(t.lossy!.sent().length).toBe(before);
  });

  it('only stops the move that was refused, and keeps sending another', async () => {
    vi.useFakeTimers();
    const t = await setup({ lossy: true });
    t.lossy!.drop(1); // the first move is lost; the second is delivered, and refused
    await act(async () => t.phone().send({ type: 'submit', playerId: 'p1', id: 'fine', key: 'counter', action: { type: 'add' } }));
    await act(async () => t.phone().send({ type: 'submit', playerId: 'p1', id: 'bad', key: 'counter', action: { type: 'reset' } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(t.rejected).toHaveBeenCalledWith('not-host', 'submit');
    expect(t.host().room!.shared).toBeUndefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(t.host().room!.shared).toEqual({ counter: 1 });
  });

  it('says nothing to a phone whose move was a repeat', async () => {
    const t = await setup();
    const move: RoomEvent = { type: 'submit', playerId: 'p1', id: 'twice', key: 'counter', action: { type: 'add' } };
    await act(async () => t.phone().send(move));
    await flush();
    await act(async () => t.phone().send(move));
    await flush();
    expect(t.rejected).not.toHaveBeenCalled();
  });

  it('a host that is refused its own move hears it', async () => {
    const hub = createMemoryRoomHub<RoomMessage>();
    let host!: UseRoomResult;
    const rejected = vi.fn();
    render(<Client transport={hub.connect()} id={HOST} host={room('a')} onApi={(a) => (host = a)} onRejected={rejected} />);
    await act(async () => host.send({ type: 'submit', playerId: HOST, id: 'h', key: 'nope', action: {} }));
    expect(rejected).toHaveBeenCalledWith('unknown-activity', 'submit');
  });
});
