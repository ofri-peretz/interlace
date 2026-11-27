'use client';

/**
 * @interlace/ui — RoomClock
 *
 * A countdown to a host timestamp, in minutes and seconds ("7:42"), for the timers that run for
 * minutes: a breakout, a round of pair talk. (`TimerRing` counts the seconds of a quiz round; a
 * ring that says 600 is a poor way to say ten minutes.) The deadline is a timestamp from the
 * host's clock, so a phone that opens late, or reloads, shows the same time left as every other
 * screen; pass `useRoom`'s `now` so a phone with the wrong clock agrees too.
 *
 * ## Anatomy
 *
 *   RoomClock                     (div role="timer" — data-slot="room-clock", data-state=idle|running|low|done)
 *     ├─ span                     (data-slot="room-clock-value": "7:42", or the "time is up" words)
 *     └─ span aria-live           (data-slot="room-clock-announce": a minute left, ten seconds, time up)
 *
 * ## Screen readers
 *
 * The number is not read every second (a `timer` role is silent by default). The clock speaks when
 * it crosses a minute left, ten seconds left and zero, and only when it sees the crossing: one
 * that opens already past a mark says nothing, so a phone that joins or reloads is not read a
 * warning it missed. Time up is also written out, so it never depends on colour.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                        |
 * | R6   | data-slot per part        | room-clock / -value / -announce                      |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans       | `size`                                               |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | role="timer", labelled; sparse announcements          |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { formatClock } from './agenda-model.js';
import { useSecondsLeft } from './live-room.js';

export const MIN_VIEWPORT = 320 as const;

export interface RoomClockLabels {
  /** Names the timer. @default 'Time left' */
  name?: string;
  /** Written in place of the number at 0. @default "Time's up" */
  done?: string;
  /** Spoken at the marks. @default (seconds) => seconds >= 60 ? `${seconds / 60} minute left` : `${seconds} seconds left` */
  remaining?: (seconds: number) => string;
  /** Shown when there is no timer. @default 'No timer' */
  idle?: string;
}

type RoomClockProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** When time is up, in ms (host clock). null: no timer. */
  endsAt: number | null;
  /** Your clock, corrected to the host's (`useRoom`'s `now`). @default Date.now */
  now?: () => number;
  /** Called once when it reaches 0 (while this clock is watching). */
  onExpire?: () => void;
  /** @default 'default' */
  size?: 'default' | 'stage';
  labels?: RoomClockLabels;
};

const SIZE = { default: 'text-2xl', stage: 'text-6xl' } as const;
/** Seconds left at which the clock speaks: a minute, then ten seconds. */
const MARKS = [60, 10] as const;
const REMAINING = (s: number) => (s >= 60 ? `${s / 60} minute left` : `${s} seconds left`);

function RoomClock({ endsAt, now = Date.now, onExpire, size = 'default', labels, className, ...props }: RoomClockProps) {
  const left = useSecondsLeft(endsAt, now);
  const state = left === null ? 'idle' : left === 0 ? 'done' : left <= 10 ? 'low' : 'running';
  const last = React.useRef<{ at: number | null; left: number | null }>({ at: null, left: null });
  const [announce, setAnnounce] = React.useState('');
  const latest = React.useRef({ onExpire, labels });
  latest.current = { onExpire, labels };

  // Speak a mark when the clock crosses it, and say when it ends; never for a mark already behind it.
  React.useEffect(() => {
    const before = last.current;
    last.current = { at: endsAt, left };
    if (left === null || before.at !== endsAt || before.left === null || before.left === left) return;
    const words = latest.current.labels;
    if (left === 0) {
      setAnnounce(words?.done ?? "Time's up");
      latest.current.onExpire?.();
      return;
    }
    for (const mark of MARKS) {
      if (before.left > mark && left <= mark) {
        setAnnounce((words?.remaining ?? REMAINING)(mark));
        return;
      }
    }
  }, [endsAt, left]);

  return (
    <div
      role="timer"
      aria-label={labels?.name ?? 'Time left'}
      data-slot="room-clock"
      data-state={state}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'inline-flex items-center font-semibold tabular-nums',
        SIZE[size],
        state === 'low' || state === 'done' ? 'text-destructive' : 'text-foreground',
        className,
      )}
      {...props}
    >
      <span data-slot="room-clock-value">
        {left === null ? (labels?.idle ?? 'No timer') : left === 0 ? (labels?.done ?? "Time's up") : formatClock(left * 1000)}
      </span>
      <span data-slot="room-clock-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
RoomClock.displayName = 'RoomClock';

export { RoomClock };
export type { RoomClockProps };
