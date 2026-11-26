'use client';

/**
 * @interlace/ui — GridField
 *
 * Graph-paper lines (or a dot grid) behind a section, with a few cells that
 * slowly light up and fade, like squares being filled in on a worksheet. It
 * says "careful, measured work" without saying anything.
 *
 * ## Drawn the same everywhere
 *
 * The grid, lines or dots, is one SVG `<pattern>`, so a full-bleed field
 * costs one element, not hundreds. The lit cells come from a seeded
 * generator, so the server and the browser place them identically and
 * nothing jumps at hydration. Change `seed` for a different arrangement, or
 * pass `cells` to choose them yourself.
 *
 * ## Fading the edges
 *
 * `fade` masks the field so it dissolves toward the edges (`radial`), or
 * toward the top or bottom, which keeps the grid from competing with the
 * text laid over it.
 *
 * ## Following the pointer
 *
 * With `interactive`, the cell under the pointer lights up too. The field is
 * `pointer-events-none` so it never takes a click, which means it cannot hear
 * the pointer either; the listener goes on its parent, the surface it covers.
 * One highlight square moves from cell to cell, so a field of a thousand
 * cells is still one element plus one square.
 *
 * ## Out of the way
 *
 * The root is `aria-hidden` and `pointer-events-none`, and a caller cannot
 * turn either off. Lines default to `--border` and lit cells to `--primary`.
 *
 * ## Motion
 *
 * Each lit cell breathes on its own Web Animations API timeline, offset from
 * the others, and all of them pause off screen. Under
 * `prefers-reduced-motion: reduce` the cells hold at a soft, even glow, and
 * the pointer highlight moves without fading.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props (minus aria-hidden)                       |
 * | R6   | data-slot per part      | grid-field / -cell                                    |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R8   | Enums, not booleans     | `mark`, `fade`                                        |
 * | R19  | Tokens only             | `--border`, `--primary` defaults                      |
 * | R25  | Client component        | the breathing runs in the browser                     |
 * | R26  | A11y                    | hidden, inert to the pointer                          |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

const FADE = {
  none: '',
  radial: '[mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]',
  top: '[mask-image:linear-gradient(to_bottom,transparent,black_60%)]',
  bottom: '[mask-image:linear-gradient(to_top,transparent,black_60%)]',
} as const;

/** Mulberry32: a small seeded generator, the same sequence on every runtime. */
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

/** The board `GridField` lights cells on: columns and rows of `cell`-sized squares. */
const COLS = 32;
const ROWS = 16;

/** Cell positions (column, row) for `count` lit cells, on `GridField`'s board unless you name another. */
export function gridFieldCells(count: number, seed: number, cols = COLS, rows = ROWS) {
  const next = seeded(seed);
  const taken = new Set<string>();
  const cells: Array<[number, number]> = [];
  const max = Math.min(count, cols * rows);
  while (cells.length < max) {
    const c = Math.floor(next() * cols);
    const r = Math.floor(next() * rows);
    const key = `${c}:${r}`;
    if (taken.has(key)) continue;
    taken.add(key);
    cells.push([c, r]);
  }
  return cells;
}

export interface GridFieldProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'aria-hidden' | 'children'> {
  /** Draw the grid as lines or as dots at the crossings. @default 'lines' */
  mark?: 'lines' | 'dots';
  /** Size of one cell, in pixels. @default 40 */
  cell?: number;
  /** How many cells light up, placed by `seed`. Ignored when `cells` is set. @default 14 */
  lit?: number;
  /** The cells to light, as `[column, row]` pairs, instead of seeded ones. */
  cells?: ReadonlyArray<readonly [number, number]>;
  /** Changes which cells light up. @default 5 */
  seed?: number;
  /** Colour of the lines or dots. @default 'var(--border)' */
  lineColor?: string;
  /** Colour of the lit cells. @default 'var(--primary)' */
  litColor?: string;
  /** Strongest a lit cell gets, 0 to 1. @default 0.18 */
  intensity?: number;
  /** Where the field dissolves. @default 'radial' */
  fade?: keyof typeof FADE;
  /** Set false to hold the cells still even when motion is allowed. @default true */
  animated?: boolean;
  /** Light the cell under the pointer as well. @default false */
  interactive?: boolean;
}

export function GridField({
  mark = 'lines',
  cell = 40,
  lit = 14,
  cells: chosenCells,
  seed = 5,
  lineColor = 'var(--border)',
  litColor = 'var(--primary)',
  intensity = 0.18,
  fade = 'radial',
  animated = true,
  interactive = false,
  className,
  ...props
}: GridFieldProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const hoverRef = React.useRef<SVGRectElement>(null);
  const id = React.useId().replace(/:/g, '');
  const svgRef = React.useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const moving = animated && !reduced;
  const seededCells = React.useMemo(() => gridFieldCells(lit, seed), [lit, seed]);
  const cells = chosenCells ?? seededCells;
  // Keyed by value, so an inline `cells={[[0, 0]]}` does not restart the breathing each render.
  const cellsKey = cells.map(([c, r]) => `${c}:${r}`).join(' ');
  const peak = Math.min(Math.max(intensity, 0), 1);

  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !moving) return;
    const rects = Array.from(svg.querySelectorAll<SVGRectElement>('[data-slot=grid-field-cell]'));
    if (!rects.length || typeof rects[0]!.animate !== 'function') return;
    const next = seeded(seed + 1);
    const animations = rects.map((rect) =>
      rect.animate([{ opacity: 0 }, { opacity: peak }, { opacity: 0 }], {
        duration: 4000 + next() * 4000,
        delay: -next() * 8000,
        iterations: Infinity,
        easing: 'ease-in-out',
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
  }, [moving, cellsKey, seed, peak]);

  React.useEffect(() => {
    const root = rootRef.current;
    const hover = hoverRef.current;
    const surface = root?.parentElement;
    if (!interactive || !root || !hover || !surface) return;
    const onMove = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      const c = Math.floor((event.clientX - box.left) / cell);
      const r = Math.floor((event.clientY - box.top) / cell);
      hover.setAttribute('x', String(c * cell + 1));
      hover.setAttribute('y', String(r * cell + 1));
      hover.style.opacity = String(peak);
    };
    const onLeave = () => {
      hover.style.opacity = '0';
    };
    surface.addEventListener('pointermove', onMove, { passive: true });
    surface.addEventListener('pointerleave', onLeave);
    return () => {
      surface.removeEventListener('pointermove', onMove);
      surface.removeEventListener('pointerleave', onLeave);
    };
  }, [interactive, cell, peak]);

  return (
    <div
      ref={rootRef}
      data-slot="grid-field"
      className={cn('pointer-events-none absolute inset-0 z-backdrop overflow-hidden', FADE[fade], className)}
      {...props}
      aria-hidden
    >
      <svg ref={svgRef} className="absolute inset-0 size-full">
        <defs>
          <pattern id={`${id}-grid`} width={cell} height={cell} patternUnits="userSpaceOnUse">
            {mark === 'dots' ? (
              <circle cx={0.5} cy={0.5} r={1.25} fill={lineColor} />
            ) : (
              <path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke={lineColor} strokeWidth={1} />
            )}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id}-grid)`} />
        {cells.map(([c, r]) => (
          <rect
            key={`${c}:${r}`}
            data-slot="grid-field-cell"
            x={c * cell + 1}
            y={r * cell + 1}
            width={cell - 1}
            height={cell - 1}
            fill={litColor}
            opacity={moving ? 0 : peak * 0.6}
          />
        ))}
        {interactive ? (
          <rect
            ref={hoverRef}
            data-slot="grid-field-hover"
            width={cell - 1}
            height={cell - 1}
            fill={litColor}
            style={{ opacity: 0 }}
            className={reduced ? undefined : 'transition-opacity duration-300 ease-out'}
          />
        ) : null}
      </svg>
    </div>
  );
}
