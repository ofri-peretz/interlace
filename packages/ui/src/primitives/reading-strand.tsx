'use client';

import * as React from 'react';

import { cn } from '../lib/cn.js';

/**
 * ReadingStrand — reading progress as the brand's draw verb: a single
 * strand-a line at the top of the viewport that draws itself as the
 * reader moves through the piece. BRAND_PHILOSOPHY: one strand, drawn —
 * never faded.
 *
 * ### prefers-reduced-motion — considered, deliberately not gated
 *
 * Progress here is STATE coupled 1:1 to the reader's own scroll
 * position — the reader is the timeline. Nothing moves unless the
 * reader moves the page, exactly like the scrollbar thumb the browser
 * itself shows under `prefers-reduced-motion: reduce`. There are no
 * transitions or easing to clamp (the fill snaps to the measured
 * fraction each frame), so hiding the strand under `reduce` would
 * remove information without removing any self-driven motion. If a
 * transition is ever added to the fill, it must go through CSS so the
 * preflight reduce clamp reaches it.
 *
 * ## RFC (R3)
 *
 * ### Anatomy
 *
 * One fixed track (transparent by default — the page shows through)
 * holding one strand that scales horizontally from the left edge.
 * `transform: scaleX(p)` keeps updates compositor-only: no layout, no
 * paint storms on scroll (R25). SSR renders `scaleX(0)` — zero CLS.
 *
 * ### API parity (R17)
 *
 * No MUI/shadcn equivalent exists; the closest ecosystem shape is a
 * scroll-linked progress bar. Deviations from those: the element is a
 * real `progressbar` (they are usually decorative divs), and the read
 * span is declared by ELEMENT ID rather than a ref so server pages can
 * render it without a client seam just to thread a ref (the blog's RSC
 * boundary lesson, blog#176).
 *
 * ### A11y (R26)
 *
 * `role="progressbar"` + "Reading progress" name, `aria-valuenow`
 * 0–100. Value changes never announce unless queried — no live-region
 * spam. The strand is informative but never the ONLY carrier: pages
 * still state reading time in text (COLOR_PHILOSOPHY / size-is-not-
 * the-only-carrier, same contract as TimelineMap weights).
 */

export interface ReadingStrandProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  /** Stable selector for E2E tests; consumer provides — no default (R5). */
  'data-testid': string;
  /**
   * id of the element whose vertical span maps to 0→1 (the article
   * body, not the page chrome). Falls back to the whole document when
   * omitted or not found.
   */
  target?: string;
  /**
   * Accessible name of the progressbar.
   * @default "Reading progress"
   */
  label?: string;
}

/**
 * Pure progress math, exported for tests: `top`/`height` from the read
 * span's getBoundingClientRect, `viewport` = window.innerHeight. A span
 * no taller than the viewport is fully on screen — progress 1.
 */
export function readingProgress(
  top: number,
  height: number,
  viewport: number,
): number {
  const total = height - viewport;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, -top / total));
}

export function ReadingStrand({
  'data-testid': testId,
  target,
  label = 'Reading progress',
  className,
  ...rest
}: ReadingStrandProps) {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const el =
        (target ? document.getElementById(target) : null) ??
        document.documentElement;
      const rect = el.getBoundingClientRect();
      setProgress(readingProgress(rect.top, rect.height, window.innerHeight));
    };
    // rAF-throttled: scroll fires per frame or faster; one measure per
    // frame is the ceiling. Passive — never blocks the scroll thread.
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [target]);

  return (
    <div
      data-slot="reading-strand"
      data-testid={testId}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5',
        className,
      )}
      {...rest}
    >
      <div
        data-slot="reading-strand-fill"
        className="h-full w-full origin-left bg-strand-a"
        // The one genuinely dynamic value (R18): compositor-only scale,
        // no layout work per scroll frame.
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
