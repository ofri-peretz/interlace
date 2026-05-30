"use client";

import React, { forwardRef, useId } from "react";
import { motion } from "motion/react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/**
 * Spotlight — a soft, blurred conic glow that fades in to draw the eye toward
 * hero content. Adapted from the Aceternity UI "Spotlight" effect.
 *
 * Re-authored to the Interlace floor:
 *   - Self-contained reveal (no external `animate-spotlight` keyframe). The
 *     fade-and-drift is driven by `motion`, fully controllable via `duration`
 *     and `delay`, and disabled under `prefers-reduced-motion`.
 *   - Token-safe color: `fill` defaults to `currentColor`, so the glow
 *     inherits whatever text color its container sets — no hard-coded literal.
 *   - Consumer-agnostic: extends the native `<svg>` element, forwards `ref`,
 *     merges `className`, and spreads `...props`.
 *
 * Decorative by contract: rendered `aria-hidden`, `pointer-events-none`, and
 * absolutely positioned so it never participates in layout (CLS=0).
 *
 * @example
 * ```tsx
 * <div className="relative text-purple-300">
 *   <Spotlight data-testid="hero-spotlight" className="-top-40 left-0" />
 *   <h1>Your headline</h1>
 * </div>
 * ```
 */

// =========================================
// CONSTANTS
// =========================================

/**
 * The source artwork is authored at this viewBox; positions/radii below are
 * expressed in these units so the glow scales cleanly at any rendered size.
 */
const SPOTLIGHT_VIEWBOX = "0 0 3787 2842";

/** Gaussian blur radius (in viewBox units) that turns the ellipse into a glow. */
const BLUR_DEVIATION = 151;

// =========================================
// TYPES
// =========================================

/**
 * Native `<svg>` props minus the four animation/drag handlers whose DOM
 * signatures collide with `motion`'s own (it overloads them for gesture +
 * animation lifecycle callbacks). Omitting them lets us extend the native
 * element — per the floor — without a type conflict.
 */
type SpotlightNativeProps = Omit<
  React.ComponentPropsWithoutRef<"svg">,
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  // Native SVG `values` (a string, for <animate>/filter timing) collides with
  // motion's `values` (a MotionValue map). Not meaningful on the root <svg>.
  | "values"
>;

export interface SpotlightProps extends SpotlightNativeProps {
  /**
   * Required stable selector for E2E tests. Has no runtime default — the
   * consumer must provide one so omissions surface instead of being masked.
   */
  "data-testid": string;
  /**
   * Fill color of the glow. Accepts any CSS color *token* — a CSS custom
   * property (`var(--brand-accent)`), a Tailwind-driven keyword, or
   * `currentColor` to inherit the container's text color. Avoid raw hex/rgb
   * literals so the design system stays the single source of color truth.
   * @default "currentColor"
   */
  fill?: string;
  /**
   * Opacity of the glow once fully revealed, 0–1.
   * @default 0.21
   */
  fillOpacity?: number;
  /**
   * Duration of the fade-in reveal, in seconds. Ignored under
   * `prefers-reduced-motion` (the glow renders static at full opacity).
   * @default 1.5
   */
  duration?: number;
  /**
   * Delay before the reveal starts, in seconds. Ignored under
   * `prefers-reduced-motion`.
   * @default 0.2
   */
  delay?: number;
}

// =========================================
// COMPONENT
// =========================================

export const Spotlight = forwardRef<SVGSVGElement, SpotlightProps>(
  function Spotlight(
    {
      className,
      fill = "currentColor",
      fillOpacity = 0.21,
      duration = 1.5,
      delay = 0.2,
      ...props
    },
    ref,
  ) {
    const reduceMotion = useReducedMotion();
    // Namespace the filter id so multiple Spotlights on one page don't collide
    // on a shared `url(#filter)` reference.
    const rawId = useId();
    const filterId = `spotlight-blur-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    return (
      <motion.svg
        ref={ref}
        data-slot="spotlight"
        aria-hidden="true"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={SPOTLIGHT_VIEWBOX}
        fill="none"
        // Reduced motion: render the glow already-present, no animation.
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={
          reduceMotion ? undefined : { duration, delay, ease: "easeOut" }
        }
        className={cn(
          "pointer-events-none absolute z-[1] h-[169%] w-[138%] lg:w-[84%]",
          className,
        )}
        {...props}
      >
        <g filter={`url(#${filterId})`}>
          <ellipse
            cx="1924.71"
            cy="273.501"
            rx="1924.71"
            ry="273.501"
            transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
            fill={fill}
            fillOpacity={fillOpacity}
          />
        </g>
        <defs>
          <filter
            id={filterId}
            x="0.860352"
            y="0.838989"
            width="3785.16"
            height="2840.26"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="BackgroundImageFix"
              result="shape"
            />
            <feGaussianBlur
              stdDeviation={BLUR_DEVIATION}
              result="effect1_foregroundBlur"
            />
          </filter>
        </defs>
      </motion.svg>
    );
  },
);
