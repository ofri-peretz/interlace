"use client";

/**
 * @interlace/ui — Reveal
 *
 * Any block that arrives as it scrolls into view: a section heading, a card, a
 * figure, a quote. It fades in and, depending on `effect`, rises a little,
 * comes into focus or grows to size, once. Use it on the few things a reader
 * should notice arriving, not on every element of a page.
 *
 * ## Content first
 *
 * The content is in the server HTML, fully visible, so a crawler, a reader
 * without scripts and a screen reader all get it. The browser hides it just
 * before the first paint and shows it as it enters the viewport. Nothing is
 * removed, repeated or moved in the reading order, and nothing loops.
 *
 * ## Motion
 *
 * It runs on the Web Animations API, so there are no keyframes to add, and
 * animates only `opacity`, `transform` and (for `blur`) `filter`, which the
 * compositor handles. Under `prefers-reduced-motion: reduce`, without
 * IntersectionObserver, or without `element.animate`, the content is simply
 * there. If anything inside receives focus before its turn, the block shows
 * at once, so focus never lands on something invisible. Blocks already in
 * view on load arrive straight away.
 *
 * ## Composition
 *
 *   Reveal                              (div — data-slot="reveal", data-effect)
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props                                           |
 * | R6   | data-slot per part      | reveal                                                |
 * | R7   | cn + ...rest            | `cn(className)` + `{...props}`                        |
 * | R8   | Enums, not booleans     | `effect`                                              |
 * | R25  | Client component        | the reveal runs in the browser                        |
 * | R26  | A11y from native el     | plain content; focus reveals at once                  |
 */

import * as React from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/** Where each effect starts from. Every one ends at the element's own style. */
const FROM = {
  fade: { opacity: 0 },
  rise: { opacity: 0, transform: "translateY(1rem)" },
  blur: { opacity: 0, filter: "blur(0.5rem)" },
  scale: { opacity: 0, transform: "scale(0.96)" },
} as const satisfies Record<string, Keyframe>;

const TO = {
  fade: { opacity: 1 },
  rise: { opacity: 1, transform: "none" },
  blur: { opacity: 1, filter: "none" },
  scale: { opacity: 1, transform: "none" },
} as const satisfies Record<keyof typeof FROM, Keyframe>;

export type RevealEffect = keyof typeof FROM;

export interface RevealProps extends React.ComponentPropsWithoutRef<"div"> {
  /** How the block arrives. Every effect fades; `rise` also lifts, `blur` sharpens, `scale` grows. @default 'rise' */
  effect?: RevealEffect;
  /** Milliseconds to wait after the block enters the viewport. Use it to sequence a few siblings. @default 0 */
  delay?: number;
  /** Milliseconds the arrival takes. @default 600 */
  duration?: number;
  /** How much of the block must be visible before it arrives, from 0 to 1. @default 0.2 */
  amount?: number;
}

export function Reveal({
  effect = "rise",
  delay = 0,
  duration = 600,
  amount = 0.2,
  className,
  children,
  ...props
}: RevealProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);

  // Before paint: hide the block, so it can arrive instead of flashing.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced || typeof el.animate !== "function") return;
    if (typeof IntersectionObserver === "undefined") return;
    // Once played, a prop change (or a Fast Refresh) never plays it again.
    if (el.dataset.revealed) return;
    el.style.opacity = "0";

    let io: IntersectionObserver | undefined;
    const reveal = (wait: number) => {
      if (el.dataset.revealed) return;
      el.dataset.revealed = "true";
      io?.disconnect();
      el.style.opacity = "";
      el.animate([FROM[effect], TO[effect]], {
        duration,
        delay: wait,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
        fill: "backwards",
      });
    };
    const onFocus = () => reveal(0);
    el.addEventListener("focusin", onFocus);

    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) reveal(delay);
      },
      { threshold: Math.min(1, Math.max(0, amount)) },
    );
    io.observe(el);

    return () => {
      io?.disconnect();
      el.removeEventListener("focusin", onFocus);
      el.style.opacity = "";
      for (const a of el.getAnimations?.() ?? []) a.cancel();
    };
  }, [reduced, effect, delay, duration, amount]);

  return (
    <div
      ref={ref}
      data-slot="reveal"
      data-effect={effect}
      className={cn(className)}
      {...props}
    >
      {children}
    </div>
  );
}
