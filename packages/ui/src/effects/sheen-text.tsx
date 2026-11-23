'use client';

/**
 * @interlace/ui — SheenText
 *
 * A word or short phrase painted with a slow, travelling gradient: the one
 * word of a headline that carries the promise. Use it once per view, on a few
 * words, never on body text.
 *
 * ## The colour is the text
 *
 * The gradient is clipped to the glyphs, so its colours are not decoration
 * behind the words: they are the words. Both defaults (`--primary` and
 * `--primary-active`) are text-grade on the page background in both schemes,
 * and any colour passed in must be too. In forced-colours mode the gradient is
 * dropped and the text takes the system colour.
 *
 * ## Motion
 *
 * The gradient is twice the width of the text and slides across it on the
 * Web Animations API, out and back, so there is no seam and no keyframes to
 * add. It pauses off screen. Under `prefers-reduced-motion: reduce` it holds
 * still, still two-toned.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `span` props                                          |
 * | R6   | data-slot per part      | sheen-text                                            |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R19  | Tokens only             | `--primary`, `--primary-active` defaults              |
 * | R25  | Client component        | the animation runs in the browser                     |
 * | R26  | A11y                    | real text, text-grade stops, forced-colours fallback  |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export interface SheenTextProps extends React.ComponentPropsWithoutRef<'span'> {
  /** First colour. Must be text-grade on the surface behind it. @default 'var(--primary)' */
  from?: string;
  /** Second colour. Must be text-grade on the surface behind it. @default 'var(--primary-active)' */
  to?: string;
  /** Seconds for one pass across the text. @default 6 */
  duration?: number;
  /** Set false to hold the gradient still even when motion is allowed. @default true */
  animated?: boolean;
}

export function SheenText({
  from = 'var(--primary)',
  to = 'var(--primary-active)',
  duration = 6,
  animated = true,
  className,
  style,
  ...props
}: SheenTextProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const moving = animated && !reduced;

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !moving || typeof el.animate !== 'function') return;
    const animation = el.animate(
      [{ backgroundPosition: '0% 50%' }, { backgroundPosition: '100% 50%' }],
      { duration: duration * 1000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
    );
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            if (entry?.isIntersecting) animation.play();
            else animation.pause();
          });
    io?.observe(el);
    return () => {
      io?.disconnect();
      animation.cancel();
    };
  }, [moving, duration]);

  return (
    <span
      ref={ref}
      data-slot="sheen-text"
      className={cn(
        'bg-clip-text text-transparent [background-size:200%_100%] forced-colors:bg-none forced-colors:text-[CanvasText]',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(90deg, ${from}, ${to}, ${from})`,
        ...style,
      }}
      {...props}
    />
  );
}
