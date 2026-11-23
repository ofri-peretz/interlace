'use client';

/**
 * @interlace/ui — GradientMesh
 *
 * A soft, slowly shifting field of colour for a hero or a feature band. A
 * few large blurred glows, each a theme colour, drift on long loops over a
 * base surface, so the band feels alive without anything a reader has to
 * watch. Content goes in `children` and sits above the glows.
 *
 * ## Built on the theme
 *
 * `colors` takes any CSS colours and defaults to theme tokens (`--primary`,
 * `--chart-2`, `--highlight`, `--chart-4`), so the mesh follows the brand and
 * the colour scheme with no per-theme prop. Each glow is a radial gradient
 * fading to transparent: no blend modes, no SVG filters, nothing that
 * changes between browsers.
 *
 * ## Self-contained motion
 *
 * The drift uses the Web Animations API, so the component ships no keyframes
 * and needs nothing added to the consumer's stylesheet. Each glow moves on
 * `transform` only (composited), on a loop of 18 to 30 seconds, and the loop
 * pauses while the mesh is out of view. Under `prefers-reduced-motion:
 * reduce` the glows hold their resting place.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props                                          |
 * | R6   | data-slot per part      | gradient-mesh / -glows / -content                     |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R19  | Tokens only             | default colours and base surface are tokens           |
 * | R23  | CLS=0                   | glows are `absolute`, content stays in flow           |
 * | R25  | Client component        | the drift needs `Element.animate`                     |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

const DEFAULT_COLORS = [
  'var(--primary)',
  'var(--chart-2)',
  'var(--highlight)',
  'var(--chart-4)',
] as const;

/** Resting place and drift path of each glow, as percentages of the mesh. */
const PATHS = [
  { at: [15, 20], drift: [12, 8], seconds: 22 },
  { at: [80, 25], drift: [-10, 12], seconds: 27 },
  { at: [60, 80], drift: [8, -10], seconds: 19 },
  { at: [25, 75], drift: [-8, -6], seconds: 30 },
  { at: [50, 45], drift: [6, 10], seconds: 25 },
  { at: [90, 70], drift: [-12, -8], seconds: 21 },
] as const;

export interface GradientMeshProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Up to six CSS colours, one glow each. @default theme primary, chart-2, highlight, chart-4 */
  colors?: readonly string[];
  /** How strong the glows are, 0 to 1. @default 0.55 */
  intensity?: number;
  /** Glow diameter as a share of the mesh's width. @default 0.6 */
  spread?: number;
  /** Set false to hold the glows still even when motion is allowed. @default true */
  animated?: boolean;
}

export function GradientMesh({
  colors = DEFAULT_COLORS,
  intensity = 0.55,
  spread = 0.6,
  animated = true,
  className,
  children,
  ...props
}: GradientMeshProps) {
  const glowsRef = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const moving = animated && !reduced;
  const palette = colors.slice(0, PATHS.length);

  React.useEffect(() => {
    const root = glowsRef.current;
    if (!root || !moving || typeof root.animate !== 'function') return;
    const glows = Array.from(root.children) as HTMLElement[];
    const animations = glows.map((glow, i) => {
      const path = PATHS[i % PATHS.length]!;
      const [dx, dy] = path.drift;
      return glow.animate(
        [
          { transform: 'translate(-50%, -50%) translate(0, 0)' },
          { transform: `translate(-50%, -50%) translate(${dx}%, ${dy}%)` },
          { transform: `translate(-50%, -50%) translate(${-dy / 2}%, ${dx / 2}%)` },
          { transform: 'translate(-50%, -50%) translate(0, 0)' },
        ],
        { duration: path.seconds * 1000, iterations: Infinity, easing: 'ease-in-out' },
      );
    });

    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            for (const a of animations) {
              if (entry?.isIntersecting) a.play();
              else a.pause();
            }
          });
    io?.observe(root);

    return () => {
      io?.disconnect();
      for (const a of animations) a.cancel();
    };
  }, [moving, palette.length]);

  return (
    <div
      data-slot="gradient-mesh"
      className={cn('bg-background relative isolate overflow-hidden', className)}
      {...props}
    >
      <div
        ref={glowsRef}
        aria-hidden
        data-slot="gradient-mesh-glows"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        {palette.map((color, i) => {
          const path = PATHS[i]!;
          return (
            <span
              key={i}
              className="absolute aspect-square rounded-full"
              style={{
                left: `${path.at[0]}%`,
                top: `${path.at[1]}%`,
                width: `${spread * 100}%`,
                transform: 'translate(-50%, -50%)',
                opacity: Math.min(Math.max(intensity, 0), 1),
                background: `radial-gradient(closest-side, ${color}, transparent)`,
              }}
            />
          );
        })}
      </div>
      {children !== undefined ? (
        <div data-slot="gradient-mesh-content" className="relative">
          {children}
        </div>
      ) : null}
    </div>
  );
}
