/**
 * @interlace/ui — ShimmerButton
 *
 * A dark pill CTA with a conic-gradient spark that sweeps around its edge: a
 * rotating cone inside a sliding container, masked by an inset panel that
 * redraws the fill and leaves only the rim glowing.
 *
 * `shimmer` (the spark) and `highlight` (the inset white glow at the bottom
 * edge) toggle independently, so a secondary CTA can share the geometry
 * without inheriting either effect.
 *
 * Our reimplementation of the Magic UI component of the same name. What is
 * ours: the two effects are separately switchable (so a secondary CTA can keep
 * the geometry and drop the motion, or keep the spark and drop the white inset
 * glow that clashes with non-white fills), and `as` swaps the rendered element
 * so an anchor can wear the same shape.
 *
 * ## Anatomy
 *
 *   ShimmerButton                    (button | as — data-slot="shimmer-button",
 *                                     data-shimmer / data-highlight)
 *     ├─ div[data-shimmer-spark]     (container-type:size, -z-30, blur)
 *     │   └─ div.animate-shimmer-slide
 *     │       └─ div.animate-spin-around   (the conic gradient)
 *     ├─ children
 *     ├─ div[data-shimmer-highlight] (inset bottom-edge box-shadow glow)
 *     └─ div                         (inset:var(--cut) panel that re-paints
 *                                     --bg over the spark, leaving the rim)
 *
 * All tuning arrives as CSS custom properties on the root: `--spread`,
 * `--shimmer-color`, `--radius`, `--speed`, `--cut`, `--bg`, plus
 * `--shimmer-glow` / `--shimmer-glow-strong`, which are `--shimmer-color` at
 * 12% and 25% — the inset highlight is the same light source as the spark, so
 * it is derived rather than being a second colour to keep in sync.
 *
 * ## Motion
 *
 * Pure CSS, covered twice. Both `.animate-shimmer-slide` and
 * `.animate-spin-around` are named in the `prefers-reduced-motion: reduce`
 * block in `styles/tokens.css` (`animation: none !important`) and also caught
 * by the wildcard in `styles/preflight.css`. There is no `useReducedMotion`
 * call and none is needed. Under `reduce` the spark parks in place — it does
 * not vanish — so a static wedge of the conic gradient can remain visible at
 * the rim; pass `shimmer={false}` if you want it gone entirely. The press
 * feedback (`transition-transform … active:translate-y-px`) is a transition,
 * so the preflight duration clamp handles it.
 *
 * ## It is deliberately dark, on the scrim tokens
 *
 * This is the DS's one always-dark button, and `--scrim` / `--scrim-foreground`
 * are the tokens that mean exactly that: black-and-white that does NOT invert
 * per theme, because the surfaces they exist for (image scrims, this button)
 * are dark by intent rather than by mode. Both are `#000000` / `#ffffff` in
 * light and dark alike, so the pair measures 21:1 — SC 1.4.3 has all the room
 * it needs, and the `border-scrim-foreground/10` hairline is decoration, not a
 * 1.4.11 boundary.
 *
 * That is the whole reason the tokenisation is a no-op visually. It was
 * `text-white` / `border-white/10` / `rgba(0, 0, 0, 1)` / `#ffffff` — the same
 * four colours, spelled as literals, which meant a fork of the palette could
 * not reach them and R19 had a hole here.
 *
 * Pass `background` / `shimmerColor` and override the text colour via
 * `className` if you need it to follow the themed palette instead.
 */

import React, { ComponentPropsWithoutRef, CSSProperties } from "react"

import { cn } from "../lib/cn.js"

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string
  shimmerSize?: string
  borderRadius?: string
  shimmerDuration?: string
  background?: string
  className?: string
  children?: React.ReactNode
  /**
   * Render the rotating spark animation (the conic-gradient that sweeps
   * around the button). Defaults to `true`. Pass `false` to keep the pill
   * geometry and fill but drop the motion.
   */
  shimmer?: boolean
  /**
   * Render the inset white highlight at the bottom edge (a `box-shadow:
   * inset 0 -8px 10px #ffffff1f` glow). Defaults to `true`. Pass `false`
   * for a darker, flatter look that pairs cleanly with non-white fills.
   * Independent of `shimmer` — the two effects can be toggled separately
   * (e.g. shimmer on + highlight off = animated dark sibling).
   */
  highlight?: boolean
  as?: React.ElementType
}

export const ShimmerButton = React.forwardRef<
  HTMLButtonElement,
  ShimmerButtonProps
>(
  (
    {
      shimmerColor = "var(--scrim-foreground)",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "var(--scrim)",
      shimmer = true,
      highlight = true,
      className,
      children,
      as: Comp = "button",
      ...props
    },
    ref
  ) => {
    return (
      <Comp
        data-slot="shimmer-button"
        data-shimmer={shimmer ? "" : undefined}
        data-highlight={highlight ? "" : undefined}
        style={
          {
            "--spread": "90deg",
            "--shimmer-color": shimmerColor,
            "--radius": borderRadius,
            "--speed": shimmerDuration,
            "--cut": shimmerSize,
            "--bg": background,
            // The inset glow is the same light source as the spark, so it is
            // derived from `--shimmer-color` rather than being a second colour
            // to keep in sync. Computed here because Tailwind cannot emit an
            // arbitrary value it has to evaluate — the class below references
            // these as plain `var()`, which it can.
            "--shimmer-glow": `color-mix(in oklab, ${shimmerColor} 12%, transparent)`,
            "--shimmer-glow-strong": `color-mix(in oklab, ${shimmerColor} 25%, transparent)`,
          } as CSSProperties
        }
        className={cn(
          "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden [border-radius:var(--radius)] border border-scrim-foreground/10 px-6 py-3 whitespace-nowrap text-scrim-foreground [background:var(--bg)]",
          "transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px",
          className
        )}
        ref={ref}
        {...props}
      >
        {/* spark container — gated by `shimmer` prop so secondary CTAs can
            share ShimmerButton's geometry without inheriting its animation */}
        {shimmer && (
          <div
            data-shimmer-spark
            className={cn(
              "-z-30 blur-[2px]",
              "[container-type:size] absolute inset-0 overflow-visible"
            )}
          >
            {/* spark */}
            <div className="animate-shimmer-slide absolute inset-0 [aspect-ratio:1] h-[100cqh] [border-radius:0] [mask:none]">
              {/* spark before */}
              <div className="animate-spin-around absolute -inset-full w-auto [translate:0_0] rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
            </div>
          </div>
        )}
        {children}

        {/* Inset white highlight at the bottom edge — gated INDEPENDENTLY
            of `shimmer` so secondary CTAs can keep the rotating spark while
            dropping the white inset glow (which clashes with non-white
            fills like the dark slate secondary). */}
        {highlight && (
          <div
            data-shimmer-highlight
            className={cn(
              "absolute inset-0 size-full",

              "rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_var(--shimmer-glow)]",

              // transition
              "transform-gpu transition-all duration-300 ease-in-out",

              // on hover
              "group-hover:shadow-[inset_0_-6px_10px_var(--shimmer-glow-strong)]",

              // on click
              "group-active:shadow-[inset_0_-10px_10px_var(--shimmer-glow-strong)]"
            )}
          />
        )}

        <div
          className={cn(
            "absolute [inset:var(--cut)] -z-20 [border-radius:var(--radius)] [background:var(--bg)]"
          )}
        />
      </Comp>
    )
  }
)

ShimmerButton.displayName = "ShimmerButton"
