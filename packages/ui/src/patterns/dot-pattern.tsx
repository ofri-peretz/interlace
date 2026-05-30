"use client";

/**
 * @interlace/ui — DotPattern (decorative background pattern)
 *
 * A resolution-independent dotted-grid background that fills its positioned
 * container. Two render modes share one tiled SVG `<pattern>`:
 *
 *   - **static** (default): a single tiled `<rect>` paints the whole grid as
 *     one GPU-cheap fill — O(1) DOM nodes regardless of container size.
 *   - **glow**: a radial-gradient dot is animated per-cell. We still bound the
 *     work — glow renders individual `<circle>`s only for the measured tile
 *     count, gated entirely behind `prefers-reduced-motion`.
 *
 * | Rule | Concept                          | Where in this file                                                       |
 * | ---- | -------------------------------- | ------------------------------------------------------------------------ |
 * | R2   | Travels (high)                   | Pure decoration, zero product nouns — any site can drop it behind a hero |
 * | R4   | Extends native el + JSDoc        | `ComponentPropsWithoutRef<"svg">`; `@default` on every public prop       |
 * | R5   | `data-testid` typed, no default  | `"data-testid"?: string` — consumer supplies                            |
 * | R6   | `data-slot` on the root          | `data-slot="dot-pattern"`                                                |
 * | R7   | className merged + ...rest + ref | `cn(...)` + `{...props}` + forwarded `ref`                               |
 * | R8   | Booleans default-false, no `is`  | `glow = false`                                                          |
 * | R18  | Tailwind only                    | No inline static styles; SVG geometry uses numeric attrs                |
 * | R19  | Tokens only                      | `currentColor` + the `color` prop; no raw hex / rgb / oklch             |
 * | R23  | CLS=0                            | `absolute inset-0` decorative chrome; no async height                   |
 * | R25  | `"use client"` only as needed    | Required — `useId` + motion + reduced-motion hook                       |
 * | R26  | a11y                             | `aria-hidden` + `pointer-events-none`; respects reduced motion          |
 *
 * ## API parity
 *
 * No MUI / shadcn analogue exists for a decorative dot grid; the closest
 * ecosystem reference is MagicUI's `DotPattern`, which inspired the visual
 * intent. We diverge deliberately: (1) the static mode tiles one SVG
 * `<pattern>` instead of emitting one `<motion.circle>` per cell, so a
 * full-bleed background is O(1) nodes rather than thousands; (2) dot color is
 * a first-class `color` prop defaulting to `currentColor` (the source
 * hard-coded a `text-neutral-400/80` class); (3) glow honors
 * `prefers-reduced-motion` and falls back to the static tile.
 */

import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { motion } from "motion/react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

interface DotPatternProps extends ComponentPropsWithoutRef<"svg"> {
  /**
   * Horizontal spacing between dot centers, in pixels.
   * @default 16
   */
  spacingX?: number;
  /**
   * Vertical spacing between dot centers, in pixels.
   * @default 16
   */
  spacingY?: number;
  /**
   * Horizontal offset of the whole tile, in pixels — shifts the grid origin.
   * @default 0
   */
  offsetX?: number;
  /**
   * Vertical offset of the whole tile, in pixels — shifts the grid origin.
   * @default 0
   */
  offsetY?: number;
  /**
   * Position of each dot within its own cell on the x axis, in pixels.
   * @default 1
   */
  dotX?: number;
  /**
   * Position of each dot within its own cell on the y axis, in pixels.
   * @default 1
   */
  dotY?: number;
  /**
   * Radius of each dot, in pixels.
   * @default 1
   */
  radius?: number;
  /**
   * Dot color. Accepts any CSS color string, but prefer a design token or
   * `currentColor` so the pattern inherits the surrounding text color — keep
   * raw literals out of consuming source per the token contract.
   * @default "currentColor"
   */
  color?: string;
  /**
   * Animate each dot with a soft radial pulse. Automatically disabled when the
   * user requests reduced motion, falling back to the static tile.
   * @default false
   */
  glow?: boolean;
  /**
   * Stable selector for E2E tests; consumer supplies — no runtime default.
   */
  "data-testid"?: string;
}

interface GlowDot {
  cx: number;
  cy: number;
  delay: number;
  duration: number;
}

const GLOW_DELAY_MAX_S = 5;
const GLOW_DURATION_MIN_S = 2;
const GLOW_DURATION_SPREAD_S = 3;

/**
 * DotPattern — a tiled dotted-grid background for any positioned container.
 *
 * Render it as the first child of a `relative` parent; it fills the parent via
 * `absolute inset-0`, is `aria-hidden`, and never captures pointer events.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <DotPattern className="text-fd-muted-foreground/40" data-testid="hero-dots" />
 *   <Content />
 * </div>
 * ```
 *
 * @example
 * ```tsx
 * // Glowing, wider grid (auto-static under prefers-reduced-motion)
 * <DotPattern glow spacingX={24} spacingY={24} data-testid="cta-dots" />
 * ```
 */
const DotPattern = forwardRef<SVGSVGElement, DotPatternProps>(
  function DotPattern(
    {
      spacingX = 16,
      spacingY = 16,
      offsetX = 0,
      offsetY = 0,
      dotX = 1,
      dotY = 1,
      radius = 1,
      color = "currentColor",
      glow = false,
      className,
      "data-testid": testId,
      ...props
    },
    forwardedRef,
  ) {
    const id = useId();
    const gradientId = `${id}-glow`;
    const patternId = `${id}-tile`;

    const reducedMotion = useReducedMotion();
    const isGlowing = glow && !reducedMotion;

    // Glow mode needs measured dimensions to lay out one animated circle per
    // cell. Static mode never measures — the tiled <pattern> fills any size.
    const svgRef = useRef<SVGSVGElement>(null);
    useImperativeHandle(forwardedRef, () => svgRef.current as SVGSVGElement);

    const [size, setSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
      if (!isGlowing) return;
      const node = svgRef.current;
      if (!node) return;

      const measure = () => {
        const rect = node.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });
      };
      measure();

      // ResizeObserver tracks container reflow without a global resize
      // listener — fewer cross-component listeners, scoped to this node.
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    }, [isGlowing]);

    const cols = spacingX > 0 ? Math.ceil(size.width / spacingX) : 0;
    const rows = spacingY > 0 ? Math.ceil(size.height / spacingY) : 0;

    const glowDots: GlowDot[] = isGlowing
      ? Array.from({ length: cols * rows }, (_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          return {
            cx: col * spacingX + offsetX + dotX,
            cy: row * spacingY + offsetY + dotY,
            delay: Math.random() * GLOW_DELAY_MAX_S,
            duration:
              Math.random() * GLOW_DURATION_SPREAD_S + GLOW_DURATION_MIN_S,
          };
        })
      : [];

    return (
      <svg
        ref={svgRef}
        data-slot="dot-pattern"
        data-testid={testId}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full",
          className,
        )}
        {...props}
      >
        <defs>
          <radialGradient id={gradientId}>
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          {!isGlowing && (
            <pattern
              id={patternId}
              x={offsetX}
              y={offsetY}
              width={spacingX}
              height={spacingY}
              patternUnits="userSpaceOnUse"
              patternContentUnits="userSpaceOnUse"
            >
              <circle cx={dotX} cy={dotY} r={radius} fill={color} />
            </pattern>
          )}
        </defs>

        {isGlowing ? (
          glowDots.map((dot) => (
            <motion.circle
              key={`${dot.cx}-${dot.cy}`}
              cx={dot.cx}
              cy={dot.cy}
              r={radius}
              fill={`url(#${gradientId})`}
              initial={{ opacity: 0.4, scale: 1 }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.5, 1] }}
              transition={{
                duration: dot.duration,
                repeat: Infinity,
                repeatType: "reverse",
                delay: dot.delay,
                ease: "easeInOut",
              }}
            />
          ))
        ) : (
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        )}
      </svg>
    );
  },
);

export { DotPattern };
export type { DotPatternProps };
