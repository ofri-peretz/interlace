"use client"

/**
 * @interlace/ui — BorderBeam
 *
 * A single gradient square that travels around the inside edge of its parent,
 * drawn with `offset-path` and a two-layer CSS mask so only the border ring
 * shows. Drop it inside any `relative`, rounded container to give that
 * container a moving outline.
 *
 * It positions itself `absolute inset-0` and inherits the parent's radius, so
 * the only thing the parent has to supply is a stacking context.
 *
 * Our reimplementation of the Magic UI component of the same name, rebuilt on
 * CSS `offset-path` instead of Framer Motion — the whole effect is one
 * compositor-driven property and this file imports no animation library.
 *
 * ## Anatomy
 *
 *   div                              (absolute inset-0, rounded-[inherit],
 *                                     transparent border + mask-intersect —
 *                                     this is what clips the beam to the ring)
 *     └─ div.animate-border-beam     (the beam: an aspect-square gradient
 *                                     riding `offset-path: rect(… round Npx)`)
 *
 * ## Motion
 *
 * Pure CSS, and covered twice: `.animate-border-beam` is named in the
 * `prefers-reduced-motion: reduce` block in `styles/tokens.css`
 * (`animation: none !important`) and also caught by the `animation-duration`
 * wildcard in `styles/preflight.css`. There is no `useReducedMotion` call and
 * none is needed. Note what `reduce` leaves behind: with the animation off,
 * `offset-distance` sits at its initial `0%`, so the beam parks as a static
 * gradient square at the start of the path rather than disappearing.
 *
 * ## Colour, and why `--chart-2` is allowed here
 *
 * `colorFrom` / `colorTo` default to `var(--primary)` → `var(--chart-2)`, the
 * brand orange-to-green sweep. They were the raw literals `#ffaa40` / `#9c40ff`
 * (R19), which also meant the beam did not re-resolve per theme.
 *
 * `--chart-2` is a 3:1-class token, not a 4.5:1 one, and that is the right
 * choice HERE specifically: the beam is a decorative overlay inside a container
 * that draws its own `border`, so it is neither text (SC 1.4.3) nor the
 * boundary that identifies a control (SC 1.4.11) — remove it entirely and
 * nothing becomes unusable. Contrast `magicui/animated-gradient-text.tsx`,
 * where the gradient IS the glyph fill and both stops are consequently pinned
 * to text-grade tokens.
 *
 * ## One API edge worth knowing
 *
 * `className` lands on the BEAM element, not the wrapper. Use it to restyle
 * the travelling gradient; you cannot reach the masked ring from outside.
 */

import { cn } from "../lib/cn.js"

interface BorderBeamProps {
  /**
   * The size of the border beam.
   */
  size?: number
  /**
   * The duration of the border beam.
   */
  duration?: number
  /**
   * The delay of the border beam.
   */
  delay?: number
  /**
   * Leading colour of the travelling gradient.
   * @default "var(--primary)"
   */
  colorFrom?: string
  /**
   * Trailing colour of the travelling gradient, before it fades to transparent.
   * @default "var(--chart-2)"
   */
  colorTo?: string
  /**
   * The class name of the border beam.
   */
  className?: string
  /**
   * The style of the border beam.
   */
  style?: React.CSSProperties
  /**
   * Whether to reverse the animation direction.
   */
  reverse?: boolean
  /**
   * The initial offset position (0-100).
   */
  initialOffset?: number
  /**
   * The border width of the beam.
   */
  borderWidth?: number
}

/**
 * BorderBeam Component - Performance Optimized
 * 
 * Converted from Framer Motion to pure CSS animation for better GPU acceleration.
 * Uses CSS offset-path animation which is hardware-accelerated.
 */
export const BorderBeam = ({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = "var(--primary)",
  colorTo = "var(--chart-2)",
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1,
}: BorderBeamProps) => {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
        } as React.CSSProperties
      }
    >
      {/* Performance: Using CSS animation instead of Framer Motion */}
      <div
        className={cn(
          "absolute aspect-square animate-border-beam",
          "bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent",
          className
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
            "--border-beam-duration": `${duration}s`,
            "--border-beam-delay": `${-delay}s`,
            "--border-beam-initial": `${initialOffset}%`,
            "--border-beam-direction": reverse ? "reverse" : "normal",
            animationDelay: `${-delay}s`,
            ...style,
          } as React.CSSProperties
        }
      />
    </div>
  )
}
