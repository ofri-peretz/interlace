/**
 * Sound cues on a live room: a screen hears the changes it watches happen, once each, and nothing for
 * a state it loaded into. Run against a real host, a real network that repeats, delays and reorders,
 * a screen that joins late, a phone that reconnects, and a host that refreshes.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useRoom, type UseRoomResult } from '../src/games/live-room.js';
import {
  createMemoryRoomHub,
  createRoom,
  createRoomStore,
  type RoomMessage,
  type RoomSettings,
  type RoomState,
  type RoomTransport,
} from '../src/games/room-model.js';
import type { CueAudio } from '../src/games/sound-cues-model.js';
import { useSoundCues } from '../src/games/use-sound-cues.js';
import { flakyReceiver } from './flaky-transport.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const HOST = 'host';
const CODE = 'K7Q4MZ';
const settings: RoomSettings = {};

/** A speaker that only counts the cues. */
function speaker() {
  let plays = 0;
  const audio = {
    // A player reads the clock once for each cue it plays.
    get currentTime() {
      return (plays += 1);
    },
    state: 'running',
    destination: {},
    resume: async () => undefined,
    close: async () => undefined,
    createOscillator: () => ({ type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }),
    createGain: () => ({ gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }),
  };
  return { audio: audio as unknown as CueAudio, cues: () => plays };
}


const apis = new Map<string, UseRoomResult>();
const last = new Map<string, ReturnType<typeof useSoundCues>>();

function Screen({ transport, id, host, sound, tag }: { transport: RoomTransport; id: string; host?: RoomState; sound?: CueAudio; tag: string }) {
  let t = 5_000_000;
  const api = useRoom({ transport, selfId: id, host, code: host ? undefined : CODE, settings, now: () => (t += 1500) });
  apis.set(tag, api);
  const cues = useSoundCues(api.room, { makeAudio: () => sound as CueAudio, joinGapMs: 0, now: () => 0 });
  last.set(tag, cues);
  return null;
}

const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};

describe('sound cues on a live room', () => {
  const setup = async (options: { flaky?: boolean } = {}) => {
    apis.clear();
    last.clear();
    const hub = createMemoryRoomHub<RoomMessage>();
    const hall = speaker();
    const flaky = options.flaky ? flakyReceiver(hub.connect()) : null;
    const tree = (hostKey: string, state: RoomState) => (
      <>
        <Screen key={hostKey} transport={hub.connect()} id={HOST} host={state} tag="host" />
        <Screen key="screen" transport={flaky ? flaky.transport : hub.connect()} id="p1" sound={hall.audio} tag="screen" />
      </>
    );
    const view = render(tree('h1', createRoom({ code: CODE, hostId: HOST })));
    await flush();
    await act(async () => apis.get('screen')!.send({ type: 'join', playerId: 'p1', name: 'Screen' }));
    await flush();
    await act(async () => last.get('screen')!.setEnabled(true));
    return { hub, hall, flaky, view, tree, host: () => apis.get('host')!, screen: () => apis.get('screen')! };
  };

  it('plays one cue for each change it watches, in order, and writes each', async () => {
    const t = await setup();
    const base = t.hall.cues(); // turning it on plays one note to say so
    await act(async () => t.host().send({ type: 'countdown', startsAt: 1 }));
    await flush();
    expect(t.hall.cues()).toBe(base + 1);
    expect(last.get('screen')!.caption).toBe('Get ready');
    await act(async () => t.host().send({ type: 'question', endsAt: null }));
    await flush();
    await act(async () => t.host().send({ type: 'reveal', points: {} }));
    await flush();
    await act(async () => t.host().send({ type: 'podium' }));
    await flush();
    expect(t.hall.cues()).toBe(base + 4);
    expect(last.get('screen')!.caption).toBe('Podium');
  });

  it('plays nothing for a screen that joins late into a room already past the lobby', async () => {
    const t = await setup();
    await act(async () => t.host().send({ type: 'countdown', startsAt: 1 }));
    await act(async () => t.host().send({ type: 'question', endsAt: null }));
    await flush();
    const late = speaker();
    render(<Screen transport={t.hub.connect()} id="late" sound={late.audio} tag="late" />);
    await flush();
    await act(async () => last.get('late')!.setEnabled(true));
    const base = late.cues();
    await act(async () => apis.get('late')!.send({ type: 'join', playerId: 'late', name: 'Late' }));
    await flush();
    expect(late.cues()).toBe(base);
    expect(last.get('late')!.last).toBeNull();
    await act(async () => t.host().send({ type: 'reveal', points: {} }));
    await flush();
    expect(late.cues()).toBe(base + 1); // and the next real change is heard
  });

  it('plays a change once when the network delivers it three times, late, and in reverse', async () => {
    const t = await setup({ flaky: true });
    const base = t.hall.cues();
    t.flaky!.hold();
    await act(async () => t.host().send({ type: 'countdown', startsAt: 1 }));
    await act(async () => t.host().send({ type: 'question', endsAt: null }));
    await act(async () => t.host().send({ type: 'reveal', points: {} }));
    await flush();
    expect(t.hall.cues()).toBe(base);
    act(() => t.flaky!.release({ order: 'reverse', repeat: 3 }));
    await flush();
    expect(t.screen().room!.phase).toBe('reveal');
    expect(t.hall.cues()).toBe(base + 1); // the newest state is heard once; the older ones, arriving after it, are not
    expect(last.get('screen')!.last).toEqual({ kind: 'reveal', n: 1 });
  });

  it('plays nothing when the host refreshes and the screen is given the saved room again', async () => {
    const storage = new Map<string, string>();
    const store = createRoomStore({ getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) }, 'room', { hostId: HOST });
    const t = await setup();
    await act(async () => t.host().send({ type: 'countdown', startsAt: 1 }));
    await act(async () => t.host().send({ type: 'question', endsAt: null }));
    await flush();
    store.save(t.host().room!);
    const heard = t.hall.cues();
    t.view.rerender(t.tree('h2', store.load()!));
    await flush();
    expect(t.screen().room!.phase).toBe('question');
    expect(t.hall.cues()).toBe(heard);
  });

  it('plays a join cue for people arriving in the lobby, and not for the screen itself', async () => {
    const t = await setup();
    const base = t.hall.cues();
    render(<Screen transport={t.hub.connect()} id="p2" tag="p2" />);
    await flush();
    await act(async () => apis.get('p2')!.send({ type: 'join', playerId: 'p2', name: 'Two' }));
    await flush();
    expect(t.hall.cues()).toBe(base + 1);
    expect(last.get('screen')!.caption).toBe('Someone joined');
  });

  it('is silent when it is off, whatever the room does', async () => {
    const t = await setup();
    await act(async () => last.get('screen')!.setEnabled(false));
    const heard = t.hall.cues();
    await act(async () => t.host().send({ type: 'countdown', startsAt: 1 }));
    await act(async () => t.host().send({ type: 'question', endsAt: null }));
    await flush();
    expect(t.hall.cues()).toBe(heard);
  });
});
