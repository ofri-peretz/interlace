'use client';

/**
 * @interlace/ui — EdgeGlow
 *
 * A light that runs around the edge of its parent: the plan you recommend,
 * the card that is live right now. Drop it inside a positioned element:
 *
 *   <Card className="relative">
 *     <EdgeGlow />
 *     …
 *   </Card>
 *
 * The parent keeps its own border. EdgeGlow draws a thin ring just inside it,
 * following the parent's corner radius, and a bright arc travels around that
 * ring.
 *
 * ## How it is drawn
 *
 * A ring is cut out of a full-size layer with two mask layers (`content-box`
 * excluded from `border-box`), so only a `width`-wide band at the edge shows.
 * Inside it, a square much larger than the parent carries a conic gradient
 * (one bright arc, the rest transparent) and turns. Where the arc crosses the
 * ring, the edge lights up. Turning a square is a plain `transform`, the
 * cheapest thing a browser can animate.
 *
 * ## Out of the way
 *
 * The root is `aria-hidden` and `pointer-events-none`, and a caller cannot
 * turn either off. Colours default to `--primary` and `--chart-2`; the arc is
 * decoration inside a container that draws its own boundary, so a 3:1 chart
 * token is admissible here where it would not be for text.
 *
 * ## Motion
 *
 * Web Animations API, paused off screen. Under `prefers-reduced-motion:
 * reduce` the arc holds still at the top-left corner, so the highlight still
 * marks the card.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `span` props (minus aria-hidden)                      |
 * | R6   | data-slot per part      | edge-glow / -arc                                      |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R19  | Tokens only             | `--primary`, `--chart-2` defaults                     |
 * | R25  | Client component        | the turn runs in the browser                          |
 * | R26  | A11y                    | hidden, inert to the pointer                          |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export interface EdgeGlowProps extends Omit<React.ComponentPropsWithoutRef<'span'>, 'aria-hidden' | 'children'> {
  /** Leading colour of the arc. @default 'var(--primary)' */
  from?: string;
  /** Trailing colour of the arc. @default 'var(--chart-2)' */
  to?: string;
  /** Width of the ring, in pixels. @default 1.5 */
  width?: number;
  /** Share of the edge the arc covers, 0 to 1. @default 0.2 */
  length?: number;
  /** Seconds for one lap. @default 8 */
  duration?: number;
  /** Lap direction. @default 'clockwise' */
  direction?: 'clockwise' | 'counterclockwise';
}

export function EdgeGlow({
  from = 'var(--primary)',
  to = 'var(--chart-2)',
  width = 1.5,
  length = 0.2,
  duration = 8,
  direction = 'clockwise',
  className,
  style,
  ...props
}: EdgeGlowProps) {
  const arcRef = React.useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const arc = Math.min(Math.max(length, 0.02), 1) * 360;

  React.useEffect(() => {
    const el = arcRef.current;
    if (!el || reduced || typeof el.animate !== 'function') return;
    const turn = direction === 'clockwise' ? 360 : -360;
    const animation = el.animate(
      [
        { transform: 'translate(-50%, -50%) rotate(0deg)' },
        { transform: `translate(-50%, -50%) rotate(${turn}deg)` },
      ],
      { duration: duration * 1000, iterations: Infinity },
    );
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            if (entry?.isIntersecting) animation.play();
            else animation.pause();
          });
    io?.observe(el.parentElement ?? el);
    return () => {
      io?.disconnect();
      animation.cancel();
    };
  }, [reduced, duration, direction]);

  return (
    <span
      data-slot="edge-glow"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]', className)}
      style={{
        padding: `${width}px`,
        mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        ...style,
      }}
      {...props}
      aria-hidden
    >
      <span
        ref={arcRef}
        data-slot="edge-glow-arc"
        className="absolute top-1/2 left-1/2 aspect-square min-h-[300%] w-[300%]"
        style={{
          transform: 'translate(-50%, -50%) rotate(0deg)',
          background: `conic-gradient(from 270deg, transparent 0deg, ${to} ${arc * 0.4}deg, ${from} ${arc}deg, transparent ${arc}deg)`,
        }}
      />
    </span>
  );
}
