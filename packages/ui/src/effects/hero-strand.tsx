import * as React from 'react';

import { cn } from '../lib/cn.js';

/**
 * HeroStrand — the thread at page scale: one strand-a ribbon drawn
 * across a hero section, optionally crossed by the strand-b counter.
 * Completes the four scales of "One thread, every scale" (micro:
 * DecodeText, component: InterlaceWeave, page: TimelineMap, section:
 * THIS). BRAND_PHILOSOPHY §2: drawn, never faded.
 *
 * ### Motion — the draw verb, zero client JS
 *
 * A SERVER component on purpose. The draw is the `strand-draw` CSS
 * keyframe (tokens.css, `--animate-strand-draw`): it runs on load with
 * no hydration cost, and because the driver is CSS, the preflight
 * `prefers-reduced-motion` clamp reaches it — reduced-motion users see
 * the strand instantly drawn (the honest end state), never animating.
 * Without JS or animation support the strand simply stays invisible;
 * it is decorative (`aria-hidden`) and never carries meaning alone.
 *
 * ### Dash math (the production-weave lessons, interlace#56/#726)
 *
 * `pathLength={100}` normalizes every path so one keyframe
 * (offset 100 → 0) draws any geometry. NO `vector-effect:
 * non-scaling-stroke` — Chromium computes dashes in screen space under
 * it and discards pathLength, which is exactly the bug that shipped in
 * the first weave. Strokes therefore scale with the viewBox under
 * `preserveAspectRatio="none"`; at hero proportions the thickening is
 * gentle and intended (the ribbon breathes with the section).
 */

export interface HeroStrandProps
  extends Omit<React.ComponentPropsWithoutRef<'svg'>, 'children'> {
  /** Stable selector for E2E tests; consumer provides — no default (R5). */
  'data-testid': string;
  /**
   * Draw the strand-b counter-crossing too — the weave at section
   * scale. The counter starts 200ms behind the lead strand.
   * @default false
   */
  counter?: boolean;
}

export function HeroStrand({
  'data-testid': testId,
  counter = false,
  className,
  ...rest
}: HeroStrandProps) {
  // aria-hidden sits AFTER the rest spread on purpose: the strand is
  // always-decorative — full stop — so a consumer's aria-hidden={false}
  // must not win (review). The test contract pins this.
  return (
    <svg
      viewBox="0 0 1200 160"
      preserveAspectRatio="none"
      data-slot="hero-strand"
      data-testid={testId}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        className,
      )}
      {...rest}
      aria-hidden="true"
    >
      <path
        data-slot="hero-strand-lead"
        d="M -20 96 C 200 40, 420 150, 640 88 S 1060 30, 1220 76"
        pathLength={100}
        className="animate-strand-draw fill-none stroke-strand-a stroke-2 [stroke-dasharray:100] [stroke-dashoffset:100]"
      />
      {counter && (
        <path
          data-slot="hero-strand-counter"
          d="M -20 60 C 240 130, 480 20, 720 100 S 1080 140, 1220 44"
          pathLength={100}
          className="animate-strand-draw fill-none stroke-strand-b stroke-1 opacity-60 [animation-delay:200ms] [stroke-dasharray:100] [stroke-dashoffset:100]"
        />
      )}
    </svg>
  );
}
