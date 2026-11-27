/**
 * @interlace/ui — games/sound-cues-model
 *
 * Short sounds for a room's big moments: someone joins, the countdown starts, the question opens,
 * the answer is revealed, the podium. Which cue a screen plays is decided here, from the room
 * states it sees one after another, and it plays one only for a change it watched happen:
 *
 * - The first state a screen sees (a late joiner, a reconnect, a host that refreshed) plays nothing.
 * - A state that is not newer than the last one seen (a repeat, or one that arrives late) plays nothing.
 * - If several changes arrive at once, only the last one is heard, once.
 * - People joining are heard at most once in `joinGapMs`, so a hall filling up is not a drum roll.
 *
 * Every cue has a plain word (`CUE_LABELS`) so a person who cannot hear it still sees and is told it
 * happened; the notes are data (`CUE_NOTES`), so a player can be tested without a speaker.
 */

import type { RoomPhase, RoomState } from './room-model.js';

export type CueKind = 'join' | 'countdown' | 'go' | 'reveal' | 'podium';

export const CUE_LABELS: Readonly<Record<CueKind, string>> = {
  join: 'Someone joined',
  countdown: 'Get ready',
  go: 'Question open',
  reveal: 'Answer revealed',
  podium: 'Podium',
};

/** What a screen needs of a room to decide on a cue. */
export interface CueView {
  seq: number;
  phase: RoomPhase;
  players: number;
}

export const cueView = (room: Pick<RoomState, 'seq' | 'phase' | 'players'>): CueView => ({
  seq: room.seq,
  phase: room.phase,
  players: room.players.length,
});

export interface CueState {
  /** The last state seen, or null before any. */
  seen: CueView | null;
  /** When a join cue last played, in ms. */
  lastJoinAt: number;
}

export const initialCueState: CueState = { seen: null, lastJoinAt: -Infinity };

export interface CueOptions {
  /** The shortest gap between two join cues, in ms. @default 1500 */
  joinGapMs?: number;
}

const PHASE_CUE: Partial<Record<RoomPhase, CueKind>> = { countdown: 'countdown', question: 'go', reveal: 'reveal', podium: 'podium' };

/** The next state of watching, and the cue to play for it (null for none). `now` is this screen's clock, in ms. */
export function stepCues(state: CueState, view: CueView, now: number, options: CueOptions = {}): { state: CueState; cue: CueKind | null } {
  const { joinGapMs = 1500 } = options;
  const prev = state.seen;
  if (prev === null) return { state: { ...state, seen: view }, cue: null };
  if (view.seq <= prev.seq) return { state, cue: null };
  const seen = { ...state, seen: view };
  if (view.phase !== prev.phase) return { state: seen, cue: PHASE_CUE[view.phase] ?? null };
  if (view.phase === 'lobby' && view.players > prev.players && now - state.lastJoinAt >= joinGapMs) {
    return { state: { seen: view, lastJoinAt: now }, cue: 'join' };
  }
  return { state: seen, cue: null };
}

export interface CueNote {
  /** Hertz. */
  freq: number;
  /** When it starts, in seconds from the cue's start. */
  at: number;
  /** How long it lasts, in seconds. */
  dur: number;
}

/** Each cue as a few notes, all short, none loud, none a sweep. */
export const CUE_NOTES: Readonly<Record<CueKind, readonly CueNote[]>> = {
  join: [{ freq: 660, at: 0, dur: 0.1 }],
  countdown: [
    { freq: 440, at: 0, dur: 0.12 },
    { freq: 440, at: 0.25, dur: 0.12 },
    { freq: 440, at: 0.5, dur: 0.12 },
  ],
  go: [
    { freq: 523, at: 0, dur: 0.1 },
    { freq: 784, at: 0.12, dur: 0.18 },
  ],
  reveal: [
    { freq: 392, at: 0, dur: 0.12 },
    { freq: 523, at: 0.14, dur: 0.12 },
    { freq: 659, at: 0.28, dur: 0.2 },
  ],
  podium: [
    { freq: 523, at: 0, dur: 0.14 },
    { freq: 659, at: 0.16, dur: 0.14 },
    { freq: 784, at: 0.32, dur: 0.14 },
    { freq: 1047, at: 0.48, dur: 0.3 },
  ],
};

/** The loudest a cue gets, as a gain (0 to 1). Quiet by design: a cue is a nudge, not an alarm. */
export const MAX_CUE_GAIN = 0.2;

/** The slice of the browser's audio context a player needs, so a test can stand in for a speaker. */
export interface CueAudio {
  currentTime: number;
  state: string;
  resume(): Promise<void> | void;
  close(): Promise<void> | void;
  destination: unknown;
  createOscillator(): {
    type: string;
    frequency: { value: number };
    connect(n: unknown): void;
    start(at: number): void;
    stop(at: number): void;
  };
  createGain(): {
    gain: { value: number; setValueAtTime(v: number, t: number): void; linearRampToValueAtTime(v: number, t: number): void };
    connect(n: unknown): void;
  };
}

export interface CuePlayer {
  play(kind: CueKind): void;
  close(): void;
}

/**
 * A player that plays a cue on `audio` at `volume` (0 to 1, of `MAX_CUE_GAIN`). It makes the context
 * on first use, which the caller does from a tap, since a browser keeps a page silent until then.
 */
export function createCuePlayer(makeAudio: () => CueAudio, volume = 1): CuePlayer {
  let audio: CueAudio | null = null;
  const level = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0)) * MAX_CUE_GAIN;
  return {
    play(kind) {
      if (level === 0) return;
      audio ??= makeAudio();
      if (audio.state === 'suspended') void audio.resume();
      const t0 = audio.currentTime;
      for (const note of CUE_NOTES[kind]) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        // A short fade in and out, so a note does not click.
        gain.gain.setValueAtTime(0, t0 + note.at);
        gain.gain.linearRampToValueAtTime(level, t0 + note.at + 0.01);
        gain.gain.linearRampToValueAtTime(0, t0 + note.at + note.dur);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(t0 + note.at);
        osc.stop(t0 + note.at + note.dur + 0.02);
      }
    },
    close() {
      const a = audio;
      audio = null;
      void a?.close();
    },
  };
}
