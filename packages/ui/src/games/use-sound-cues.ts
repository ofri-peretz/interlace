'use client';

/**
 * @interlace/ui — useSoundCues
 *
 * Plays a short cue when a live room moves on, for a screen in a hall. Off until a person turns it
 * on (a browser keeps a page silent until a tap, and a room should not start making noise by
 * itself); once on, it plays only for changes this screen watched happen (`stepCues`), never for the
 * state it joined or reloaded into. `caption` is the plain word for the last cue, for a person who
 * cannot hear it, and `volume` is 0 to 1 of a deliberately quiet maximum.
 *
 * ```tsx
 * const cues = useSoundCues(api.room);
 * <SoundCueToggle {...cues.toggleProps} />
 * ```
 */

import * as React from 'react';

import { CUE_LABELS, createCuePlayer, cueView, initialCueState, stepCues, type CueAudio, type CueKind, type CuePlayer } from './sound-cues-model.js';
import type { RoomState } from './room-model.js';

export interface UseSoundCuesOptions {
  /** Make the audio context. @default the browser's `AudioContext`. */
  makeAudio?: () => CueAudio;
  /** 0 to 1. @default 0.6 */
  volume?: number;
  /** The shortest gap between two join cues, in ms. @default 1500 */
  joinGapMs?: number;
  /** This screen's clock, in ms. @default Date.now */
  now?: () => number;
}

const browserAudio = (): CueAudio => {
  const Ctor = (globalThis as { AudioContext?: new () => CueAudio }).AudioContext;
  if (!Ctor) throw new Error('No audio in this browser');
  return new Ctor();
};

export function useSoundCues(room: Pick<RoomState, 'seq' | 'phase' | 'players'> | null, options: UseSoundCuesOptions = {}) {
  const { makeAudio = browserAudio, volume = 0.6, joinGapMs, now = Date.now } = options;
  const [enabled, setEnabledState] = React.useState(false);
  const [last, setLast] = React.useState<{ kind: CueKind; n: number } | null>(null);
  const watching = React.useRef(initialCueState);
  const player = React.useRef<CuePlayer | null>(null);
  const live = React.useRef({ makeAudio, volume, now, joinGapMs });
  live.current = { makeAudio, volume, now, joinGapMs };

  const supported = typeof (globalThis as { AudioContext?: unknown }).AudioContext === 'function' || options.makeAudio !== undefined;

  // Watch every state, on or off, so turning sound on never plays for what already happened.
  React.useEffect(() => {
    if (!room) return;
    const step = stepCues(watching.current, cueView(room), live.current.now(), { joinGapMs: live.current.joinGapMs });
    watching.current = step.state;
    if (!step.cue || !player.current) return;
    const kind = step.cue;
    player.current.play(kind);
    setLast((l) => ({ kind, n: (l?.n ?? 0) + 1 }));
  }, [room?.seq, room?.phase, room?.players.length]);

  React.useEffect(() => () => player.current?.close(), []);

  const setEnabled = React.useCallback((on: boolean) => {
    if (on) {
      if (!player.current) {
        try {
          player.current = createCuePlayer(() => live.current.makeAudio(), live.current.volume);
          // Make the context now, from the tap that turned sound on; the note tells a person it is on.
          player.current.play('join');
        } catch {
          player.current = null;
          return;
        }
      }
    } else {
      player.current?.close();
      player.current = null;
    }
    setEnabledState(on);
  }, []);

  return {
    enabled,
    supported,
    setEnabled,
    /** The last cue that played, with a count so the same cue twice is two changes. */
    last,
    caption: last ? CUE_LABELS[last.kind] : '',
    toggleProps: { enabled, supported, onChange: setEnabled, caption: last ? CUE_LABELS[last.kind] : '' },
  };
}
