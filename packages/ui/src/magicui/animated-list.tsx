"use client";

/**
 * @interlace/ui — AnimatedList + AnimatedListItem
 *
 * A feed that reveals its children one at a time, newest on top, each entry
 * springing in from `scale: 0`. One more appears every `delay` ms (1000 by
 * default) until the list is full, then it stops — or restarts, with `loop`.
 *
 * The list is `aria-live="polite"`, so each arrival is announced.
 *
 * ## Provenance
 *
 * Our reimplementation of the Magic UI `AnimatedList` concept. What is ours:
 * the reduced-motion gating, the visible pause control, and a `loop` that
 * really restarts — upstream advanced with `% length` but never reset the
 * visible window, so it stalled at the end instead of looping. The spring
 * physics, gap, direction and per-step delay are all props with structural
 * defaults, so nothing product-specific is baked in.
 *
 * ## Anatomy
 *
 *   div.relative
 *     ├─ div                         (data-slot="animated-list", aria-live=polite)
 *     │   └─ AnimatedListItem ×      (data-slot="animated-list-item", motion.div)
 *     └─ button                      (data-slot="animated-list-pause", aria-pressed)
 *
 * ## Motion
 *
 * The sequencing is JS-driven (a `setTimeout` chain) and the pop-in is
 * `motion/react`, so the CSS reset in `styles/preflight.css` reaches neither.
 * Every layer is gated in JS instead:
 *
 * | Layer            | Driven by                    | Under `reduce`                       |
 * | ---------------- | ---------------------------- | ------------------------------------ |
 * | auto-advance     | `setTimeout` chain           | `isPlaying` false — never ticks      |
 * | visible window   | `revealCount` state          | full child count, rendered at once   |
 * | pause control    | —                            | not rendered (nothing left to pause) |
 * | entry pop-in     | `motion/react` spring        | `initial={false}` — mounts settled   |
 * | reflow slide     | `motion/react` `layout` FLIP | `layout` off                         |
 *
 * `AnimatedListItem` reads the preference itself rather than inheriting it
 * from the list, because it is exported and composed standalone. No
 * `MotionConfig` wraps this tree, so there is no ambient fallback — the gate
 * has to live on the component that emits the animation.
 *
 * ## WCAG 2.2.2 (Pause, Stop, Hide)
 *
 * A reveal running longer than 5s is auto-updating content and needs an
 * explicit pause affordance, so `showPauseControl` defaults to `true` and
 * renders a Tab-reachable button carrying `aria-pressed`. `pauseOnHover` is
 * the pointer-only complement and defaults to `false`.
 */

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
/** The at-rest keyframe. Under `reduce` every phase collapses onto it. */
const SETTLED = { scale: 1, opacity: 1 } as const;

export const AnimatedListItem = forwardRef<HTMLDivElement, AnimatedListItemProps>(
  function AnimatedListItem(
    { children, transition = DEFAULT_TRANSITION, className, ...props },
    ref,
  ) {
    // Gated here rather than at the list, because this component is exported
    // and composed on its own — a consumer driving the visible window from
    // their own state gets the same contract as `AnimatedList` does.
    //
    // `initial={false}` is motion's "mount at the `animate` values", which is
    // the only spelling that skips the pop-in outright; `initial={SETTLED}`
    // would still run a zero-distance animation and still write a transform.
    const reducedMotion = useReducedMotion();

    return (
      <motion.div
        ref={ref}
        data-slot="animated-list-item"
        // `layout` is a JS-driven FLIP on every reflow — a sibling arriving
        // slides this one down. That is motion too, so it goes with the rest.
        layout={!reducedMotion}
        initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
        animate={SETTLED}
        exit={reducedMotion ? SETTLED : { scale: 0, opacity: 0 }}
        transition={reducedMotion ? { duration: 0 } : transition}
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
 *   1. `prefers-reduced-motion: reduce` → renders the full list at once, with
 *      no auto-advance and no pop-in. See the table in the file header.
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
            className="absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
