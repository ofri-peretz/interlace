"use client";

/**
 * @interlace/ui — AnimatedGridPattern (decorative background primitive)
 *
 * A tiled SVG grid where a handful of cells softly pulse in and out, then
 * teleport to a new random cell on each cycle — a "breathing" graph-paper
 * backdrop for heroes and section bands. Re-authored from the MagicUI
 * pattern to the Interlace component floor.
 *
 * | Rule | Concept                          | Where in this file                                                                 |
 * | ---- | -------------------------------- | ---------------------------------------------------------------------------------- |
 * | R4   | Extends native el + JSDoc        | `ComponentPropsWithoutRef<"svg">`; every public prop documented with `@default`    |
 * | R5   | `data-testid` typed, no default  | `"data-testid"?: string` — consumer supplies the selector                          |
 * | R6   | `data-slot` on the root          | `data-slot="animated-grid-pattern"` on the `<svg>`                                 |
 * | R7   | className merged + ...rest + ref | `cn(...)`, `{...props}`, `ref` forwarded to the root `<svg>`                        |
 * | R8   | Booleans no `isXxx`              | No boolean props; numeric/string knobs only                                        |
 * | R18  | Tailwind only                    | No inline `style`; geometry is SVG attributes, color is a Tailwind class           |
 * | R19  | Tokens only — no raw color       | Color via `currentColor` (default class `text-fd-muted-foreground/20`); no hex     |
 * | R23  | CLS=0                            | `absolute inset-0 pointer-events-none` decorative chrome — reserves no flow space  |
 * | R25  | Perf — `'use client'` justified  | Reads `ResizeObserver` + `useReducedMotion`; gated to interactive use only         |
 * | R26  | A11y                            | `aria-hidden` — purely decorative, never announced; zero axe suppressions          |
 *
 * ## API parity
 *
 * Mirrors the MagicUI `AnimatedGridPattern` prop surface (width / height /
 * x / y / strokeDasharray / numSquares / maxOpacity / duration /
 * repeatDelay) so the swap is drop-in. Deviations from upstream, each with
 * a reason:
 *   - Upstream hard-codes `fill-gray-400/30 stroke-gray-400/30` and
 *     `fill="currentColor"`. We drop the literal gray classes and inherit
 *     `currentColor` from a tokenized default class — color is now themeable
 *     by the consumer via `text-*` utilities (R19).
 *   - Upstream has no reduced-motion path; we read `useReducedMotion()` and
 *     render a static grid (no pulsing cells) when the user opts out (R26).
 *   - `numSquares` is clamped to the number of grid cells that actually fit,
 *     so a small container can't request 50 squares into a 12-cell grid and
 *     stack invisible duplicates.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { motion } from "motion/react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

interface AnimatedGridPatternProps extends ComponentPropsWithoutRef<"svg"> {
  /**
   * Width of a single grid cell, in pixels.
   * @default 40
   */
  width?: number;
  /**
   * Height of a single grid cell, in pixels.
   * @default 40
   */
  height?: number;
  /**
   * Horizontal offset of the pattern origin, in pixels. A small negative
   * value hides the seam at the left edge.
   * @default -1
   */
  x?: number;
  /**
   * Vertical offset of the pattern origin, in pixels. A small negative
   * value hides the seam at the top edge.
   * @default -1
   */
  y?: number;
  /**
   * Dash length for the grid lines. `0` draws solid lines.
   * @default 0
   */
  strokeDasharray?: number;
  /**
   * Number of cells pulsing at once. Clamped to the cells that fit the
   * measured container so a small surface never requests more than it has.
   * @default 50
   */
  numSquares?: number;
  /**
   * Peak opacity each cell fades to at the top of its pulse (0–1).
   * @default 0.5
   */
  maxOpacity?: number;
  /**
   * Duration of a single fade-in/out cycle, in seconds.
   * @default 4
   */
  duration?: number;
  /**
   * Pause between a cell finishing its cycle and teleporting to a new
   * position, in seconds.
   * @default 0.5
   */
  repeatDelay?: number;
  /**
   * Stable selector for E2E tests. Consumer supplies it — no runtime
   * default, so an omission is visible in test failures rather than masked.
   */
  "data-testid"?: string;
}

interface CellMeta {
  id: number;
  pos: [number, number];
  iteration: number;
}

const MIN_CELLS = 1;

/**
 * AnimatedGridPattern — a tiled SVG grid with softly pulsing cells.
 *
 * Decorative by contract: `aria-hidden` and `pointer-events-none`, absolutely
 * positioned to fill its nearest positioned ancestor. Respects
 * `prefers-reduced-motion` by rendering a static grid with no pulsing cells.
 *
 * @example
 * ```tsx
 * <div className="relative overflow-hidden">
 *   <AnimatedGridPattern
 *     numSquares={30}
 *     maxOpacity={0.4}
 *     className="text-fd-primary/20 [mask-image:radial-gradient(400px_circle_at_center,white,transparent)]"
 *   />
 * </div>
 * ```
 */
const AnimatedGridPattern = forwardRef<SVGSVGElement, AnimatedGridPatternProps>(
  function AnimatedGridPattern(
    {
      width = 40,
      height = 40,
      x = -1,
      y = -1,
      strokeDasharray = 0,
      numSquares = 50,
      maxOpacity = 0.5,
      duration = 4,
      repeatDelay = 0.5,
      className,
      "data-testid": testId,
      ...props
    },
    ref,
  ) {
    const patternId = useId();
    const containerRef = useRef<SVGSVGElement | null>(null);
    const reducedMotion = useReducedMotion();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [cells, setCells] = useState<CellMeta[]>([]);

    // Clamp the requested count to the cells that actually fit; an
    // unmeasured container yields 0, which renders nothing until measured.
    const cellCount = useMemo(() => {
      if (!dimensions.width || !dimensions.height) return 0;
      const cols = Math.floor(dimensions.width / width);
      const rows = Math.floor(dimensions.height / height);
      const capacity = Math.max(MIN_CELLS, cols * rows);
      return Math.min(numSquares, capacity);
    }, [dimensions.width, dimensions.height, width, height, numSquares]);

    const getPos = useCallback(
      (): [number, number] => [
        Math.floor((Math.random() * dimensions.width) / width),
        Math.floor((Math.random() * dimensions.height) / height),
      ],
      [dimensions.height, dimensions.width, height, width],
    );

    const generateCells = useCallback(
      (count: number): CellMeta[] =>
        Array.from({ length: count }, (_, i) => ({
          id: i,
          pos: getPos(),
          iteration: 0,
        })),
      [getPos],
    );

    // Teleport a single cell to a fresh position once its pulse completes.
    const recycleCell = useCallback(
      (cellId: number) => {
        setCells((current) => {
          const cell = current[cellId];
          if (!cell || cell.id !== cellId) return current;
          const next = current.slice();
          next[cellId] = {
            ...cell,
            pos: getPos(),
            iteration: cell.iteration + 1,
          };
          return next;
        });
      },
      [getPos],
    );

    // (Re)seed the pulsing cells whenever the measured size or count changes.
    useEffect(() => {
      if (cellCount > 0) {
        setCells(generateCells(cellCount));
      } else {
        setCells([]);
      }
    }, [cellCount, generateCells]);

    // Measure the container so cell positions land on real grid coordinates.
    useEffect(() => {
      const element = containerRef.current;
      if (!element || typeof ResizeObserver === "undefined") return;

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setDimensions((current) => {
            const nextWidth = entry.contentRect.width;
            const nextHeight = entry.contentRect.height;
            if (current.width === nextWidth && current.height === nextHeight) {
              return current;
            }
            return { width: nextWidth, height: nextHeight };
          });
        }
      });

      observer.observe(element);
      return () => observer.disconnect();
    }, []);

    const setRefs = useCallback(
      (node: SVGSVGElement | null) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    return (
      <svg
        ref={setRefs}
        data-slot="animated-grid-pattern"
        data-testid={testId}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full fill-current stroke-current text-fd-muted-foreground/20",
          className,
        )}
        {...props}
      >
        <defs>
          <pattern
            id={patternId}
            width={width}
            height={height}
            patternUnits="userSpaceOnUse"
            x={x}
            y={y}
          >
            <path
              d={`M.5 ${height}V.5H${width}`}
              fill="none"
              strokeDasharray={strokeDasharray}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        <svg x={x} y={y} className="overflow-visible">
          {cells.map(({ pos: [cellX, cellY], id, iteration }, index) =>
            reducedMotion ? (
              // Reduced motion: a static accent cell, no pulsing.
              <rect
                key={`${id}-static`}
                width={width - 1}
                height={height - 1}
                x={cellX * width + 1}
                y={cellY * height + 1}
                fill="currentColor"
                strokeWidth="0"
                opacity={maxOpacity}
              />
            ) : (
              <motion.rect
                key={`${id}-${iteration}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: maxOpacity }}
                transition={{
                  duration,
                  repeat: 1,
                  delay: index * 0.1,
                  repeatType: "reverse",
                  repeatDelay,
                }}
                onAnimationComplete={() => recycleCell(id)}
                width={width - 1}
                height={height - 1}
                x={cellX * width + 1}
                y={cellY * height + 1}
                fill="currentColor"
                strokeWidth="0"
              />
            ),
          )}
        </svg>
      </svg>
    );
  },
);

export { AnimatedGridPattern };
export type { AnimatedGridPatternProps };
