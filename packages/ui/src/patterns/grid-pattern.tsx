"use client";

/**
 * @interlace/ui — GridPattern
 *
 * A decorative SVG line grid that fills its positioned parent, with optional
 * accent cells (`squares`, addressed as `[column, row]`) that can pulse.
 * Colour comes from `currentColor`, so a text-colour class on `className` sets
 * the tone.
 *
 * The whole surface is `aria-hidden` and `pointer-events-none`.
 *
 * ## Anatomy
 *
 *   GridPattern                      (svg — data-slot="grid-pattern")
 *     ├─ defs > pattern              (one cell: `M.5 {h}V.5H{w}`, id from useId)
 *     ├─ rect 100%×100%              (fills the parent with the tiled pattern)
 *     └─ svg                         (data-slot="grid-pattern-squares")
 *         └─ rect | motion.rect      (data-slot="grid-pattern-square")
 *
 * ## Motion
 *
 * JS-driven, not CSS. The pulse is a `motion.rect` from `motion/react`
 * animating `opacity: [0.5, 1, 0.5]` on `repeat: Infinity` — inline styles the
 * `prefers-reduced-motion` reset in `styles/preflight.css` cannot reach. It is
 * gated in JS instead: `shouldAnimate = animated && !reducedMotion`, and when
 * that is false the accent cells render as plain `<rect>` elements with no
 * animation object at all. The grid lines themselves never animate.
 *
 * | Rule | Concept                     | Where in this file                                     |
 * | ---- | --------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el           | `ComponentPropsWithoutRef<'svg'>` + `forwardRef`       |
 * | R5   | testid required, no default | `'data-testid': string`                                |
 * | R6   | data-slot per part          | `grid-pattern` / `-squares` / `-square`                |
 * | R7   | className merged + ...rest  | `cn(BASE, className)` + `{...props}`                   |
 * | R8   | No `isXxx`                  | `animated`, `squares`, `dashArray`                     |
 * | R19  | Tokens only                 | `fill-current` / `stroke-current`; no colour prop      |
 * | R25  | Client component            | `useId` + `useReducedMotion`                           |
 * | R26  | A11y                        | `aria-hidden="true"` — decorative, never in the tree   |
 */

import { ComponentPropsWithoutRef, forwardRef, useId } from "react";
import { motion } from "motion/react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/**
 * A single highlighted cell, addressed by its column/row index in the grid
 * (not pixel coordinates). `[col, row]` — `[0, 0]` is the top-left cell.
 */
export type GridPatternSquare = [column: number, row: number];

interface GridPatternProps extends ComponentPropsWithoutRef<"svg"> {
  /**
   * Width of a single grid cell, in user-space units.
   * @default 40
   */
  cellWidth?: number;
  /**
   * Height of a single grid cell, in user-space units.
   * @default 40
   */
  cellHeight?: number;
  /**
   * Horizontal offset of the pattern origin, in user-space units. A small
   * negative value (the default) clips the leading edge so the grid bleeds
   * cleanly past the left edge of its container.
   * @default -1
   */
  offsetX?: number;
  /**
   * Vertical offset of the pattern origin, in user-space units.
   * @default -1
   */
  offsetY?: number;
  /**
   * Stroke width of the grid lines, in user-space units.
   * @default 1
   */
  strokeWidth?: number;
  /**
   * SVG `stroke-dasharray` for the grid lines. `"0"` draws solid lines;
   * e.g. `"4 2"` draws a dashed grid.
   * @default "0"
   */
  dashArray?: string;
  /**
   * Cells to fill as accents, each `[column, row]`. Filled cells inherit the
   * SVG's `fill`/`fill-opacity` (`currentColor` by default — set via a text
   * color utility on `className`).
   * @default undefined
   */
  squares?: GridPatternSquare[];
  /**
   * Pulse the accent `squares` with a soft opacity loop. Automatically forced
   * off when the user prefers reduced motion. Has no effect unless `squares`
   * is provided.
   * @default false
   */
  animated?: boolean;
  /**
   * Seconds for one full pulse cycle of an animated accent cell.
   * @default 4
   */
  animationDuration?: number;
  /**
   * Stable id for end-to-end selectors. Required at the type level — no runtime
   * default, so an omission surfaces in review rather than silently masking it.
   */
  "data-testid": string;
}

/**
 * GridPattern — a decorative, consumer-agnostic SVG grid backdrop.
 *
 * Renders a tiled line grid that fills its positioned parent, with optional
 * highlighted accent cells that can softly pulse. Purely decorative: marked
 * `aria-hidden` and `pointer-events-none` so it never enters the a11y tree or
 * intercepts clicks (R23).
 *
 * Color is driven by `currentColor` and Tailwind opacity utilities rather than
 * baked-in literals — set the grid tone with a text-color class on `className`
 * (e.g. `className="text-border/40"`). This keeps the component on design
 * tokens with zero raw color literals in source (R19).
 *
 * Motion respects `prefers-reduced-motion`: when `animated` is set but the user
 * opts out, accent cells render statically (R26, MOTION_PHILOSOPHY).
 *
 * @example
 * ```tsx
 * <div className="relative h-64 overflow-hidden text-border/30">
 *   <GridPattern data-testid="hero-grid" />
 * </div>
 * ```
 *
 * @example Animated accents
 * ```tsx
 * <GridPattern
 *   data-testid="features-grid"
 *   squares={[[2, 1], [5, 3], [8, 2]]}
 *   animated
 *   className="text-brand-500/20"
 * />
 * ```
 */
export const GridPattern = forwardRef<SVGSVGElement, GridPatternProps>(
  function GridPattern(
    {
      cellWidth = 40,
      cellHeight = 40,
      offsetX = -1,
      offsetY = -1,
      strokeWidth = 1,
      dashArray = "0",
      squares,
      animated = false,
      animationDuration = 4,
      className,
      ...props
    },
    ref,
  ) {
    const patternId = useId();
    const reducedMotion = useReducedMotion();
    // Reduced-motion preference overrides the consumer's `animated` opt-in —
    // re-animating against the user's wish would be the worse failure.
    const shouldAnimate = animated && !reducedMotion;

    return (
      <svg
        ref={ref}
        aria-hidden="true"
        data-slot="grid-pattern"
        className={cn(
          "pointer-events-none absolute inset-0 size-full fill-current stroke-current opacity-30",
          className,
        )}
        {...props}
      >
        <defs>
          <pattern
            id={patternId}
            width={cellWidth}
            height={cellHeight}
            patternUnits="userSpaceOnUse"
            x={offsetX}
            y={offsetY}
          >
            <path
              d={`M.5 ${cellHeight}V.5H${cellWidth}`}
              fill="none"
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
            />
          </pattern>
        </defs>

        <rect
          width="100%"
          height="100%"
          strokeWidth={0}
          fill={`url(#${patternId})`}
        />

        {squares && squares.length > 0 ? (
          <svg
            x={offsetX}
            y={offsetY}
            className="overflow-visible"
            data-slot="grid-pattern-squares"
          >
            {squares.map(([column, row]) => {
              const key = `${column}-${row}`;
              const x = column * cellWidth + 1;
              const y = row * cellHeight + 1;
              const width = cellWidth - 1;
              const height = cellHeight - 1;

              return shouldAnimate ? (
                <motion.rect
                  key={key}
                  data-slot="grid-pattern-square"
                  strokeWidth={0}
                  width={width}
                  height={height}
                  x={x}
                  y={y}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{
                    duration: animationDuration,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ) : (
                <rect
                  key={key}
                  data-slot="grid-pattern-square"
                  strokeWidth={0}
                  width={width}
                  height={height}
                  x={x}
                  y={y}
                />
              );
            })}
          </svg>
        ) : null}
      </svg>
    );
  },
);
