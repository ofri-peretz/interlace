'use client';

/**
 * @interlace/ui — Marker
 *
 * A highlighter stroke across the one phrase in a paragraph a reader should
 * not miss. The first time the phrase scrolls into view, the stroke sweeps
 * across it from the start of the line to the end, the way a pen would, and
 * wraps across lines with the text. It is emphasis, so use it once or twice
 * on a page, not on every sentence.
 *
 * ## Content first
 *
 * It is a `<mark>`, so the emphasis is in the HTML for a screen reader and a
 * crawler, and the finished stroke is in the server HTML. The text itself
 * never moves, fades or changes colour; only the stroke behind it is drawn.
 * In forced-colours mode, where backgrounds are dropped, the phrase is
 * underlined instead.
 *
 * ## Motion
 *
 * One Web Animations API animation of `background-size`, from nothing to the
 * full phrase, starting at the inline-start edge, so it sweeps right to left
 * in a right-to-left paragraph. Under `prefers-reduced-motion: reduce`,
 * without IntersectionObserver, or without `element.animate`, the stroke is
 * simply there.
 *
 * ## Tokens
 *
 * `tone` picks the colour (`--highlight` or `--primary`), mixed toward
 * transparent so body text keeps its own colour and contrast on top of it.
 * `--marker-color` and `--marker-size` can be retuned by a theme.
 *
 * ## Composition
 *
 *   Marker                              (mark — data-slot="marker", data-variant, data-tone)
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `mark` props                                         |
 * | R6   | data-slot per part      | marker                                               |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans     | `variant`, `tone`                                    |
 * | R19  | Tokens only             | `--highlight`, `--primary`                           |
 * | R25  | Client component        | the sweep runs in the browser                        |
 * | R26  | A11y from native el     | `<mark>` semantics                                   |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

const VARIANTS = {
  /** A highlighter across the lower half of the letters. */
  band: '[--marker-size:0.62em] bg-[position:0_82%] rtl:bg-[position:100%_82%]',
  /** A highlighter across the whole line. */
  full: '[--marker-size:100%] bg-[position:0_50%] rtl:bg-[position:100%_50%]',
  /** A thick pen line under the letters. */
  underline: '[--marker-size:0.14em] bg-[position:0_100%] rtl:bg-[position:100%_100%]',
} as const;

const TONES = {
  highlight:
    '[--marker-color:color-mix(in_oklch,var(--highlight)_60%,transparent)] dark:[--marker-color:color-mix(in_oklch,var(--highlight)_40%,transparent)]',
  primary:
    '[--marker-color:color-mix(in_oklch,var(--primary)_22%,transparent)] dark:[--marker-color:color-mix(in_oklch,var(--primary)_30%,transparent)]',
} as const;

/** The underline is a line, not a wash, so it takes the tone at full strength. */
const UNDERLINE_TONES = {
  highlight: '[--marker-color:var(--highlight)]',
  primary: '[--marker-color:var(--primary)]',
} as const;

export type MarkerVariant = keyof typeof VARIANTS;
export type MarkerTone = keyof typeof TONES;

export interface MarkerProps extends React.ComponentPropsWithoutRef<'mark'> {
  /** The shape of the stroke: `band` across the lower half, `full` across the line, `underline` under it. @default 'band' */
  variant?: MarkerVariant;
  /** The colour of the stroke. @default 'highlight' */
  tone?: MarkerTone;
  /** Milliseconds the sweep takes. @default 700 */
  duration?: number;
  /** Milliseconds to wait after the phrase enters the viewport. @default 150 */
  delay?: number;
}

export function Marker({
  variant = 'band',
  tone = 'highlight',
  duration = 700,
  delay = 150,
  className,
  children,
  ...props
}: MarkerProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);

  // Before paint: take the stroke away, so it can be drawn instead of flashing.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced || typeof el.animate !== 'function') return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (el.dataset.marked) return;

    // The resolved height of the stroke, e.g. "100% 8px" → "8px".
    // Only the first layer: a consumer's own background adds a comma-separated second one.
    const height = getComputedStyle(el).backgroundSize.split(',')[0]!.trim().split(/\s+/)[1] ?? '100%';
    const from = `0% ${height}`;
    const to = `100% ${height}`;
    el.style.backgroundSize = from;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        el.dataset.marked = 'true';
        el.style.backgroundSize = '';
        el.animate([{ backgroundSize: from }, { backgroundSize: to }], {
          duration,
          delay,
          easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
          fill: 'backwards',
        });
      },
      { threshold: 0.75 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      el.style.backgroundSize = '';
      for (const a of el.getAnimations?.() ?? []) a.cancel();
    };
  }, [reduced, duration, delay, variant]);

  return (
    <mark
      ref={ref}
      data-slot="marker"
      data-variant={variant}
      data-tone={tone}
      className={cn(
        'text-inherit bg-transparent bg-no-repeat [background-image:linear-gradient(var(--marker-color),var(--marker-color))] bg-[length:100%_var(--marker-size)] px-[0.1em] [box-decoration-break:slice] forced-colors:underline',
        VARIANTS[variant],
        variant === 'underline' ? UNDERLINE_TONES[tone] : TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </mark>
  );
}
