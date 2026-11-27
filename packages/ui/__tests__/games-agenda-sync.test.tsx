/**
 * Agenda sync: one agenda kept right across a presenter's windows and a refresh. Messages that
 * arrive twice, late or out of order change nothing twice; nothing read from the network or from
 * storage is trusted; a second screen with the wrong clock agrees with the controlling window.
 */
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyAgendaEvent, createAgenda, type AgendaEvent, type AgendaItem, type AgendaState } from '../src/games/agenda-model.js';
import {
  AGENDA_SEQ_JUMP,
  MAX_ITEMS,
  acceptIntent,
  createAgendaStore,
  isAgendaEvent,
  readAgendaState,
  readItems,
  readSnapshot,
  restoreAgenda,
  serializeAgenda,
  stampEvent,
  type AgendaMessage,
} from '../src/games/agenda-sync-model.js';
import { createMemoryRoomHub, type RoomTransport } from '../src/games/room-model.js';
import { useAgendaSync, type UseAgendaSyncResult } from '../src/games/use-agenda-sync.js';
import { flakyReceiver } from './flaky-transport.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const T0 = 1_700_000_000_000;
const MIN = 60_000;

const items = (): AgendaItem[] => [
  { id: 'intro', title: 'Welcome', minutes: 5, notes: 'Say hello.' },
  { id: 'demo', title: 'Demo', minutes: 10 },
  { id: 'qa', title: 'Questions', minutes: 2 },
];

const running = (): AgendaState => applyAgendaEvent(items(), createAgenda(), { type: 'start', at: T0 });

describe('reading what is not trusted', () => {
  it('keeps items that read, caps them, and drops the rest', () => {
    expect(readItems('nope')).toEqual([]);
    const long = 'x'.repeat(9_000);
    const got = readItems([
      { id: 'a', title: 'A', minutes: 5, notes: 'n' },
      { id: 'a', title: 'repeat', minutes: 1 },
      { id: 'b c', title: 'bad id', minutes: 1 },
      { id: 'c', title: 7, minutes: 1 },
      { id: 'd', title: 'D', minutes: Number.NaN },
      { id: 'e', title: long, minutes: 99_999, notes: long },
      { id: 'f', title: 'F', minutes: -3, notes: '' },
      null,
      [],
    ]);
    expect(got.map((i) => i.id)).toEqual(['a', 'e', 'f']);
    expect(got[1]?.title).toHaveLength(120);
    expect(got[1]?.notes).toHaveLength(4_000);
    expect(got[1]?.minutes).toBe(720);
    expect(got[2]).toEqual({ id: 'f', title: 'F', minutes: 0 });
    const many = Array.from({ length: MAX_ITEMS + 10 }, (_, i) => ({ id: `i${i}`, title: 'T', minutes: 1 }));
    expect(readItems(many)).toHaveLength(MAX_ITEMS);
  });

  it('reads a state that fits the items, and refuses one that does not', () => {
    const s = running();
    expect(readAgendaState(JSON.parse(JSON.stringify(s)), items())).toEqual(s);
    expect(readAgendaState(null, items())).toBeNull();
    expect(readAgendaState({ ...s, current: 1.5 }, items())).toBeNull();
    expect(readAgendaState({ ...s, current: 9 }, items())).toBeNull();
    expect(readAgendaState({ ...s, current: -2 }, items())).toBeNull();
    expect(readAgendaState({ ...s, startedAt: 'now' }, items())).toBeNull();
    expect(readAgendaState({ ...s, pausedAt: 'now' }, items())).toBeNull();
    expect(readAgendaState({ ...s, startedAt: null }, items())).toBeNull(); // running with no start
    expect(readAgendaState({ ...createAgenda(), startedAt: T0 }, items())).toBeNull(); // not started, but timed
    expect(readAgendaState({ ...s, pausedAt: T0 - 1 }, items())).toBeNull(); // paused before it began
    const mixed = readAgendaState({ ...s, extra: { intro: 2, demo: -4, nope: 1, qa: 'x' }, spent: { intro: 5, demo: Number.NaN } }, items());
    expect(mixed?.extra).toEqual({ intro: 2 });
    expect(mixed?.spent).toEqual({ intro: 5 });
    expect(readAgendaState({ ...s, extra: 'x', spent: null }, items())).toMatchObject({ extra: {}, spent: {} });
  });

  it('reads a snapshot from a message, and not a message with a bad seq or state', () => {
    const msg = { kind: 'agenda-state', items: items(), state: running(), seq: 3, at: T0, session: 's' } as const;
    expect(readSnapshot(msg)).toEqual({ items: items(), state: running(), seq: 3 });
    expect(readSnapshot({ ...msg, seq: -1 })).toBeNull();
    expect(readSnapshot({ ...msg, seq: Number.NaN })).toBeNull();
    expect(readSnapshot({ ...msg, state: { ...running(), current: 40 } })).toBeNull();
  });

  it('knows an event from the network by its shape', () => {
    for (const ok of [
      { type: 'start', at: 1 },
      { type: 'pause', at: 1 },
      { type: 'resume', at: 1 },
      { type: 'next', from: 0, at: 1 },
      { type: 'back', from: 2, at: 1 },
      { type: 'extend', minutes: -1 },
      { type: 'reset' },
    ]) {
      expect(isAgendaEvent(ok)).toBe(true);
    }
    for (const bad of [
      null,
      'next',
      { type: 'jump' },
      { type: 'start' },
      { type: 'start', at: 'now' },
      { type: 'next', at: 1 },
      { type: 'next', from: 0.5, at: 1 },
      { type: 'extend', minutes: Number.POSITIVE_INFINITY },
      { type: 'extend', minutes: 100_000 },
    ]) {
      expect(isAgendaEvent(bad)).toBe(false);
    }
  });

  it('stamps an event with the controlling clock, and leaves the ones without a time', () => {
    expect(stampEvent({ type: 'start', at: 1 }, 9)).toEqual({ type: 'start', at: 9 });
    expect(stampEvent({ type: 'next', from: 1, at: 1 }, 9)).toEqual({ type: 'next', from: 1, at: 9 });
    expect(stampEvent({ type: 'back', from: 1, at: 1 }, 9)).toEqual({ type: 'back', from: 1, at: 9 });
    expect(stampEvent({ type: 'pause', at: 1 }, 9)).toEqual({ type: 'pause', at: 9 });
    expect(stampEvent({ type: 'resume', at: 1 }, 9)).toEqual({ type: 'resume', at: 9 });
    expect(stampEvent({ type: 'extend', minutes: 1 }, 9)).toEqual({ type: 'extend', minutes: 1 });
    expect(stampEvent({ type: 'reset' }, 9)).toEqual({ type: 'reset' });
  });

  it('accepts an intent made against the current state, once', () => {
    const applied = new Set<string>();
    expect(acceptIntent(4, { id: 'a', seq: 4 }, applied)).toBe(true);
    expect(acceptIntent(4, { id: 'a', seq: 5 }, applied)).toBe(false);
    expect(acceptIntent(4, { id: 'b', seq: 3 }, applied)).toBe(false);
    applied.add('a');
    expect(acceptIntent(4, { id: 'a', seq: 4 }, applied)).toBe(false);
  });
});

describe('keeping the agenda across a refresh', () => {
  it('round-trips, with seq well ahead and a running item still counting', () => {
    const snap = { items: items(), state: running(), seq: 7 };
    const back = restoreAgenda(serializeAgenda(snap));
    expect(back).toEqual({ ...snap, seq: 7 + AGENDA_SEQ_JUMP });
  });

  it('is null for nothing, nonsense, or an agenda it cannot read', () => {
    expect(restoreAgenda(null)).toBeNull();
    expect(restoreAgenda('')).toBeNull();
    expect(restoreAgenda('{not json')).toBeNull();
    expect(restoreAgenda('[]')).toBeNull();
    expect(restoreAgenda(JSON.stringify({ items: items(), state: running(), seq: -1 }))).toBeNull();
    expect(restoreAgenda(JSON.stringify({ items: [], state: createAgenda(), seq: 1 }))).toBeNull();
    expect(restoreAgenda(JSON.stringify({ items: items(), state: { current: 99 }, seq: 1 }))).toBeNull();
  });

  it('saves, loads and clears, and never throws when storage is missing or broken', () => {
    const data = new Map<string, string>();
    const store = createAgendaStore(
      { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) },
      'agenda',
    );
    expect(store.load()).toBeNull();
    store.save({ items: items(), state: running(), seq: 2 });
    expect(store.load()?.state.current).toBe(0);
    store.clear();
    expect(store.load()).toBeNull();
    const broken = createAgendaStore(
      {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('full');
        },
        removeItem: () => {
          throw new Error('blocked');
        },
      },
      'agenda',
    );
    expect(broken.load()).toBeNull();
    expect(() => broken.save({ items: items(), state: running(), seq: 1 })).not.toThrow();
    expect(() => broken.clear()).not.toThrow();
    const none = createAgendaStore(null, 'agenda');
    expect(none.load()).toBeNull();
    expect(() => none.save({ items: items(), state: running(), seq: 1 })).not.toThrow();
  });
});

// --- useAgendaSync: a second screen -------------------------------------------------------------

type Hub = ReturnType<typeof createMemoryRoomHub<AgendaMessage>>;

function Screen({
  hub,
  transport,
  initial,
  onApi,
  onChange,
  now,
}: {
  hub?: Hub;
  transport?: RoomTransport<AgendaMessage> | null;
  initial?: { items: readonly AgendaItem[]; state: AgendaState; seq?: number };
  onApi: (api: UseAgendaSyncResult) => void;
  onChange?: Parameters<typeof useAgendaSync>[0]['onChange'];
  now?: () => number;
}) {
  const [t] = React.useState(() => (transport !== undefined ? transport : hub!.connect()));
  const api = useAgendaSync({ transport: t, initial, now, onChange });
  onApi(api);
  return null;
}

const settle = () => act(async () => {});
const fresh = () => ({ items: items(), state: createAgenda() });

describe('useAgendaSync', () => {
  it("shows the controlling window's agenda on a second screen, and follows every change", async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let main!: UseAgendaSyncResult;
    let second!: UseAgendaSyncResult;
    render(
      <>
        <Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    expect(main.controls).toBe(true);
    expect(second.controls).toBe(false);
    expect(second.items).toHaveLength(3);
    await act(async () => main.send({ type: 'start', at: 0 }));
    expect(second.state).toMatchObject({ current: 0, startedAt: T0 });
    await act(async () => main.send({ type: 'next', from: 0, at: 0 }));
    expect(second.state?.current).toBe(1);
  });

  it('a screen opened late asks and is told', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let main!: UseAgendaSyncResult;
    const first = render(<Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />);
    await settle();
    await act(async () => main.send({ type: 'start', at: 0 }));
    let second!: UseAgendaSyncResult;
    first.rerender(
      <>
        <Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    expect(second.state).toBeNull();
    expect(second.items).toHaveLength(0);
    await settle();
    expect(second.state?.current).toBe(0);
  });

  it("applies a second screen's tap on the controlling window, stamped with its clock", async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let main!: UseAgendaSyncResult;
    let second!: UseAgendaSyncResult;
    render(
      <>
        <Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0 + 5000} />
        <Screen hub={hub} onApi={(a) => (second = a)} now={() => 0} />
      </>,
    );
    await settle();
    await act(async () => second.send({ type: 'start', at: 12 })); // the screen's own, wrong, clock
    expect(main.state).toMatchObject({ current: 0, startedAt: T0 + 5000 });
    expect(second.state?.current).toBe(0);
  });

  it('applies a repeated tap once, and drops one made against an older screen', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const spy = hub.connect();
    let main!: UseAgendaSyncResult;
    let second!: UseAgendaSyncResult;
    render(
      <>
        <Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    await act(async () => second.send({ type: 'start', at: 0 }));
    const intent: AgendaMessage = { kind: 'agenda-intent', id: 'tap-1', seq: 1, event: { type: 'extend', minutes: 1 } };
    await act(async () => spy.send(intent));
    await act(async () => spy.send(intent)); // the network delivers it again
    await act(async () => spy.send(intent));
    expect(main.state?.extra).toEqual({ intro: 1 });
    // Made against the state before the first tap: dropped, and the screen is brought up to date.
    await act(async () => spy.send({ kind: 'agenda-intent', id: 'tap-2', seq: 1, event: { type: 'extend', minutes: 1 } }));
    expect(main.state?.extra).toEqual({ intro: 1 });
    expect(second.state?.extra).toEqual({ intro: 1 });
  });

  it('answers a tap made against an older screen with the current state, so that screen catches up', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const spy = hub.connect();
    const heard: AgendaMessage[] = [];
    spy.subscribe((m) => heard.push(m));
    let main!: UseAgendaSyncResult;
    render(<Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />);
    await settle();
    await act(async () => main.send({ type: 'start', at: 0 }));
    heard.length = 0;
    await act(async () => spy.send({ kind: 'agenda-intent', id: 'old-tap', seq: 0, event: { type: 'next', from: 0, at: 0 } }));
    expect(main.state?.current).toBe(0);
    const told = heard.filter((m) => m.kind === 'agenda-state');
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ seq: 1, state: { current: 0 } });
  });

  it('keeps the newest state when messages arrive late, repeated and out of order', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let main!: UseAgendaSyncResult;
    let second!: UseAgendaSyncResult;
    const flaky = flakyReceiver(hub.connect());
    render(
      <>
        <Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />
        <Screen transport={flaky.transport} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    flaky.hold();
    await act(async () => main.send({ type: 'start', at: 0 }));
    await act(async () => main.send({ type: 'next', from: 0, at: 0 }));
    await act(async () => main.send({ type: 'next', from: 1, at: 0 }));
    await act(async () => main.send({ type: 'pause', at: 0 }));
    expect(flaky.held()).toHaveLength(4);
    expect(second.state?.current).toBe(-1);
    act(() => flaky.release({ order: 'reverse', repeat: 2 }));
    expect(second.state).toMatchObject({ current: 2, pausedAt: T0 });
    act(() => flaky.release()); // nothing more held: no change
    expect(second.state?.current).toBe(2);
  });

  it("ignores another screen's hello and states, and a controlling window's own intents", async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const spy = hub.connect();
    let main!: UseAgendaSyncResult;
    let second!: UseAgendaSyncResult;
    render(
      <>
        <Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    await act(async () => spy.send({ kind: 'agenda-hello' }));
    await act(async () => spy.send({ kind: 'agenda-intent', id: 'x', seq: 0, event: { type: 'start', at: 1 } }));
    expect(second.state?.current).toBe(0); // the screen followed, because the main window applied it
    // A second screen ignores another screen's intent and hello (only the controlling window answers them).
    await act(async () => spy.send({ kind: 'agenda-hello' }));
    await act(async () => spy.send({ kind: 'agenda-intent', id: 'y', seq: 1, event: { type: 'extend', minutes: 1 } }));
    expect(main.state?.extra).toEqual({ intro: 1 });
    expect(second.state?.extra).toEqual({ intro: 1 });
  });

  it('refuses an intent or a state that does not read, and a controlling window never follows a state', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const spy = hub.connect();
    let main!: UseAgendaSyncResult;
    let second!: UseAgendaSyncResult;
    render(
      <>
        <Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    const before = main.state;
    await act(async () => spy.send({ kind: 'agenda-intent', id: 'bad', seq: 0, event: { type: 'jump' } as unknown as AgendaEvent }));
    await act(async () => spy.send({ kind: 'agenda-intent', id: 7 as unknown as string, seq: 0, event: { type: 'reset' } }));
    expect(main.state).toBe(before);
    // A state from elsewhere with a wrong shape is not taken; one that fits, from a controlling window's peer, is not read by a controlling window.
    await act(async () =>
      spy.send({ kind: 'agenda-state', items: items(), state: { current: 99 } as unknown as AgendaState, seq: 50, at: T0, session: 'z' }),
    );
    expect(second.state?.current).toBe(-1);
    await act(async () =>
      spy.send({ kind: 'agenda-state', items: items(), state: running(), seq: 50, at: T0, session: 'other' }),
    );
    expect(main.state).toBe(before);
  });

  it('follows a controlling window that comes back after a refresh, with or without a saved agenda', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const data = new Map<string, string>();
    const store = createAgendaStore(
      { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) },
      'agenda',
    );
    let second!: UseAgendaSyncResult;
    let main!: UseAgendaSyncResult;
    const clock = { t: T0 };
    const boot = (initial: { items: readonly AgendaItem[]; state: AgendaState; seq?: number }, key: string) => (
      <>
        <Screen key={key} hub={hub} initial={initial} onApi={(a) => (main = a)} onChange={store.save} now={() => clock.t} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>
    );
    const view = render(boot(fresh(), 'a'));
    await settle();
    await act(async () => main.send({ type: 'start', at: 0 }));
    await act(async () => main.send({ type: 'next', from: 0, at: 0 }));
    expect(store.load()?.state.current).toBe(1);
    // The presenter's page is refreshed: the saved agenda comes back, with the clock still running.
    clock.t = T0 + 3 * MIN;
    view.unmount();
    const restored = store.load()!;
    render(boot(restored, 'b'));
    await settle();
    expect(main.state).toMatchObject({ current: 1, pausedAt: null });
    expect(second.state?.current).toBe(1);
    await act(async () => main.send({ type: 'next', from: 1, at: 0 }));
    expect(second.state?.current).toBe(2);
  });

  it('follows a controlling window that restarts with nothing saved, though its seq starts again', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let second!: UseAgendaSyncResult;
    let main!: UseAgendaSyncResult;
    const view = render(
      <>
        <Screen key="a" hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    await act(async () => main.send({ type: 'start', at: 0 }));
    await act(async () => main.send({ type: 'next', from: 0, at: 0 }));
    await act(async () => main.send({ type: 'next', from: 1, at: 0 }));
    expect(second.state?.current).toBe(2);
    view.rerender(
      <>
        <Screen key="b" hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    expect(second.state?.current).toBe(-1);
    await act(async () => main.send({ type: 'start', at: 0 }));
    expect(second.state?.current).toBe(0);
  });

  it("reads the controlling window's clock: a second screen with the wrong clock agrees", async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let second!: UseAgendaSyncResult;
    let main!: UseAgendaSyncResult;
    const real = Date.now();
    render(
      <>
        <Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => real + 90_000} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    await act(async () => main.send({ type: 'start', at: 0 }));
    expect(main.now()).toBe(real + 90_000);
    expect(second.now() - Date.now()).toBeGreaterThan(89_000);
    expect(second.now() - Date.now()).toBeLessThanOrEqual(90_000);
  });

  it('does nothing without a transport, and a second screen with no agenda yet sends nothing', async () => {
    let alone!: UseAgendaSyncResult;
    const hub = createMemoryRoomHub<AgendaMessage>();
    let blank!: UseAgendaSyncResult;
    render(
      <>
        <Screen transport={null} initial={fresh()} onApi={(a) => (alone = a)} />
        <Screen hub={hub} onApi={(a) => (blank = a)} />
      </>,
    );
    await act(async () => alone.send({ type: 'start', at: 0 }));
    expect(alone.state?.current).toBe(0); // a presenter alone on one screen still works
    await act(async () => blank.send({ type: 'start', at: 0 }));
    expect(blank.state).toBeNull();
    let empty!: UseAgendaSyncResult;
    render(<Screen hub={hub} onApi={(a) => (empty = a)} initial={{ items: [], state: createAgenda() }} />);
    await act(async () => empty.send({ type: 'start', at: 0 })); // nothing to start: no change, nothing sent
    expect(empty.state?.current).toBe(-1);
  });

  it('remembers a bounded number of taps', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const spy = hub.connect();
    let main!: UseAgendaSyncResult;
    render(<Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />);
    await settle();
    await act(async () => main.send({ type: 'start', at: 0 }));
    for (let i = 0; i < 250; i++) {
      await act(async () =>
        spy.send({ kind: 'agenda-intent', id: `t${i}`, seq: 1 + i, event: { type: 'extend', minutes: i % 2 ? -1 : 1 } }),
      );
    }
    expect(main.state?.extra.intro).toBe(0);
    // The first tap is old enough to be forgotten: its id is applied again only if its seq were current.
    await act(async () => spy.send({ kind: 'agenda-intent', id: 't0', seq: 251, event: { type: 'extend', minutes: 3 } }));
    expect(main.state?.extra.intro).toBe(3);
  });

  it('keeps a 30-screen room of second screens in step through a lossy network', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let main!: UseAgendaSyncResult;
    const apis: UseAgendaSyncResult[] = [];
    const flaky = Array.from({ length: 30 }, () => flakyReceiver(hub.connect()));
    render(
      <>
        <Screen hub={hub} initial={fresh()} onApi={(a) => (main = a)} now={() => T0} />
        {flaky.map((f, i) => (
          <Screen key={i} transport={f.transport} onApi={(a) => (apis[i] = a)} />
        ))}
      </>,
    );
    await settle();
    flaky.forEach((f, i) => i % 2 && f.hold());
    await act(async () => main.send({ type: 'start', at: 0 }));
    await act(async () => main.send({ type: 'next', from: 0, at: 0 }));
    await act(async () => main.send({ type: 'extend', minutes: 2 }));
    act(() => flaky.forEach((f, i) => i % 2 && f.release({ order: i % 4 === 1 ? 'reverse' : 'fifo', repeat: 3 })));
    for (const api of apis) expect(api.state).toEqual(main.state);
  });
});
