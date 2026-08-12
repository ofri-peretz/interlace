"use client";

/**
 * @interlace/ui — Marquee
 *
 * An infinitely scrolling strip: it renders its children `repeat` times side
 * by side (or stacked, with `vertical`) inside an `overflow-hidden` track and
 * translates each copy by its own width plus the gap, so the row reads as
 * continuous.
 *
 * Logo walls, testimonial rails, ticker strips.
 *
 * Our reimplementation of the Magic UI component of the same name. What is
 * ours: the visible, Tab-reachable pause button and the reduced-motion gate.
 *
 * ## Anatomy
 *
 *   div.relative
 *     ├─ div                         (track — overflow-hidden, --duration:40s,
 *     │                               --gap:1rem, flex-row or flex-col)
 *     │   └─ div ×repeat             (.animate-marquee / -vertical, each
 *     │                               carrying the same children)
 *     └─ button                      (play/pause, aria-pressed, top-right)
 *
 * ## Motion
 *
 * A CSS keyframe (`--animate-marquee` in `styles/tokens.css`) covered three
 * ways under `prefers-reduced-motion: reduce`: the `animation: none` block in
 * `tokens.css` names both marquee classes, the wildcard in `preflight.css`
 * clamps the duration, and this component reads the preference in JS and adds
 * `[animation-play-state:paused]`. Nothing depends on a single layer.
 *
 * Two things the layering decides:
 *
 * - `isAnimating` is `!paused && !reducedMotion`: reduced motion outranks the
 *   click, so the button could never resume under `reduce`. It is therefore
 *   not rendered at all there (`showControl`), rather than shipped as a "Play"
 *   control that does nothing. Same call as `AnimatedList`.
 * - `pauseOnHover` is a `group-hover:` class on the track, so it pauses on
 *   pointer only. The button is the keyboard path, which is why
 *   `showPauseControl` defaults to `true` — WCAG 2.2.2 (Pause, Stop, Hide)
 *   applies to anything auto-scrolling for more than five seconds, and the
 *   default duration is 40.
 */

import { ComponentPropsWithoutRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

interface MarqueeProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Optional CSS class name to apply custom styles
   */
  className?: string;
  /**
   * Whether to reverse the animation direction
   * @default false
   */
  reverse?: boolean;
  /**
   * Whether to pause the animation on hover
   * @default false
   */
  pauseOnHover?: boolean;
  /**
   * Content to be displayed in the marquee
   */
  children: React.ReactNode;
  /**
   * Whether to animate vertically instead of horizontally
   * @default false
   */
  vertical?: boolean;
  /**
   * Number of times to repeat the content
   * @default 2
   */
  repeat?: number;
  /**
   * Render a visible play/pause button (WCAG 2.2.2 compliance for any
   * marquee that runs longer than 5 seconds). Defaults to true — turn off
   * only when the marquee is wrapped by another control surface that also
   * exposes pause (e.g. a dashboard widget with its own toolbar).
   * @default true
   */
  showPauseControl?: boolean;
  /**
   * Accessible label for the pause/play control. Customize when the marquee
   * has a specific role (e.g. "Pause sponsor logos").
   * @default "Pause scrolling content"
   */
  pauseLabel?: string;
}

/**
 * Marquee — see the file header for the motion contract and its edges.
 */
export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 2, // Performance: Reduced from 4 to 2 (50% fewer DOM nodes)
  showPauseControl = true,
  pauseLabel = "Pause scrolling content",
  ...props
}: MarqueeProps) {
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  // The animation is "running" iff the user hasn't explicitly paused it AND
  // they don't have reduced-motion preference. Reduced motion overrides the
  // user's button click — anything else would re-animate when they don't want it.
  const isAnimating = !paused && !reducedMotion;
  // …and because `reduce` outranks the click, the control is withdrawn rather
  // than rendered inert. WCAG 2.2.2 asks for a mechanism to pause auto-updating
  // content; under `reduce` nothing is updating, so there is nothing to offer —
  // and a "Play" button that cannot play is a worse answer than no button.
  // Matches `AnimatedList`.
  const showControl = showPauseControl && !reducedMotion;

  return (
    <div className="relative">
      <div
        {...props}
        className={cn(
          "group flex gap-(--gap) overflow-hidden p-2 [--duration:40s] [--gap:1rem]",
          {
            "flex-row": !vertical,
            "flex-col": vertical,
          },
          className,
        )}
      >
        {Array(repeat)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className={cn("flex shrink-0 justify-around gap-(--gap)", {
                "animate-marquee flex-row": !vertical,
                "animate-marquee-vertical flex-col": vertical,
                "group-hover:[animation-play-state:paused]": pauseOnHover,
                "[animation-direction:reverse]": reverse,
                "[animation-play-state:paused]": !isAnimating,
              })}
            >
              {children}
            </div>
          ))}
      </div>
      {showControl && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={isAnimating ? pauseLabel : `Resume ${pauseLabel.toLowerCase().replace(/^pause /, "")}`}
          aria-pressed={!isAnimating}
          className="absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {isAnimating ? (
            <Pause className="size-4" aria-hidden="true" />
          ) : (
            <Play className="size-4" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
