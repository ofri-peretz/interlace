'use client';

/**
 * @interlace/ui — ThreadLines
 *
 * Interlace's own backdrop: a loose bundle of threads running across a
 * section, crossing and parting the way strands do in a weave, with a small
 * glint of light travelling along each one. It is the brand mark (two
 * strands, interlaced) at the scale of a page.
 *
 * ## How it is drawn
 *
 * The threads are generated, not hand-drawn: each is a smooth curve through
 * evenly spaced points whose heights come from a seeded random sequence, so
 * the same `seed` always draws the same bundle, on the server and in the
 * browser alike. Strokes alternate between the two strand tokens
 * (`--strand-a`, `--strand-b`) and keep a hairline width at any size
 * (`vector-effect: non-scaling-stroke`).
 *
 * ## Motion
 *
 * The glint is a short dash moved along each path with the Web Animations
 * API, so the component ships no keyframes. Each thread takes 6 to 11
 * seconds and they are offset so no two glints line up. The loop pauses out
 * of view. Under `prefers-reduced-motion: reduce` the threads are drawn and
 * nothing travels.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `svg` props, minus children                           |
 * | R6   | data-slot per part      | thread-lines / -thread / -glint                       |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R19  | Tokens only             | `--strand-a`, `--strand-b`                            |
 * | R23  | CLS=0                   | `absolute inset-0`, never in flow                     |
 * | R25  | Client component        | the glint needs `Element.animate`                     |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

const W = 1000;
const H = 400;

/** Mulberry32: small, fast, and identical on every JS engine. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth path through points (Catmull-Rom converted to cubic Béziers). */
function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  let d = `M${points[0]![0]} ${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export function threadPaths(count: number, seed: number): string[] {
  const rand = seeded(seed);
  const steps = 6;
  return Array.from({ length: count }, (_, i) => {
    // Each thread has a home height; the curve wanders around it, so the
    // bundle reads as parallel strands that cross, not as a scribble.
    const home = H * (0.25 + (0.5 * (i + 0.5)) / count);
    const points = Array.from({ length: steps + 1 }, (_, s) => {
      const x = (W * s) / steps;
      const y = home + (rand() - 0.5) * H * 0.45;
      return [x, y] as const;
    });
    return smoothPath(points);
  });
}

export interface ThreadLinesProps
  extends Omit<React.ComponentPropsWithoutRef<'svg'>, 'children' | 'aria-hidden'> {
  /** Number of threads. @default 8 */
  count?: number;
  /** Same seed, same bundle. Change it to get a different weave. @default 7 */
  seed?: number;
  /** Thread opacity, 0 to 1. @default 0.35 */
  opacity?: number;
  /** Set false to keep the glints still even when motion is allowed. @default true */
  animated?: boolean;
}

export function ThreadLines({
  count = 8,
  seed = 7,
  opacity = 0.35,
  animated = true,
  className,
  ...props
}: ThreadLinesProps) {
  const ref = React.useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const moving = animated && !reduced;
  const paths = React.useMemo(() => threadPaths(Math.max(1, count), seed), [count, seed]);

  React.useEffect(() => {
    const svg = ref.current;
    if (!svg || !moving) return;
    const glints = Array.from(svg.querySelectorAll<SVGPathElement>('[data-slot="thread-lines-glint"]'));
    if (!glints.every((g) => typeof g.animate === 'function')) return;
    const animations = glints.map((glint, i) =>
      glint.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: -12 }], {
        duration: 6000 + ((i * 1700) % 5000),
        delay: -((i * 2300) % 6000),
        iterations: Infinity,
        easing: 'linear',
      }),
    );
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            for (const a of animations) {
              if (entry?.isIntersecting) a.play();
              else a.pause();
            }
          });
    io?.observe(svg);
    return () => {
      io?.disconnect();
      for (const a of animations) a.cancel();
    };
  }, [moving, paths]);

  return (
    <svg
      ref={ref}
      data-slot="thread-lines"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      fill="none"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
      {...props}
      aria-hidden
      focusable="false"
    >
      {paths.map((d, i) => {
        const stroke = i % 2 === 0 ? 'var(--strand-a)' : 'var(--strand-b)';
        return (
          <g key={i}>
            <path
              data-slot="thread-lines-thread"
              d={d}
              stroke={stroke}
              strokeOpacity={opacity}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {moving ? (
              <path
                data-slot="thread-lines-glint"
                d={d}
                pathLength={100}
                stroke={stroke}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="6 106"
                strokeDashoffset={100}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
