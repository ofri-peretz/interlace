/**
 * @interlace/ui — WeaveTexture
 *
 * A quiet woven cloth behind a section: warp threads in `--strand-a` and weft
 * threads in `--strand-b`, passing over and under each other in a plain
 * weave. It is texture, not glow: nothing moves, nothing shines, and at the
 * default strength it sits just above the page colour, so text on top keeps
 * its full contrast.
 *
 * The survey behind Interlace's identity asks for "texture instead of glow":
 * where the genre lights a dark hero with beams and particles, Interlace
 * dresses a light page in its own material.
 *
 * ## How it is drawn
 *
 * One SVG `<pattern>` tile in real pixels (no viewBox scaling, so the thread
 * width is the same at any section size), repeated to fill the parent. The
 * tile is two cells square: a warp and a weft thread cross in each cell, and
 * the one on top alternates like a checkerboard, which is what makes a plain
 * weave read as cloth rather than a grid. The thread on top is edged in the
 * page colour, so the crossing shows without any shading.
 *
 * ## Host contract
 *
 * Absolutely positioned to fill its parent, like every Interlace backdrop.
 * Put it first inside a `relative` (or `isolate`) section; content after it
 * paints on top.
 *
 * | Rule | Concept                 | Where in this file                                     |
 * | ---- | ----------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el       | `svg` props, minus children and aria-hidden            |
 * | R6   | data-slot               | `weave-texture`                                        |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                      |
 * | R8   | Enums, not booleans     | `density`, `strength`, `fade`                          |
 * | R19  | Tokens only             | `--strand-a`, `--strand-b`, `--background`             |
 * | R23  | CLS=0                   | `absolute inset-0`, never in flow                      |
 * | R25  | Server component        | Only `useId`, which RSC supports → no `'use client'`   |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

/** Thread spacing in CSS pixels: one cell of the weave. */
const CELL = { fine: 8, default: 12, coarse: 20 } as const;

/** How far the cloth stands out from the page. */
const STRENGTH = { faint: 0.06, default: 0.1, strong: 0.18 } as const;

const FADE = {
  none: '',
  edges: '[mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]',
  bottom: '[mask-image:linear-gradient(to_bottom,black_30%,transparent)]',
} as const;

export interface WeaveTextureProps extends Omit<
  React.ComponentPropsWithoutRef<'svg'>,
  'children' | 'aria-hidden'
> {
  /** Thread spacing. @default 'default' */
  density?: keyof typeof CELL;
  /** How far the cloth stands out from the page. @default 'default' */
  strength?: keyof typeof STRENGTH;
  /** Let the cloth thin out toward the section's edges or bottom. @default 'none' */
  fade?: keyof typeof FADE;
}

export function WeaveTexture({
  density = 'default',
  strength = 'default',
  fade = 'none',
  className,
  ...props
}: WeaveTextureProps) {
  const id = `weave-${React.useId().replace(/:/g, '')}`;
  const c = CELL[density];
  const s = c * 2;
  const w = c * 0.55;
  const o = (c - w) / 2;

  // A thread is a band `w` wide down the middle of its cell.
  const warp = (x: number, y: number) => (
    <rect x={x + o} y={y} width={w} height={c} fill="var(--strand-a)" />
  );
  const weft = (x: number, y: number) => (
    <rect x={x} y={y + o} width={c} height={w} fill="var(--strand-b)" />
  );
  // Where the top thread crosses the one beneath, its two long sides are
  // edged in the page colour. Only across the crossing: an edge along the
  // whole cell would cut the thread where it runs on into the next cell.
  const over = (x: number, y: number, dir: 'warp' | 'weft') => {
    const [a, b] = [o, o + w];
    const lines =
      dir === 'warp'
        ? [
            [x + a, y + a, x + a, y + b],
            [x + b, y + a, x + b, y + b],
          ]
        : [
            [x + a, y + a, x + b, y + a],
            [x + a, y + b, x + b, y + b],
          ];
    return (
      <>
        {dir === 'warp' ? warp(x, y) : weft(x, y)}
        {lines.map(([x1, y1, x2, y2]) => (
          <line
            key={`${x1}-${y1}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--background)"
            strokeWidth={1}
          />
        ))}
      </>
    );
  };

  return (
    <svg
      data-slot="weave-texture"
      className={cn('pointer-events-none absolute inset-0 size-full', FADE[fade], className)}
      {...props}
      aria-hidden
      focusable="false"
    >
      <defs>
        <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
          {/* Cells (0,0) and (1,1): warp over weft. (1,0) and (0,1): weft over warp. */}
          {weft(0, 0)}
          {over(0, 0, 'warp')}
          {warp(c, 0)}
          {over(c, 0, 'weft')}
          {warp(0, c)}
          {over(0, c, 'weft')}
          {weft(c, c)}
          {over(c, c, 'warp')}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={STRENGTH[strength]} />
    </svg>
  );
}
