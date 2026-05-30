"use client";

import {
  Children,
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { Pause, Play } from "lucide-react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/**
 * ## API parity
 *
 * Re-authored from the Magic UI `AnimatedList` concept (a feed that reveals
 * its children one-at-a-time with a spring pop-in). Three deliberate
 * deviations from that reference, each justified inline:
 *
 *   1. **Reduced-motion contract.** The upstream component auto-advances and
 *      springs unconditionally. We read `prefers-reduced-motion` and, when
 *      set, render every child at once with no animation and no auto-advance
 *      — a WCAG 2.3.3 (Animation from Interactions) obligation.
 *   2. **WCAG 2.2.2 (Pause, Stop, Hide).** A reveal that runs longer than 5s
 *      is auto-updating content; it needs an explicit pause affordance.
 *      Mirrors the `Marquee` primitive's visible play/pause control +
 *      optional `pauseOnHover`.
 *   3. **Honest looping.** Upstream advanced with `% length` but never reset
 *      the visible window, so it stalled at the end rather than looping.
 *      We expose an explicit `loop` boolean and a real restart.
 *
 * The spring physics, gap, fill direction, and per-step delay are all props
 * with structural defaults so the component stays product-neutral.
 */

const DEFAULT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 350,
  damping: 40,
};

interface AnimatedListItemProps extends ComponentPropsWithoutRef<typeof motion.div> {
  /**
   * The single feed entry to animate in. Slot it as a `ReactNode` so consumers
   * compose their own card/row/toast without this component owning the shape.
   */
  children: ReactNode;
  /**
   * Spring transition applied to the pop-in. Override to retune the physics
   * (e.g. softer damping for large cards).
   * @default { type: "spring", stiffness: 350, damping: 40 }
   */
  transition?: Transition;
}

/**
 * A single animated entry in an {@link AnimatedList}. Exposed so consumers can
 * compose the list manually (e.g. drive the visible window from their own
 * state) instead of relying on the auto-advance behavior.
 */
export const AnimatedListItem = forwardRef<HTMLDivElement, AnimatedListItemProps>(
  function AnimatedListItem(
    { children, transition = DEFAULT_TRANSITION, className, ...props },
    ref,
  ) {
    return (
      <motion.div
        ref={ref}
        data-slot="animated-list-item"
        layout
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={transition}
        className={cn("mx-auto w-full", className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * The feed entries to reveal in sequence. Each child should carry a stable
   * `key`; the list animates entries in one-at-a-time, newest first.
   */
  children: ReactNode;
  /**
   * Milliseconds between each entry being revealed.
   * @default 1000
   */
  delay?: number;
  /**
   * Restart the reveal from the first entry once the last one has appeared,
   * producing a continuous loop. When `false`, the list settles on the full
   * set and stops.
   * @default false
   */
  loop?: boolean;
  /**
   * Spring transition for each entry's pop-in. Forwarded to every
   * {@link AnimatedListItem}.
   * @default { type: "spring", stiffness: 350, damping: 40 }
   */
  transition?: Transition;
  /**
   * Pause the reveal while the pointer is over the list. Pairs with the
   * keyboard-reachable pause control for full WCAG 2.2.2 coverage.
   * @default false
   */
  pauseOnHover?: boolean;
  /**
   * Render a visible play/pause button (WCAG 2.2.2 — Pause, Stop, Hide for
   * auto-updating content that runs longer than 5s). Turn off only when an
   * enclosing surface exposes its own pause control.
   * @default true
   */
  showPauseControl?: boolean;
  /**
   * Accessible label for the pause control. Customize per context
   * (e.g. "Pause activity feed").
   * @default "Pause animated feed"
   */
  pauseLabel?: string;
  /**
   * Stable selector hook for E2E tests. No runtime default — supply one per
   * usage so omissions surface instead of silently sharing a selector.
   */
  "data-testid"?: string;
}

/**
 * AnimatedList — reveals its children one at a time, newest on top, with a
 * spring pop-in.
 *
 * Motion control is layered like the `Marquee` primitive:
 *   1. `prefers-reduced-motion: reduce` → renders the full list instantly with
 *      no animation and no auto-advance.
 *   2. `pauseOnHover` → pointer users can hold the reveal.
 *   3. Visible play/pause button → keyboard + screen-reader users get an
 *      explicit, Tab-reachable control.
 *
 * Consumer-agnostic: extends `<div>`, forwards `ref`, merges `className`, and
 * spreads `...props` onto the scroll root.
 */
export const AnimatedList = forwardRef<HTMLDivElement, AnimatedListProps>(
  function AnimatedList(
    {
      children,
      className,
      delay = 1000,
      loop = false,
      transition = DEFAULT_TRANSITION,
      pauseOnHover = false,
      showPauseControl = true,
      pauseLabel = "Pause animated feed",
      ...props
    },
    ref,
  ) {
    const reducedMotion = useReducedMotion();
    const [paused, setPaused] = useState(false);
    const [hovering, setHovering] = useState(false);
    const [revealCount, setRevealCount] = useState(1);

    const childrenArray = useMemo(() => Children.toArray(children), [children]);
    const total = childrenArray.length;

    // The reveal advances iff the user hasn't paused it, the pointer isn't
    // holding it (when pauseOnHover), and reduced-motion isn't set. Reduced
    // motion is the hard override — it shows everything and never ticks.
    const isPlaying = !paused && !(pauseOnHover && hovering) && !reducedMotion;

    // Reduced-motion users see the complete feed immediately.
    const effectiveCount = reducedMotion ? total : revealCount;

    useEffect(() => {
      // Reset the window whenever the children identity or length changes so a
      // new feed always starts from the first entry.
      setRevealCount(total > 0 ? 1 : 0);
    }, [total]);

    useEffect(() => {
      if (!isPlaying || total === 0) return;
      if (!loop && revealCount >= total) return;

      const timeout = setTimeout(() => {
        setRevealCount((count) => {
          if (count >= total) return loop ? 1 : count;
          return count + 1;
        });
      }, delay);

      return () => clearTimeout(timeout);
    }, [isPlaying, revealCount, total, delay, loop]);

    // Newest entry on top, matching the upstream "incoming feed" feel.
    const itemsToShow = useMemo(
      () => childrenArray.slice(0, effectiveCount).reverse(),
      [childrenArray, effectiveCount],
    );

    const showControl = showPauseControl && !reducedMotion && total > 0;
    const resumeLabel = `Resume ${pauseLabel.toLowerCase().replace(/^pause\s+/, "")}`;

    return (
      <div className="relative">
        <div
          ref={ref}
          data-slot="animated-list"
          className={cn("flex flex-col items-center gap-4", className)}
          onMouseEnter={pauseOnHover ? () => setHovering(true) : undefined}
          onMouseLeave={pauseOnHover ? () => setHovering(false) : undefined}
          aria-live="polite"
          {...props}
        >
          <AnimatePresence>
            {itemsToShow.map((item) => (
              <AnimatedListItem
                key={(item as ReactElement).key}
                transition={transition}
              >
                {item}
              </AnimatedListItem>
            ))}
          </AnimatePresence>
        </div>

        {showControl && (
          <button
            type="button"
            data-slot="animated-list-pause"
            onClick={() => setPaused((value) => !value)}
            aria-label={isPlaying ? pauseLabel : resumeLabel}
            aria-pressed={!isPlaying}
            className="absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-full border border-fd-border bg-fd-background/80 text-fd-foreground backdrop-blur-sm transition-colors hover:bg-fd-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring"
          >
            {isPlaying ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    );
  },
);
