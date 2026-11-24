'use client';

/**
 * @interlace/ui — Celebrate, CelebrateCheck, vibrate
 *
 * Small, one-time moments for something the player earned: a streak that
 * hits a milestone, a perfect round, a right answer. `Celebrate` wraps the
 * thing that earned it and, each time `play` changes, sends a short burst of
 * rays and a ring out from it. `CelebrateCheck` is a check mark that draws
 * itself. `vibrate` gives a matching tap on phones that support it.
 *
 * They mark an arrival, once. Nothing loops, nothing covers the content,
 * and the words that say what happened (a result line, a streak count) stay
 * the job of the component being celebrated.
 *
 * ## Anatomy
 *
 *   Celebrate                      (span — data-slot="celebrate", data-tone)
 *     ├─ children                  (the thing being celebrated, untouched)
 *     └─ span aria-hidden          (data-slot="celebrate-burst": a ring and `rays` rays, idle until played)
 *
 *   CelebrateCheck                 (span role="img" — data-slot="celebrate-check")
 *     └─ svg                       (circle + check path, drawn in)
 *
 * ## When it plays
 *
 * `Celebrate` plays when `play` changes to a new truthy value (a count, a
 * key, `true`), never on the first render, so restoring a page does not
 * replay yesterday's moment. `CelebrateCheck` draws in on mount unless
 * `animate={false}`.
 *
 * ## Motion
 *
 * The burst is 600ms, the check 300ms; both animate only `transform`,
 * `opacity` and `stroke-dashoffset`, on the Web Animations API. Under
 * reduced motion the burst does not play at all and the check is simply
 * drawn. `vibrate` is separate from motion and off unless asked for
 * (`haptic` on Celebrate, or a direct call), and it does nothing where the
 * browser has no Vibration API.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `span` props                                         |
 * | R6   | data-slot per part      | celebrate / -burst / -ring / -ray; celebrate-check   |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans     | `tone`, `size`                                       |
 * | R19  | Tokens only             | primary, success, highlight                          |
 * | R25  | Client component        | the burst runs in the browser                        |
 * | R26  | A11y                    | burst hidden; check named by `label`                 |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export type CelebrateTone = 'primary' | 'success' | 'highlight';

const TONE: Record<CelebrateTone, { bg: string; border: string; stroke: string }> = {
  primary: { bg: 'bg-primary', border: 'border-primary', stroke: 'stroke-primary' },
  success: { bg: 'bg-success', border: 'border-success', stroke: 'stroke-success' },
  highlight: { bg: 'bg-highlight', border: 'border-highlight', stroke: 'stroke-highlight' },
};

/** Named vibration patterns, in ms (on, off, on…). */
export const HAPTICS = {
  tap: [10],
  success: [12, 60, 18],
  milestone: [14, 50, 14, 50, 28],
  miss: [30, 40, 30],
} as const satisfies Record<string, readonly number[]>;

export type HapticPattern = keyof typeof HAPTICS;

/** A short vibration where the browser supports it. Returns whether it ran. */
export function vibrate(pattern: HapticPattern | readonly number[] = 'tap'): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  const p = typeof pattern === 'string' ? HAPTICS[pattern] : pattern;
  try {
    return navigator.vibrate([...p]);
  } catch {
    return false;
  }
}

export interface CelebrateProps extends React.ComponentPropsWithoutRef<'span'> {
  /** Plays the burst each time this changes to a new truthy value. Not on the first render. */
  play?: string | number | boolean | null;
  /** @default 'primary' */
  tone?: CelebrateTone;
  /** How many rays. @default 12 */
  rays?: number;
  /** Also vibrate with this pattern when it plays. Off by default. */
  haptic?: HapticPattern | false;
}

function Celebrate({ play, tone = 'primary', rays = 12, haptic = false, className, children, ...props }: CelebrateProps) {
  const reduced = useReducedMotion();
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const last = React.useRef(play);
  const count = Math.max(0, Math.min(24, Math.round(rays)));

  React.useEffect(() => {
    const prev = last.current;
    last.current = play;
    if (!play || play === prev) return;
    if (haptic) vibrate(haptic);
    const root = rootRef.current;
    if (reduced || !root) return;
    const box = root.getBoundingClientRect();
    const r0 = Math.max(box.width, box.height) / 2;
    const ring = root.querySelector<HTMLElement>('[data-slot="celebrate-ring"]');
    const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';
    if (ring && typeof ring.animate === 'function') {
      ring.animate(
        [
          { transform: 'scale(0.85)', opacity: 0.6 },
          { transform: 'scale(1.35)', opacity: 0 },
        ],
        { duration: 500, easing },
      );
    }
    root.querySelectorAll<HTMLElement>('[data-slot="celebrate-ray"]').forEach((ray, i) => {
      if (typeof ray.animate !== 'function') return;
      const a = (360 / count) * i;
      const far = r0 + 14 + (i % 2) * 8;
      ray.animate(
        [
          { transform: `rotate(${a}deg) translateY(-${r0}px) scaleY(0.2)`, opacity: 0 },
          { transform: `rotate(${a}deg) translateY(-${r0 + 6}px) scaleY(1)`, opacity: 1, offset: 0.3 },
          { transform: `rotate(${a}deg) translateY(-${far}px) scaleY(0.4)`, opacity: 0 },
        ],
        { duration: 600, easing },
      );
    });
  }, [play, reduced, haptic, count]);

  const t = TONE[tone];
  return (
    <span
      ref={rootRef}
      data-slot="celebrate"
      data-tone={tone}
      className={cn('relative inline-grid', className)}
      {...props}
    >
      {children}
      <span
        aria-hidden
        data-slot="celebrate-burst"
        className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible"
      >
        <span
          data-slot="celebrate-ring"
          className={cn('col-start-1 row-start-1 size-full rounded-full border-2 opacity-0', t.border)}
        />
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            data-slot="celebrate-ray"
            className={cn('col-start-1 row-start-1 h-2 w-0.5 rounded-full opacity-0', t.bg)}
          />
        ))}
      </span>
    </span>
  );
}
Celebrate.displayName = 'Celebrate';

export interface CelebrateCheckProps extends Omit<React.ComponentPropsWithoutRef<'span'>, 'children'> {
  /** Names the mark for assistive tech. Leave out when nearby text already says it; the mark is then hidden. */
  label?: string;
  /** Draw in on mount. @default true */
  animate?: boolean;
  /** @default 'success' */
  tone?: CelebrateTone;
  /** @default 'default' */
  size?: 'sm' | 'default' | 'lg';
}

const CHECK_SIZE = { sm: 'size-5', default: 'size-8', lg: 'size-12' } as const;
const CIRCLE = 2 * Math.PI * 10;
const TICK = 14;

function CelebrateCheck({ label, animate = true, tone = 'success', size = 'default', className, ...props }: CelebrateCheckProps) {
  const reduced = useReducedMotion();
  const svgRef = React.useRef<SVGSVGElement>(null);

  React.useEffect(() => {
    if (!animate || reduced) return;
    const [circle, tick] = Array.from(svgRef.current?.querySelectorAll<SVGElement>('circle, path') ?? []);
    const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';
    if (circle && typeof circle.animate === 'function') {
      circle.animate([{ strokeDashoffset: `${CIRCLE}` }, { strokeDashoffset: '0' }], { duration: 300, easing });
    }
    if (tick && typeof tick.animate === 'function') {
      tick.animate([{ strokeDashoffset: `${TICK}` }, { strokeDashoffset: `${TICK}`, offset: 0.4 }, { strokeDashoffset: '0' }], {
        duration: 300,
        easing,
      });
    }
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = TONE[tone];
  return (
    <span
      data-slot="celebrate-check"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block shrink-0', CHECK_SIZE[size], className)}
      {...props}
    >
      <svg ref={svgRef} viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={cn('size-full', t.stroke)}>
        <circle cx="12" cy="12" r="10" strokeDasharray={CIRCLE} strokeDashoffset={0} transform="rotate(-90 12 12)" />
        <path d="M7.5 12.5l3 3 6-6.5" strokeDasharray={TICK} strokeDashoffset={0} />
      </svg>
    </span>
  );
}
CelebrateCheck.displayName = 'CelebrateCheck';

export { Celebrate, CelebrateCheck };
