/**
 * Sound cues: which cue plays for which change (and which never do), the notes, the player, and the
 * switch and words that go with them.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SoundCueToggle, MIN_VIEWPORT } from '../src/games/sound-cue-toggle.js';
import {
  CUE_LABELS,
  CUE_NOTES,
  MAX_CUE_GAIN,
  createCuePlayer,
  cueView,
  initialCueState,
  stepCues,
  type CueAudio,
  type CueKind,
  type CueState,
  type CueView,
} from '../src/games/sound-cues-model.js';
import { useSoundCues } from '../src/games/use-sound-cues.js';

// jsdom has no PointerEvent; Base UI's switch makes one on click.
if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}

afterEach(cleanup);

const v = (seq: number, phase: CueView['phase'], players = 3): CueView => ({ seq, phase, players });

/** Watch these states one after another; what was heard, and when. */
function watch(states: readonly CueView[], times: readonly number[] = []) {
  let s: CueState = initialCueState;
  const heard: (CueKind | null)[] = [];
  states.forEach((view, i) => {
    const step = stepCues(s, view, times[i] ?? i * 10_000);
    s = step.state;
    heard.push(step.cue);
  });
  return heard;
}

describe('sound-cues-model: which cue plays', () => {
  it('plays a cue for each change of phase, and nothing for the first state seen', () => {
    expect(watch([v(1, 'lobby'), v(2, 'countdown'), v(3, 'question'), v(4, 'reveal'), v(5, 'podium')])).toEqual([null, 'countdown', 'go', 'reveal', 'podium']);
  });

  it('is silent for a late joiner, a reconnect and a refreshed host: the first state is never a change', () => {
    for (const phase of ['lobby', 'countdown', 'question', 'reveal', 'podium'] as const) expect(watch([v(40, phase)])).toEqual([null]);
  });

  it('is silent for a state that repeats, arrives late, or is older', () => {
    expect(watch([v(5, 'lobby'), v(6, 'question'), v(6, 'question'), v(5, 'lobby'), v(3, 'reveal')])).toEqual([null, 'go', null, null, null]);
  });

  it('plays only the last of several changes that arrive together, once', () => {
    expect(watch([v(1, 'lobby'), v(9, 'reveal'), v(9, 'reveal')])).toEqual([null, 'reveal', null]);
  });

  it('plays nothing for the room closing or starting over', () => {
    expect(watch([v(1, 'podium'), v(2, 'closed')])).toEqual([null, null]);
    expect(watch([v(1, 'podium'), v(2, 'lobby')])).toEqual([null, null]);
  });

  it('plays a join cue in the lobby, at most once in the gap, and not for a player leaving or outside the lobby', () => {
    expect(watch([v(1, 'lobby', 1), v(2, 'lobby', 2), v(3, 'lobby', 3), v(4, 'lobby', 4)], [0, 0, 1000, 2000])).toEqual([null, 'join', null, 'join'].map((c) => c));
    expect(watch([v(1, 'lobby', 3), v(2, 'lobby', 2)])).toEqual([null, null]);
    expect(watch([v(1, 'question', 3), v(2, 'question', 4)])).toEqual([null, null]);
    expect(watch([v(1, 'lobby', 1), v(2, 'lobby', 2)], [0, 5])).toEqual([null, 'join']); // the first join is never held back
  });

  it('holds back a join that is too soon, and still counts the player', () => {
    let s = stepCues(initialCueState, v(1, 'lobby', 1), 0).state;
    s = stepCues(s, v(2, 'lobby', 2), 100).state;
    const held = stepCues(s, v(3, 'lobby', 3), 200, { joinGapMs: 5000 });
    expect(held.cue).toBeNull();
    expect(held.state.seen).toEqual(v(3, 'lobby', 3));
    expect(stepCues(held.state, v(4, 'lobby', 4), 6000, { joinGapMs: 5000 }).cue).toBe('join');
  });

  it('reads a room', () => {
    expect(cueView({ seq: 4, phase: 'reveal', players: [{ id: 'a', name: 'A', connected: true }] })).toEqual({ seq: 4, phase: 'reveal', players: 1 });
  });

  it('gives every cue a word, a few short quiet notes, and none that sweep', () => {
    for (const kind of Object.keys(CUE_LABELS) as CueKind[]) {
      expect(CUE_LABELS[kind].length).toBeGreaterThan(3);
      const notes = CUE_NOTES[kind];
      expect(notes.length).toBeGreaterThan(0);
      expect(Math.max(...notes.map((n) => n.at + n.dur))).toBeLessThan(1);
      for (const n of notes) expect(n.freq).toBeGreaterThan(200);
    }
    expect(MAX_CUE_GAIN).toBeLessThanOrEqual(0.25);
  });
});

// --- A speaker we can read ---------------------------------------------------------------

function fakeAudio() {
  const notes: { freq: number; start: number; stop: number; peak: number; from: number | null }[] = [];
  const audio = {
    currentTime: 10,
    state: 'suspended',
    destination: { speaker: true },
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    createOscillator() {
      const note = { freq: 0, start: 0, stop: 0, peak: 0, from: null as number | null };
      notes.push(note);
      return {
        type: '',
        frequency: {
          set value(f: number) {
            note.freq = f;
          },
        } as { value: number },
        connect: vi.fn(),
        start: (t: number) => void (note.start = t),
        stop: (t: number) => void (note.stop = t),
        _note: note,
      };
    },
    createGain() {
      return {
        gain: {
          value: 0,
          setValueAtTime(level: number) {
            const last = notes[notes.length - 1];
            if (last) last.from = level;
          },
          linearRampToValueAtTime(level: number) {
            const last = notes[notes.length - 1];
            if (last) last.peak = Math.max(last.peak, level);
          },
        },
        connect: vi.fn(),
      };
    },
  };
  return { audio: audio as unknown as CueAudio & typeof audio, notes };
}

describe('createCuePlayer', () => {
  it('makes the audio on first play, wakes it, and plays each note at its time and a quiet level', () => {
    const { audio, notes } = fakeAudio();
    const make = vi.fn(() => audio);
    const player = createCuePlayer(make, 1);
    expect(make).not.toHaveBeenCalled();
    player.play('reveal');
    expect(make).toHaveBeenCalledTimes(1);
    expect(audio.resume).toHaveBeenCalled();
    expect(notes.map((n) => n.freq)).toEqual(CUE_NOTES.reveal.map((n) => n.freq));
    expect(notes.map((n) => n.start)).toEqual(CUE_NOTES.reveal.map((n) => 10 + n.at));
    for (const n of notes) {
      expect(n.peak).toBeCloseTo(MAX_CUE_GAIN);
      expect(n.from).toBe(0); // each note fades in from silence, so it does not click
      expect(n.stop).toBeGreaterThan(n.start);
    }
    player.play('go');
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('scales to the volume, never above the maximum, and is silent at zero or nonsense', () => {
    const half = fakeAudio();
    createCuePlayer(() => half.audio, 0.5).play('join');
    expect(half.notes[0]?.peak).toBeCloseTo(MAX_CUE_GAIN / 2);
    const loud = fakeAudio();
    createCuePlayer(() => loud.audio, 7).play('join');
    expect(loud.notes[0]?.peak).toBeCloseTo(MAX_CUE_GAIN);
    for (const vol of [0, -1, Number.NaN]) {
      const quiet = fakeAudio();
      const make = vi.fn(() => quiet.audio);
      createCuePlayer(make, vol).play('join');
      expect(make).not.toHaveBeenCalled();
    }
  });

  it('does not wake audio that is already running, and closes it', () => {
    const { audio } = fakeAudio();
    audio.state = 'running';
    const player = createCuePlayer(() => audio);
    player.play('go');
    expect(audio.resume).not.toHaveBeenCalled();
    player.close();
    expect(audio.close).toHaveBeenCalled();
    player.close(); // twice is fine
    expect(audio.close).toHaveBeenCalledTimes(1);
  });
});

// --- The hook and the switch ------------------------------------------------------------

type R = { seq: number; phase: CueView['phase']; players: { id: string }[] };
const room = (seq: number, phase: CueView['phase'], n = 2): R => ({ seq, phase, players: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })) });

describe('useSoundCues', () => {
  const setup = (initial: R | null) => {
    const { audio, notes } = fakeAudio();
    const make = vi.fn(() => audio);
    let clock = 0;
    const hook = renderHook(({ r }: { r: R | null }) => useSoundCues(r as never, { makeAudio: make, now: () => (clock += 5000) }), { initialProps: { r: initial } });
    return { ...hook, audio, notes, make };
  };

  it('is off, silent and makes no audio until a person turns it on', () => {
    const h = setup(room(1, 'lobby'));
    expect(h.result.current.enabled).toBe(false);
    h.rerender({ r: room(2, 'question') });
    expect(h.make).not.toHaveBeenCalled();
    expect(h.result.current.caption).toBe('');
  });

  it('turning it on plays a short note, but not for what already happened; the next change is heard and written', () => {
    const h = setup(room(1, 'lobby'));
    h.rerender({ r: room(2, 'countdown') }); // watched while off
    act(() => h.result.current.setEnabled(true));
    expect(h.result.current.enabled).toBe(true);
    expect(h.make).toHaveBeenCalledTimes(1);
    const afterOn = h.notes.length;
    expect(h.result.current.last).toBeNull(); // the confirmation is not a room cue
    h.rerender({ r: room(3, 'question') });
    expect(h.notes.length).toBeGreaterThan(afterOn);
    expect(h.result.current.last).toEqual({ kind: 'go', n: 1 });
    expect(h.result.current.caption).toBe('Question open');
    expect(h.result.current.toggleProps).toMatchObject({ enabled: true, caption: 'Question open' });
    const count = h.notes.length;
    h.rerender({ r: room(3, 'question') }); // the same state again
    h.rerender({ r: room(2, 'countdown') }); // an old one
    expect(h.notes.length).toBe(count);
  });

  it('plays nothing for a screen that loads into a room, even after it is on', () => {
    const h = setup(null);
    act(() => h.result.current.setEnabled(true));
    const n = h.notes.length;
    h.rerender({ r: room(77, 'reveal') });
    expect(h.notes.length).toBe(n);
    expect(h.result.current.last).toBeNull();
  });

  it('turning it off closes the audio and silences later cues', () => {
    const h = setup(room(1, 'lobby'));
    act(() => h.result.current.setEnabled(true));
    act(() => h.result.current.setEnabled(false));
    expect(h.audio.close).toHaveBeenCalled();
    const n = h.notes.length;
    h.rerender({ r: room(2, 'question') });
    expect(h.notes.length).toBe(n);
    h.unmount();
  });

  it('closes its audio when the screen goes away', () => {
    const h = setup(room(1, 'lobby'));
    act(() => h.result.current.setEnabled(true));
    h.unmount();
    expect(h.audio.close).toHaveBeenCalled();
  });

  it('stays off, without throwing, where the browser has no audio', () => {
    const throwing = () => {
      throw new Error('no audio');
    };
    const h = renderHook(() => useSoundCues(room(1, 'lobby') as never, { makeAudio: throwing }));
    act(() => h.result.current.setEnabled(true));
    expect(h.result.current.enabled).toBe(false);
    const bare = renderHook(() => useSoundCues(null));
    expect(bare.result.current.supported).toBe(false);
    act(() => bare.result.current.setEnabled(true));
    expect(bare.result.current.enabled).toBe(false);
  });

  it('uses the browser audio when there is one', () => {
    const { audio } = fakeAudio();
    const ctor = vi.fn(() => audio);
    vi.stubGlobal('AudioContext', ctor);
    const h = renderHook(() => useSoundCues(room(1, 'lobby') as never));
    expect(h.result.current.supported).toBe(true);
    act(() => h.result.current.setEnabled(true));
    expect(ctor).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('SoundCueToggle', () => {
  it('is a named switch, off by default, that asks to turn on and off', () => {
    const onChange = vi.fn();
    const { container } = render(<SoundCueToggle enabled={false} onChange={onChange} />);
    expect(container.querySelector('[data-slot="sound-cue-toggle"]')?.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    const sw = screen.getByRole('switch', { name: 'Sound cues' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(container.querySelector('[data-slot="sound-cue-toggle"]')?.getAttribute('data-state')).toBe('off');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('writes the last cue as words in a polite live region, only while on', () => {
    const { container, rerender } = render(<SoundCueToggle enabled onChange={() => undefined} caption="Answer revealed" />);
    const caption = container.querySelector('[data-slot="sound-cue-caption"]') as HTMLElement;
    expect(caption.textContent).toBe('Answer revealed');
    expect(caption.getAttribute('aria-live')).toBe('polite');
    rerender(<SoundCueToggle enabled={false} onChange={() => undefined} caption="Answer revealed" />);
    expect(caption.textContent).toBe('');
  });

  it('is disabled and says so where there is no sound', () => {
    const onChange = vi.fn();
    const { container } = render(<SoundCueToggle enabled supported={false} onChange={onChange} labels={{ name: 'Sounds' }} />);
    expect((screen.getByRole('switch', { name: 'Sounds' }) as HTMLElement).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('switch', { name: 'Sounds' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[data-slot="sound-cue-toggle"]')?.getAttribute('data-state')).toBe('unsupported');
    expect(container.querySelector('[data-slot="sound-cue-caption"]')?.textContent).toBe('This browser cannot play sound.');
  });
});
