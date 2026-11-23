/**
 * @interlace/ui — LightBeam
 *
 * A soft cone of light falling into a dark section from an edge, the way a
 * stage light picks out a speaker. It draws the eye to the headline under it
 * and gives a flat surface depth. It does not move: the light is part of the
 * set, not an event.
 *
 * ## How it is drawn
 *
 * One element, two gradients. A `conic-gradient` makes the cone's crisp
 * angle and a `radial-gradient` mask fades it out with distance, so the beam
 * has a bright source and a long soft falloff. No SVG, no blur filter, no
 * JavaScript: it renders on the server and paints in the first frame.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props, minus children                           |
 * | R6   | data-slot               | `light-beam`                                         |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R8   | Enums, not booleans     | `origin`                                             |
 * | R19  | Tokens only             | defaults to `--hero-star`                             |
 * | R23  | CLS=0                   | `absolute inset-0`, never in flow                     |
 * | R25  | Server component        | no hooks → no `'use client'`                          |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export type LightBeamOrigin = 'top-left' | 'top' | 'top-right';

const ORIGIN: Record<LightBeamOrigin, { x: string; aim: number }> = {
  'top-left': { x: '8%', aim: 150 },
  top: { x: '50%', aim: 180 },
  'top-right': { x: '92%', aim: 210 },
};

export interface LightBeamProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children' | 'aria-hidden'> {
  /** Where the light comes from. @default 'top' */
  origin?: LightBeamOrigin;
  /** Any CSS colour. @default 'var(--hero-star)' */
  color?: string;
  /** Width of the cone, in degrees. @default 36 */
  angle?: number;
  /** Brightness at the source, 0 to 1. @default 0.35 */
  intensity?: number;
}

export function LightBeam({
  origin = 'top',
  color = 'var(--hero-star)',
  angle = 36,
  intensity = 0.35,
  className,
  style,
  ...props
}: LightBeamProps) {
  const { x, aim } = ORIGIN[origin];
  const half = angle / 2;
  const strength = Math.round(Math.min(Math.max(intensity, 0), 1) * 100);
  const tint = `color-mix(in oklab, ${color} ${strength}%, transparent)`;
  return (
    <div
      data-slot="light-beam"
      data-origin={origin}
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        background: `conic-gradient(from ${aim - half}deg at ${x} 0%, transparent 0deg, ${tint} ${half}deg, transparent ${angle}deg, transparent 360deg)`,
        maskImage: `radial-gradient(ellipse 90% 100% at ${x} 0%, black, transparent 85%)`,
        WebkitMaskImage: `radial-gradient(ellipse 90% 100% at ${x} 0%, black, transparent 85%)`,
        ...style,
      }}
      {...props}
      aria-hidden
    />
  );
}
