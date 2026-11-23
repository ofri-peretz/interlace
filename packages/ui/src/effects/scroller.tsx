'use client';

/**
 * @interlace/ui — Scroller
 *
 * A row (or column) of items that glides past on a loop: logos of the
 * organisations you work with, short quotes, headlines. The items are real
 * content, so the component treats them that way first and as motion second.
 *
 * ## Content first
 *
 * - The items render once, as a list, on the server. A second copy is added
 *   for the seamless loop, and that copy is `aria-hidden` and `inert`, so a
 *   screen reader hears each item once and Tab visits each link once.
 * - A visible Pause button sits next to the strip, as WCAG 2.2.2 asks for
 *   anything that moves for more than five seconds. Hovering the strip or
 *   moving focus into it also pauses it.
 * - Under `prefers-reduced-motion: reduce` nothing moves: the clone is not
 *   rendered, the button is not shown (it would control nothing), and the
 *   strip becomes an ordinary scrollable row, so every item stays reachable.
 *
 * ## Motion
 *
 * One Web Animations API animation on the track, from 0 to minus the width
 * of one copy. No keyframes to add to a stylesheet. The animation pauses
 * when the strip leaves the viewport or the tab is hidden.
 *
 * ## Composition
 *
 *   Scroller                           (section-like div — data-slot="scroller")
 *     ├─ viewport                      (overflow + edge fade)
 *     │   └─ track                     (animated)
 *     │       ├─ ul                    (the items, each child in an li)
 *     │       └─ ul clone              (aria-hidden, inert; motion only)
 *     └─ pause button                  (data-slot="scroller-control")
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props                                          |
 * | R6   | data-slot per part      | scroller / -track / -list / -item / -control          |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R8   | Enums, not booleans     | `direction`, `gap`, `edges`                           |
 * | R19  | Tokens only             | control uses `--background`, `--border`, `--ring`     |
 * | R25  | Client component        | animation and pause state                             |
 * | R26  | A11y                    | list semantics, one copy announced, visible pause     |
 */

import { PauseIcon, PlayIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

const GAP = { sm: 'gap-4', md: 'gap-8', lg: 'gap-16' } as const;
const GAP_PAD = {
  sm: { x: 'pr-4', y: 'pb-4' },
  md: { x: 'pr-8', y: 'pb-8' },
  lg: { x: 'pr-16', y: 'pb-16' },
} as const;

const FADE = {
  x: '[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]',
  y: '[mask-image:linear-gradient(to_bottom,transparent,black_8%,black_92%,transparent)]',
} as const;

export interface ScrollerProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  /** The items. Each child becomes one list item. */
  children: React.ReactNode;
  /** Which way the items travel. @default 'left' */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** Seconds for one full copy to pass. @default 40 */
  duration?: number;
  /** Space between items. @default 'md' */
  gap?: keyof typeof GAP;
  /** Fade the items out at the edges, or cut them off square. @default 'fade' */
  edges?: 'fade' | 'none';
  /** Pause while the pointer is over the strip. @default true */
  pauseOnHover?: boolean;
  /** Accessible name of the strip, read before the items. */
  label?: string;
  /** Text of the pause button. @default 'Pause' */
  pauseLabel?: string;
  /** Text of the play button. @default 'Play' */
  playLabel?: string;
}

export function Scroller({
  children,
  direction = 'left',
  duration = 40,
  gap = 'md',
  edges = 'fade',
  pauseOnHover = true,
  label,
  pauseLabel = 'Pause',
  playLabel = 'Play',
  className,
  ...props
}: ScrollerProps) {
  const reduced = useReducedMotion();
  const axis = direction === 'up' || direction === 'down' ? 'y' : 'x';
  const trackRef = React.useRef<HTMLDivElement>(null);
  const firstRef = React.useRef<HTMLUListElement>(null);
  const [paused, setPaused] = React.useState(false);
  const [held, setHeld] = React.useState(false);

  const items = React.Children.toArray(children);
  const moving = !reduced;

  const animationRef = React.useRef<Animation | null>(null);
  const stateRef = React.useRef({ paused: false, held: false });

  /** Play or pause the loop from the pause button, hover/focus and visibility. Reads refs only, so it is stable. */
  const sync = React.useCallback(() => {
    const animation = animationRef.current;
    const track = trackRef.current;
    if (!animation || !track) return;
    const state = stateRef.current;
    if (state.paused || state.held || track.dataset.offscreen === 'true') animation.pause();
    else animation.play();
  }, []);

  React.useEffect(() => {
    const track = trackRef.current;
    const first = firstRef.current;
    if (!moving || !track || !first || typeof track.animate !== 'function') return;

    let animation: Animation | null = null;
    const start = () => {
      animation?.cancel();
      const size = axis === 'x' ? first.offsetWidth : first.offsetHeight;
      const prop = axis === 'x' ? 'translateX' : 'translateY';
      const forward = direction === 'left' || direction === 'up';
      const frames = [
        { transform: `${prop}(${forward ? 0 : -size}px)` },
        { transform: `${prop}(${forward ? -size : 0}px)` },
      ];
      animation = track.animate(frames, { duration: duration * 1000, iterations: Infinity });
      animationRef.current = animation;
      sync();
    };
    start();

    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(start);
    ro?.observe(first);
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            track.dataset.offscreen = entry?.isIntersecting ? 'false' : 'true';
            sync();
          });
    io?.observe(track);

    return () => {
      ro?.disconnect();
      io?.disconnect();
      animation?.cancel();
      animationRef.current = null;
    };
  }, [moving, axis, direction, duration, items.length, sync]);

  React.useEffect(() => {
    stateRef.current = { paused, held };
    sync();
  }, [paused, held, sync]);

  const vertical = axis === 'y';
  const list = (clone: boolean) => (
    <ul
      ref={clone ? undefined : firstRef}
      data-slot="scroller-list"
      aria-hidden={clone || undefined}
      inert={clone || undefined}
      className={cn(
        'flex shrink-0 list-none p-0',
        vertical ? 'flex-col' : 'flex-row items-center',
        GAP[gap],
        GAP_PAD[gap][axis],
      )}
    >
      {items.map((item, i) => (
        <li key={React.isValidElement(item) && item.key !== null ? item.key : i} data-slot="scroller-item" className="shrink-0">
          {item}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      role={label ? 'region' : undefined}
      aria-label={label}
      data-slot="scroller"
      data-direction={direction}
      className={cn('relative flex items-start gap-2', vertical ? 'flex-row' : 'flex-col sm:flex-row sm:items-center', className)}
      {...props}
    >
      <div
        data-slot="scroller-viewport"
        className={cn(
          'min-w-0 flex-1',
          moving ? 'overflow-hidden' : vertical ? 'overflow-y-auto' : 'overflow-x-auto',
          edges === 'fade' && FADE[axis],
        )}
        onPointerEnter={pauseOnHover ? () => setHeld(true) : undefined}
        onPointerLeave={pauseOnHover ? () => setHeld(false) : undefined}
        onFocus={() => setHeld(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
        }}
      >
        <div
          ref={trackRef}
          data-slot="scroller-track"
          className={cn('flex w-max', vertical ? 'flex-col' : 'flex-row')}
        >
          {list(false)}
          {moving ? list(true) : null}
        </div>
      </div>
      {moving ? (
        <button
          type="button"
          data-slot="scroller-control"
          aria-pressed={paused}
          aria-label={paused ? playLabel : pauseLabel}
          onClick={() => setPaused((p) => !p)}
          className="border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium focus-visible:ring-[3px] focus-visible:outline-hidden"
        >
          {paused ? <PlayIcon aria-hidden className="size-4" /> : <PauseIcon aria-hidden className="size-4" />}
          {paused ? playLabel : pauseLabel}
        </button>
      ) : null}
    </div>
  );
}
