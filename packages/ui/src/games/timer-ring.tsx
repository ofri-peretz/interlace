'use client';

/**
 * @interlace/ui — TimerRing
 *
 * A countdown drawn as a ring that empties, with the seconds left in the
 * middle. It counts to a deadline (a timestamp), not from a start, so a
 * page that reloads, or several players in one room, all see the same
 * clock.
 *
 * ## Anatomy
 *
 *   TimerRing                     (div role="timer" — data-slot="timer-ring", data-state=running|low|done|idle)
 *     ├─ svg aria-hidden          (data-slot="timer-ring-track" + data-slot="timer-ring-arc")
 *     ├─ span                     (data-slot="timer-ring-value": whole seconds left)
 *     └─ span sr-only aria-live   (data-slot="timer-ring-announce": "10 seconds left", "5 seconds left")
 *
 * ## Time
 *
 * `deadline` is a `Date.now()`-style timestamp; pass `now` when it comes
 * from another device's clock. null shows a full, idle ring
 * (before the round starts, or once the clock is stopped). The number is
 * rounded up, so it reads 1 until the very end, and `onExpire` fires once
 * when it reaches 0. Ticks are timers aligned to the next whole second, not
 * an animation loop.
 *
 * A screen reader is not read every second: the ring announces at 10 and 5
 * seconds left (when the round is longer than that) and when time is up.
 *
 * ## Motion
 *
 * The arc empties smoothly in one linear animation from now to the deadline.
 * Under reduced motion it steps down once a second with the number instead.
 * The last `lowAt` seconds turn the arc and number to the destructive tone,
 * and the number says the same thing, so colour is never the only signal.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                        |
 * | R6   | data-slot per part        | timer-ring / -track / -arc / -value / -announce      |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans       | `size`                                               |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | role="timer", labelled; sparse announcements          |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export const MIN_VIEWPORT = 320 as const;

interface TimerRingLabels {
  /** Names the timer. @default 'Time left' */
  name?: string;
  /** Spoken at the warning points. @default (s) => `${s} seconds left` */
  remaining?: (seconds: number) => string;
  /** Spoken at 0. @default "Time's up" */
  done?: string;
}

type TimerRingProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** The whole round, in seconds: what a full ring means. */
  seconds: number;
  /** When time runs out, as a timestamp in ms. null: idle, full ring. */
  deadline: number | null;
  /** Called once when the clock reaches 0. */
  onExpire?: () => void;
  /** Seconds left at which the ring turns to the warning tone. @default 5 */
  lowAt?: number;
  /** @default 'default' */
  size?: 'sm' | 'default' | 'lg';
  labels?: TimerRingLabels;
  /** Your clock, corrected to the one that set `deadline` (e.g. `useRoom`'s `now`). @default Date.now */
  now?: () => number;
};

const SIZE = { sm: 'size-10 text-sm', default: 'size-14 text-lg', lg: 'size-20 text-2xl' } as const;
const R = 20;
const C = 2 * Math.PI * R;

function TimerRing({
  seconds,
  deadline,
  onExpire,
  lowAt = 5,
  size = 'default',
  labels,
  now: clock = Date.now,
  className,
  ...props
}: TimerRingProps) {
  const reduced = useReducedMotion();
  const [now, setNow] = React.useState<number | null>(null);
  const [announce, setAnnounce] = React.useState('');
  const arcRef = React.useRef<SVGCircleElement>(null);
  const expired = React.useRef(false);
  const said = React.useRef(new Set<number>());
  const onExpireRef = React.useRef(onExpire);
  onExpireRef.current = onExpire;
  const clockRef = React.useRef(clock);
  clockRef.current = clock;

  const total = Math.max(1, seconds) * 1000;
  const leftMs = deadline === null || now === null ? total : Math.max(0, deadline - now);
  const left = Math.ceil(leftMs / 1000);
  const state = deadline === null ? 'idle' : leftMs <= 0 ? 'done' : left <= lowAt ? 'low' : 'running';
  const words = {
    name: labels?.name ?? 'Time left',
    remaining: labels?.remaining ?? ((s: number) => `${s} seconds left`),
    done: labels?.done ?? "Time's up",
  };

  // Tick on whole seconds until the deadline.
  React.useEffect(() => {
    expired.current = false;
    said.current = new Set();
    setAnnounce('');
    if (deadline === null) {
      setNow(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = clockRef.current();
      setNow(t);
      const ms = deadline - t;
      if (ms <= 0) return;
      timer = setTimeout(tick, Math.min(ms, (ms % 1000 || 1000) + 5));
    };
    tick();
    return () => clearTimeout(timer);
  }, [deadline]);

  // Announce sparingly, and expire once.
  React.useEffect(() => {
    if (deadline === null || now === null) return;
    if (leftMs <= 0) {
      if (!expired.current) {
        expired.current = true;
        setAnnounce(words.done);
        onExpireRef.current?.();
      }
      return;
    }
    for (const mark of [10, 5]) {
      if (left === mark && seconds > mark && !said.current.has(mark)) {
        said.current.add(mark);
        setAnnounce(words.remaining(mark));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, deadline]);

  // One smooth sweep from now to the deadline.
  React.useEffect(() => {
    const arc = arcRef.current;
    if (!arc || deadline === null || reduced || typeof arc.animate !== 'function') return;
    const ms = Math.max(0, deadline - clockRef.current());
    const from = C * (1 - ms / total);
    const anim = arc.animate([{ strokeDashoffset: `${from}` }, { strokeDashoffset: `${C}` }], {
      duration: ms,
      easing: 'linear',
      fill: 'forwards',
    });
    return () => anim.cancel();
  }, [deadline, reduced, total]);

  const offset = C * (1 - leftMs / total);

  return (
    <div
      role="timer"
      aria-label={words.name}
      data-slot="timer-ring"
      data-state={state}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'relative inline-grid shrink-0 place-items-center font-semibold tabular-nums',
        SIZE[size],
        state === 'low' || state === 'done' ? 'text-destructive' : 'text-foreground',
        className,
      )}
      {...props}
    >
      <svg aria-hidden viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90">
        <circle data-slot="timer-ring-track" cx="24" cy="24" r={R} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle
          ref={arcRef}
          data-slot="timer-ring-arc"
          cx="24"
          cy="24"
          r={R}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          className={cn(
            'motion-safe:transition-[stroke] motion-safe:duration-(--duration-base)',
            state === 'low' || state === 'done' ? 'stroke-destructive' : 'stroke-primary',
          )}
        />
      </svg>
      <span data-slot="timer-ring-value" className="relative leading-none">
        {left}
      </span>
      <span data-slot="timer-ring-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
TimerRing.displayName = 'TimerRing';

export { TimerRing };
export type { TimerRingProps, TimerRingLabels };
