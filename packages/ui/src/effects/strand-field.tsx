'use client';

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { linePath, seriesScales, type Point } from '../charts/scale.js';
import { SERIES_STYLE } from '../charts/time-series.js';

/**
 * StrandField — real series lifted into depth: each thread on its own
 * plane in a CSS-3D perspective stage, fanned apart so the weave can be
 * seen THROUGH, tilting gently with the pointer, collapsing back into
 * one flat weave on demand. The fifth scale of "One thread, every
 * scale": the thread as a SPACE the reader stands in front of.
 *
 * ### CSS 3D, not WebGL — a decision, not a limitation
 *
 * MOTION_PHILOSOPHY rejects WebGL chrome, and this exhibit does not need
 * it: `perspective` + `translateZ` + two rotations are composited on the
 * GPU, cost zero kilobytes of dependency, render on the server (the
 * default tilt is static markup), and degrade to a flat stack of SVGs
 * anywhere 3D transforms are missing. Every strand is the DS's own SVG
 * polyline, not a shader's idea of one.
 *
 * ### Pointer tilt is bounded interaction, not ambient decoration
 *
 * The philosophy bans motion that follows the mouse GLOBALLY (the
 * cursor-glow class of effect). This tilt is the exhibit responding to
 * inspection inside its own bounds — the In Pieces law, the exhibit IS
 * the product — it is transition-smoothed, it costs nothing while the
 * pointer is elsewhere, touch devices simply keep the composed default
 * tilt, and under `prefers-reduced-motion` the tilt does not run at all
 * (checked at event time, so no listener bookkeeping can go stale).
 *
 * ### The field is theatre; the controls are elsewhere
 *
 * The whole field is `aria-hidden` and holds no focusable element —
 * exactly like HeroStrand, it never carries meaning alone. `onStrandSelect`
 * is a pointer shortcut for a selection surface the CONSUMER already
 * renders accessibly (thread toggles, a legend); it must never be the
 * only path to selection. Strand entrance is the strand-draw verb
 * (pathLength=100, staggered via a CSS variable so the reduce clamp's
 * zero-delay override still wins over the inline value).
 */

export interface StrandFieldSeries {
  id: string;
  label: string;
  points: readonly Point[];
}

/**
 * Five chart hues exist; seven planes stay readable in depth. Beyond the
 * cap, strands are not drawn — the field is decoration over a consumer
 * surface that already lists every thread, so nothing is lost.
 */
const MAX_STRANDS = 7;

/** Per-strand drawing box. Wide like HeroStrand's, so strokes stay slim. */
const W = 600;
const H = 160;

/** Depth between fanned planes, px. */
const SPREAD = 46;

const BASE_RX = 18;
const BASE_RY = -12;

export interface StrandFieldProps
  // Always-decorative, exactly like HeroStrand: aria-hidden is omitted at
  // the type level and forced after the spread below.
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children' | 'aria-hidden'> {
  /** Stable selector for E2E tests; consumer provides — no default (R5). */
  'data-testid': string;
  /** The threads. Each is normalized to its OWN shape (see the caption rule). */
  series: readonly StrandFieldSeries[];
  /** Ids drawn at full presence; the rest recede. Empty = all present. */
  activeIds?: readonly string[];
  /**
   * Pointer shortcut: a strand was clicked. Selection must ALSO be
   * reachable through an accessible surface the consumer renders.
   */
  onStrandSelect?: (id: string) => void;
  /**
   * Collapse every plane to z=0 — the flat weave. The transition between
   * woven and fanned is the component's one composed gesture.
   * @default false
   */
  woven?: boolean;
}

export function StrandField({
  'data-testid': testId,
  series,
  activeIds,
  onStrandSelect,
  woven = false,
  className,
  ...rest
}: StrandFieldProps) {
  // Tilt as normalized pointer position, or null for the composed default.
  const [tilt, setTilt] = React.useState<{ nx: number; ny: number } | null>(null);

  const drawn = series
    .map((s) => ({ ...s, scales: seriesScales(s.points, W, H, 12) }))
    .filter((s) => s.scales.points.length >= 2)
    .slice(0, MAX_STRANDS);

  const active = new Set(activeIds ?? []);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // Reduced motion: a 3D stage rotating under the pointer is exactly
    // the vestibular trigger the preference exists for. Checked per
    // event — cheap, and never stale.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    setTilt({
      nx: ((event.clientX - box.left) / box.width) * 2 - 1,
      ny: ((event.clientY - box.top) / box.height) * 2 - 1,
    });
  };

  const rx = BASE_RX - (tilt?.ny ?? 0) * 8;
  const ry = BASE_RY + (tilt?.nx ?? 0) * 10;

  return (
    <div
      data-slot="strand-field"
      data-testid={testId}
      data-woven={woven ? '' : undefined}
      className={cn('relative h-64 overflow-hidden [perspective:1100px]', className)}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setTilt(null)}
      {...rest}
      aria-hidden="true"
    >
      <div
        data-slot="strand-field-stage"
        className="absolute inset-0 transition-transform duration-300 ease-out [transform-style:preserve-3d] motion-reduce:transition-none"
        // Dynamic 3D pose — the R18 exception (genuinely dynamic values).
        style={{ transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }}
      >
        {drawn.map((strand, index) => {
          const present = active.size === 0 || active.has(strand.id);
          const z = woven ? 0 : ((drawn.length - 1) / 2 - index) * SPREAD;
          const lastPoint = strand.scales.points[strand.scales.points.length - 1];
          return (
            <div
              key={strand.id}
              data-slot="strand-field-plane"
              className={cn(
                'absolute inset-0 transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none',
                present ? 'opacity-100' : 'opacity-40',
              )}
              style={{ transform: `translateZ(${z}px)` }}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="pointer-events-none h-full w-full"
              >
                <g
                  data-slot="strand-field-strand"
                  data-strand-id={strand.id}
                  className={cn(onStrandSelect && 'cursor-pointer')}
                  onClick={() => onStrandSelect?.(strand.id)}
                >
                  {/* Invisible fat twin of the line — a 2px stroke is not a
                      click target. `pointerEvents="stroke"` scopes hits to
                      the thread itself, so planes behind stay reachable. */}
                  {onStrandSelect && (
                    <path
                      d={linePath(strand.scales)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      pointerEvents="stroke"
                    />
                  )}
                  <path
                    d={linePath(strand.scales)}
                    pathLength={100}
                    fill="none"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className={cn(
                      'animate-strand-draw [stroke-dasharray:100] [stroke-dashoffset:100]',
                      '[animation-delay:var(--sf-delay)] motion-reduce:[animation-delay:0s]',
                      // Hue from the SAME identity table the charts draw
                      // with (literal class strings — a template literal
                      // here would be invisible to Tailwind's scanner).
                      SERIES_STYLE[index % SERIES_STYLE.length].stroke,
                    )}
                    // The stagger rides a variable, not the property: an
                    // inline animation-delay would beat the reduce
                    // override above, and a reduce user would stare at an
                    // invisible strand for the length of the queue.
                    style={{ '--sf-delay': `${index * 90}ms` } as React.CSSProperties}
                  />
                </g>
              </svg>
              <span
                data-slot="strand-field-label"
                className="absolute right-2 -translate-y-1/2 text-[10px] tracking-wide text-muted-foreground"
                style={{ top: `${(strand.scales.y(lastPoint.v) / H) * 100}%` }}
              >
                {strand.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
