"use client"

/**
 * @interlace/ui — NumberTicker
 *
 * A count-up number that starts when it scrolls into view and eases to
 * `value`. It does nothing by default: `startValue` defaults to `value`, so
 * you get an honest static number — and an honest SSR render — until you pass
 * a lower one to opt into the count.
 *
 * Our reimplementation of the Magic UI component of the same name, rebuilt on
 * `requestAnimationFrame` + an ease-out-expo curve instead of Framer Motion
 * springs, which drops `motion/react` from the bundle for this component.
 *
 * ## Anatomy
 *
 *   NumberTicker                     (span — tabular-nums, formatted via Intl)
 *
 * There is one element. The count writes `ref.current.textContent` directly
 * on each frame rather than re-rendering, so React never sees the intermediate
 * values.
 *
 * ## Motion
 *
 * JS-driven — an `IntersectionObserver` at `threshold: 0.1` arms it, then a
 * `requestAnimationFrame` loop runs it. Neither is reachable by the CSS
 * `prefers-reduced-motion` reset in `styles/preflight.css`, so the contract is
 * enforced in JS: `useReducedMotion()` makes one effect write the final
 * formatted value straight to the node, and makes the animation effect return
 * before it ever constructs the observer. Under `reduce` the number is simply
 * correct from the start, and no observer is attached.
 *
 * The count fires once per mount — `hasAnimated` latches, so a `value` that
 * changes later updates nothing until remount.
 *
 * ## Colour
 *
 * `text-foreground` — the same token body copy uses, which is what a stat
 * inline in a sentence should inherit. It was `text-black dark:text-white`, a
 * hand-rolled approximation of that token that stopped being true under any
 * theme whose foreground is not pure black/white (both shipped ones:
 * `--interlace-foreground` is `#0d0b09` light, `#f0ede9` dark). Override via
 * `className` when the surrounding surface is not the page background.
 *
 * ## Formatting
 *
 * `Intl.NumberFormat("en-US", …)`, on every frame and on the SSR render, so
 * the string never changes shape mid-count. `notation` is forwarded straight
 * through and defaults to `"standard"` — Intl's own default — so nothing moves
 * for an existing caller.
 *
 * `notation="compact"` exists because six-figure stats overflow a tile.
 * `128,400` is eight glyphs at `tabular-nums`; in a stat card at the 320px
 * floor that wraps or clips, and every consumer so far has re-patched the same
 * `Intl` option locally rather than reaching for a prop that did not exist.
 * `128K` is four. The count still animates through the compact form, which is
 * the point: the width is stable for the whole run instead of growing a digit
 * at a time.
 *
 * Pair it with `decimalPlaces`: compact + `decimalPlaces={0}` rounds `128400`
 * to `128K`, compact + `decimalPlaces={1}` gives `128.4K`.
 *
 * ## One API edge worth knowing
 *
 * Units are mixed: `duration` is milliseconds (default 1500) but `delay` is
 * seconds (`Date.now() + delay * 1000`).
 */

import { ComponentPropsWithoutRef, useCallback, useEffect, useRef, useState } from "react"

import { cn } from "../lib/cn.js"
import { useReducedMotion } from "../lib/use-reduced-motion.js"

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number
  /**
   * Where the count-up starts. Defaults to `value` — meaning **no animation**
   * and an honest SSR render (UX_PHILOSOPHY §6: "ease of use is performance"
   * — a stat that says `0` on first paint reads as broken). Pass an explicit
   * lower number to opt into the count-up effect.
   */
  startValue?: number
  direction?: "up" | "down"
  delay?: number
  decimalPlaces?: number
  /**
   * `Intl.NumberFormat` notation, forwarded verbatim.
   *
   * Defaults to `"standard"`, which is Intl's own default — so leaving it
   * unset is byte-identical to the pre-prop behaviour. Use `"compact"` for
   * six-figure metrics in a fixed-width tile (`128400` → `128K`), where the
   * grouped form overflows at the 320px floor.
   * @default "standard"
   */
  notation?: Intl.NumberFormatOptions["notation"]
  /** Duration of animation in ms (default: 1500) */
  duration?: number
}

/**
 * NumberTicker - Performance Optimized
 *
 * Uses requestAnimationFrame + easeOutExpo instead of Framer Motion springs.
 * This reduces the JS bundle size and eliminates the motion/react dependency
 * for a simple counting animation.
 */
export function NumberTicker({
  value,
  startValue,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  notation = "standard",
  duration = 1500,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)
  const reduceMotion = useReducedMotion()
  const from = startValue ?? value
  const shouldAnimate = from !== value

  // Format number with locale (memoized to prevent useEffect recreation).
  // `notation` joins the dep list — a formatter memoized on the old deps alone
  // would keep the previous notation for the life of the mount.
  const formatNumber = useCallback((num: number) =>
    Intl.NumberFormat("en-US", {
      notation,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(Number(num.toFixed(decimalPlaces))), [decimalPlaces, notation])

  // Reduced-motion: jump straight to the final value — no easing, no observer.
  useEffect(() => {
    if (reduceMotion && ref.current) {
      ref.current.textContent = formatNumber(value)
    }
  }, [reduceMotion, value, formatNumber])

  useEffect(() => {
    if (!ref.current || hasAnimated || reduceMotion || !shouldAnimate) return

    // IntersectionObserver to trigger when in view
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)

          const startTime = Date.now() + delay * 1000
          const animFrom = direction === "down" ? value : from
          const to = direction === "down" ? from : value
          
          const animate = () => {
            const now = Date.now()
            if (now < startTime) {
              requestAnimationFrame(animate)
              return
            }
            
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            
            // Ease out expo for smooth deceleration
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
            const current = animFrom + (to - animFrom) * eased
            
            if (ref.current) {
              ref.current.textContent = formatNumber(current)
            }
            
            if (progress < 1) {
              requestAnimationFrame(animate)
            }
          }
          
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, from, direction, delay, duration, decimalPlaces, hasAnimated, formatNumber, reduceMotion, shouldAnimate])

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block tracking-wider text-foreground tabular-nums",
        className
      )}
      {...props}
    >
      {formatNumber(from)}
    </span>
  )
}
