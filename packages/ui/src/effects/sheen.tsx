'use client';

/**
 * @interlace/ui — Sheen
 *
 * A soft band of light that crosses its parent every few seconds. Drop it
 * inside the one button or card a page most wants pressed:
 *
 *   <Button variant="default">
 *     <Sheen />
 *     Get started
 *   </Button>
 *
 * It is a layer, not a button, so it works on `Button`, a link styled with
 * `buttonVariants`, or anything else, and the control keeps its own variant,
 * size, focus ring, and name. `Button` is already `relative isolate`, which
 * is all Sheen needs from its parent; it clips itself to the parent's corners.
 *
 * ## Out of the way
 *
 * `aria-hidden`, `pointer-events-none`, and painted at `z-backdrop` inside
 * the parent's own stacking context: above the parent's background, under
 * its label. So it never dims the text, never takes a click and never
 * changes the accessible name. The default
 * colour is `--primary-foreground` at low strength, so on a primary button it
 * reads as light passing over the surface; pass `color` for other surfaces.
 *
 * ## Motion
 *
 * One Web Animations API sweep, then a rest of `rest` seconds, repeated. It
 * pauses off screen. Under `prefers-reduced-motion: reduce` it renders
 * nothing: a still band would look like a smudge.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `span` props (minus aria-hidden)                      |
 * | R6   | data-slot per part      | sheen / -band                                         |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R19  | Tokens only             | `--primary-foreground` default                        |
 * | R25  | Client component        | the sweep runs in the browser                         |
 * | R26  | A11y                    | hidden, inert to the pointer, under the label         |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export interface SheenProps extends Omit<React.ComponentPropsWithoutRef<'span'>, 'aria-hidden' | 'children'> {
  /** Colour of the band. @default 'var(--primary-foreground)' */
  color?: string;
  /** How bright the band is, 0 to 1. @default 0.35 */
  strength?: number;
  /** Seconds for the band to cross. @default 1.2 */
  duration?: number;
  /** Seconds between crossings. @default 3 */
  rest?: number;
}

export function Sheen({
  color = 'var(--primary-foreground)',
  strength = 0.35,
  duration = 1.2,
  rest = 3,
  className,
  style,
  ...props
}: SheenProps) {
  const bandRef = React.useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    const band = bandRef.current;
    if (!band || reduced || typeof band.animate !== 'function') return;
    const total = (duration + rest) * 1000;
    const crossing = duration * 1000;
    const animation = band.animate(
      [
        { transform: 'translateX(-100%) skewX(-20deg)', offset: 0 },
        { transform: 'translateX(250%) skewX(-20deg)', offset: crossing / total },
        { transform: 'translateX(250%) skewX(-20deg)', offset: 1 },
      ],
      { duration: total, iterations: Infinity, easing: 'ease-in-out' },
    );
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            if (entry?.isIntersecting) animation.play();
            else animation.pause();
          });
    // The band moves past the edges; the layer it sits in never does.
    io?.observe(band.parentElement ?? band);
    return () => {
      io?.disconnect();
      animation.cancel();
    };
  }, [reduced, duration, rest]);

  if (reduced) return null;

  return (
    <span
      data-slot="sheen"
      className={cn('pointer-events-none absolute inset-0 z-backdrop overflow-hidden rounded-[inherit]', className)}
      style={style}
      {...props}
      aria-hidden
    >
      <span
        ref={bandRef}
        data-slot="sheen-band"
        className="absolute inset-y-0 left-0 w-2/5 -translate-x-full"
        style={{
          opacity: Math.min(Math.max(strength, 0), 1),
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />
    </span>
  );
}
