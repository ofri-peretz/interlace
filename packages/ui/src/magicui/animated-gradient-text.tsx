/**
 * @interlace/ui — AnimatedGradientText
 *
 * Gradient-filled text: a `bg-clip-text text-transparent` span whose
 * three-stop linear gradient slides horizontally on a loop. Built for a short
 * eyebrow, badge or headline fragment — never a paragraph, since the text has
 * no solid fill to fall back to.
 *
 * Our reimplementation of the Magic UI component of the same name. It is a
 * single span plus one keyframe, so the whole effect lives in three places:
 * this file, `--animate-gradient` in `styles/tokens.css`, and the `gradient`
 * keyframe next to it.
 *
 * ## Anatomy
 *
 *   AnimatedGradientText             (span — .animate-gradient)
 *     └─ children                    (painted through the clipped gradient)
 *
 * ## Motion
 *
 * Pure CSS, and covered twice. `.animate-gradient` is named in the
 * `prefers-reduced-motion: reduce` block in `styles/tokens.css`, which sets
 * `animation: none !important`, and it is also caught by the
 * `animation-duration: 0.01ms` wildcard in `styles/preflight.css`. There is no
 * `useReducedMotion` call here and none is needed. Under `reduce` the gradient
 * stops moving but still paints, so the text stays readable.
 *
 * ## `speed` changes distance, not duration
 *
 * The animation is a fixed `8s linear infinite`. `speed` sets
 * `--bg-size: speed × 300%`, and the keyframe animates
 * `background-position` to `var(--bg-size)`, so a larger `speed` moves the
 * gradient further in the same eight seconds — which reads as faster.
 *
 * ## The gradient IS the text, so both stops are text-grade tokens
 *
 * `colorFrom` / `colorTo` default to `var(--primary)` → `var(--primary-active)`.
 * The span is `bg-clip-text text-transparent`: there is no solid fill
 * underneath, so the gradient stops are the glyph colour and SC 1.4.3's 4.5:1
 * binds on every one of them. Both defaults are measured body-text tokens in
 * both schemes — 8.80:1 and 13.76:1 on light, 11.79:1 and 14.68:1 on dark
 * (`styles/interlace-theme.css`). A `--chart-*` token would NOT be admissible
 * here even though it is on the token system, because those are tuned to the
 * 3:1 graphical floor; `magicui/border-beam.tsx` may use one precisely because
 * nothing there is text.
 *
 * The previous defaults were the raw literals `#ffaa40` and `#9c40ff`. Beyond
 * being off the token system (R19), `#ffaa40` measures ≈2:1 on white — a real
 * AA failure, on text, in the DS's default surface.
 *
 * Override with any CSS colour, but keep the constraint in mind: whatever you
 * pass is being read as words.
 */

import { ComponentPropsWithoutRef } from "react"

import { cn } from "../lib/cn.js"

export interface AnimatedGradientTextProps extends ComponentPropsWithoutRef<"span"> {
  /**
   * How far the gradient travels in the fixed 8s cycle, as a multiplier on
   * `--bg-size`. Larger reads as faster. @default 1
   */
  speed?: number
  /**
   * First and third gradient stop — the colour the text starts and ends on.
   * This is the GLYPH FILL, so it must clear SC 1.4.3 against whatever surface
   * the text sits on. @default "var(--primary)"
   */
  colorFrom?: string
  /**
   * Middle gradient stop. Same contrast constraint as `colorFrom`.
   * @default "var(--primary-active)"
   */
  colorTo?: string
}

export function AnimatedGradientText({
  children,
  className,
  speed = 1,
  colorFrom = "var(--primary)",
  colorTo = "var(--primary-active)",
  ...props
}: AnimatedGradientTextProps) {
  return (
    <span
      style={
        {
          "--bg-size": `${speed * 300}%`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as React.CSSProperties
      }
      className={cn(
        `animate-gradient inline bg-gradient-to-r from-[var(--color-from)] via-[var(--color-to)] to-[var(--color-from)] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent`,
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
