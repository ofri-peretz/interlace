'use client';

/**
 * @interlace/ui — SkyBackdrop
 *
 * A calm daytime sky for a friendly hero: a soft gradient, a warm sun glow
 * in one corner, and a few clouds drifting across. It suits pages that want
 * warmth rather than drama, the light counterpart to `Starfield`.
 *
 * ## Built on the theme
 *
 * The sky is mixed from tokens (`--info` into `--background`), the sun is
 * `--highlight`, and the clouds are `--card`, so the sky follows the brand
 * and turns to dusk in the dark scheme with no extra props. Every colour can
 * still be set directly.
 *
 * ## Clouds
 *
 * Each cloud is three overlapping soft circles (radial gradients) on one
 * element, so a cloud is a single node with no image and no SVG filter.
 * Cloud sizes, heights and speeds come from a seeded sequence, so the same
 * `seed` draws the same sky on the server and in the browser.
 *
 * ## Motion
 *
 * Clouds drift right to left on 60 to 120 second loops through the Web
 * Animations API, and pause while the sky is out of view. Under
 * `prefers-reduced-motion: reduce` they stay where they are.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props                                          |
 * | R6   | data-slot per part      | sky-backdrop / -sun / -cloud / -content               |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R8   | Enums, not booleans     | `sun`                                                |
 * | R19  | Tokens only             | `--info`, `--background`, `--highlight`, `--card`     |
 * | R23  | CLS=0                   | sky layers are `absolute`, content stays in flow      |
 * | R25  | Client component        | the drift needs `Element.animate`                     |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export type SkySun = 'top-left' | 'top-right' | 'none';

export interface SkyBackdropProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Where the sun glows, or `none`. @default 'top-right' */
  sun?: SkySun;
  /** Number of clouds, 0 to 8. @default 4 */
  clouds?: number;
  /** Same seed, same sky. @default 3 */
  seed?: number;
  /** Colour at the top of the sky. @default a mix of --info into --background */
  skyColor?: string;
  /** Sun colour. @default 'var(--highlight)' */
  sunColor?: string;
  /** Cloud colour. @default 'var(--card)' */
  cloudColor?: string;
  /** Set false to keep the clouds still even when motion is allowed. @default true */
  animated?: boolean;
}

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

function cloudBackground(color: string) {
  const c = (alpha: number) => `color-mix(in oklab, ${color} ${alpha}%, transparent)`;
  return [
    `radial-gradient(closest-side at 30% 60%, ${c(95)}, transparent)`,
    `radial-gradient(closest-side at 55% 40%, ${c(100)}, transparent)`,
    `radial-gradient(closest-side at 75% 65%, ${c(90)}, transparent)`,
  ].join(', ');
}

export function SkyBackdrop({
  sun = 'top-right',
  clouds = 4,
  seed = 3,
  skyColor = 'color-mix(in oklab, var(--info) 30%, var(--background))',
  sunColor = 'var(--highlight)',
  cloudColor = 'var(--card)',
  animated = true,
  className,
  children,
  ...props
}: SkyBackdropProps) {
  const layerRef = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const moving = animated && !reduced;

  const cloudList = React.useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: Math.min(Math.max(0, Math.round(clouds)), 8) }, () => {
      const top = 5 + rand() * 45;
      const place = rand();
      const width = 14 + rand() * 16;
      return {
        top,
        // Each cloud rests fully inside the sky, so its loop always has an
        // off-screen moment to wrap in and never jumps where it can be seen.
        left: place * (100 - width),
        width,
        seconds: 60 + rand() * 60,
        opacity: 0.6 + rand() * 0.35,
      };
    });
  }, [clouds, seed]);

  React.useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !moving) return;
    const nodes = Array.from(layer.querySelectorAll<HTMLElement>('[data-slot="sky-backdrop-cloud"]'));
    if (!nodes.every((n) => typeof n.animate === 'function')) return;
    const width = layer.clientWidth;
    const animations = nodes.map((node, i) => {
      const cloud = cloudList[i]!;
      // Start at the cloud's resting place, so the first frame matches the
      // server render: drift off the left edge, re-enter from the right, and
      // come back to rest. One loop crosses the sky once.
      const start = node.offsetLeft;
      const size = node.offsetWidth;
      const total = width + size || 1;
      const exitAt = Math.min(Math.max((start + size) / total, 0), 1);
      return node.animate(
        [
          { translate: '0px 0px' },
          { translate: `${-(start + size)}px 0px`, offset: exitAt },
          { translate: `${width - start}px 0px`, offset: exitAt },
          { translate: '0px 0px' },
        ],
        { duration: cloud.seconds * 1000, iterations: Infinity, easing: 'linear' },
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
    io?.observe(layer);
    return () => {
      io?.disconnect();
      for (const a of animations) a.cancel();
    };
  }, [moving, cloudList]);

  return (
    <div
      data-slot="sky-backdrop"
      className={cn('relative isolate overflow-hidden', className)}
      style={{ background: `linear-gradient(to bottom, ${skyColor}, var(--background))` }}
      {...props}
    >
      <div ref={layerRef} aria-hidden className="pointer-events-none absolute inset-0 z-backdrop">
        {sun !== 'none' ? (
          <span
            data-slot="sky-backdrop-sun"
            className="absolute size-[60vmin] rounded-full"
            style={{
              top: '-20vmin',
              [sun === 'top-left' ? 'left' : 'right']: '-15vmin',
              background: `radial-gradient(closest-side, color-mix(in oklab, ${sunColor} 80%, transparent), color-mix(in oklab, ${sunColor} 25%, transparent) 45%, transparent)`,
            }}
          />
        ) : null}
        {cloudList.map((cloud, i) => (
          <span
            key={i}
            data-slot="sky-backdrop-cloud"
            className="absolute aspect-[5/2]"
            style={{
              top: `${cloud.top}%`,
              left: `${cloud.left}%`,
              width: `${cloud.width}%`,
              minWidth: '7rem',
              opacity: cloud.opacity,
              background: cloudBackground(cloudColor),
            }}
          />
        ))}
      </div>
      {children != null ? (
        <div data-slot="sky-backdrop-content" className="relative">
          {children}
        </div>
      ) : null}
    </div>
  );
}
