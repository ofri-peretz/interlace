"use client";

/**
 * @interlace/ui — FlipCard
 *
 * A card with two faces: a front that asks (a claim, a question) and a back
 * that answers (with any children, such as source links). Pressing the card
 * turns it over in 3D. It makes the reader commit to a guess before the
 * answer arrives, which is what turns a fact into a moment.
 *
 * ## Anatomy
 *
 *   FlipCard                         (div — data-slot="flip-card", data-flipped)
 *     └─ div                         (data-slot="flip-card-inner" — the turning plate, a 1×1 grid)
 *         ├─ div                     (data-slot="flip-card-front")
 *         │   ├─ {front}
 *         │   └─ button              (aria-expanded, aria-controls → back; stretched over the face)
 *         └─ div#back                (data-slot="flip-card-back")
 *             ├─ {back}
 *             └─ button              (turns it back)
 *
 * ## Equal height
 *
 * Both faces sit in the same grid cell, so the card is as tall as its taller
 * face and never jumps when it turns. In a grid of cards, give the grid
 * `items-stretch` (the default) and every card in a row shares a height.
 *
 * ## Both faces stay in the DOM
 *
 * Nothing is mounted on demand. The face that is turned away is `inert`, so
 * its links are not tabbed to while hidden, and focus moves to the other
 * face's button when the card turns. Without JavaScript (`noscript:`), the
 * card does not turn at all: both faces show, one above the other, and the
 * buttons are hidden.
 *
 * ## Reduced motion
 *
 * Under `prefers-reduced-motion` there is no rotation: the faces cross-fade
 * in place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The faces are fluid; text wraps.
 *
 * | Rule | Concept                 | Where in this file                                         |
 * | ---- | ----------------------- | ---------------------------------------------------------- |
 * | R4   | Extends native el       | `React.ComponentProps<'div'>`                              |
 * | R6   | data-slot per part      | flip-card / -inner / -front / -back / -toggle              |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                          |
 * | R9   | Controlled + uncontrolled | `flipped` / `defaultFlipped` / `onFlippedChange`          |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const                       |
 * | R18  | Tailwind only           | 3D with `perspective-*`, `transform-3d`, `backface-hidden` |
 * | R19  | Tokens only             | `bg-card`, `border-border`, `text-primary`                 |
 * | R26  | A11y                    | a disclosure: `aria-expanded` + `aria-controls`, inert hidden face |
 */

import * as React from "react";

import { cn } from "../lib/cn.js";

export const MIN_VIEWPORT = 320 as const;

type FlipCardProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The side that asks: a claim, a question. */
  front: React.ReactNode;
  /** The side that answers. Links and other controls are fine here. */
  back: React.ReactNode;
  /** Label of the button on the front. @default 'Show answer' */
  revealLabel?: string;
  /** Label of the button on the back. @default 'Show question' */
  returnLabel?: string;
  /** Controlled state. */
  flipped?: boolean;
  /** Uncontrolled initial state. @default false */
  defaultFlipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
};

const FACE =
  "bg-card text-card-foreground border-border relative col-start-1 row-start-1 flex flex-col rounded-xl border p-6 backface-hidden";

const TOGGLE =
  "text-primary focus-visible:outline-ring mt-auto inline-flex min-h-11 items-center gap-1.5 self-start pt-4 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 noscript:hidden";

function FlipCard({
  front,
  back,
  revealLabel = "Show answer",
  returnLabel = "Show question",
  flipped: flippedProp,
  defaultFlipped = false,
  onFlippedChange,
  className,
  ...props
}: FlipCardProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultFlipped);
  const flipped = flippedProp ?? uncontrolled;
  // Until hydration nothing is inert, so a page without JavaScript reads both faces.
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  const backId = React.useId();
  const frontButton = React.useRef<HTMLButtonElement>(null);
  const backButton = React.useRef<HTMLButtonElement>(null);
  // The side a press asked for, kept only for the render that press causes.
  // A controlled parent that refuses the turn and later changes `flipped` for
  // its own reasons must not pull focus, so the request expires once the
  // press has been handled.
  const pendingFocus = React.useRef<boolean | null>(null);

  const turn = (next: boolean) => {
    pendingFocus.current = next;
    if (flippedProp === undefined) setUncontrolled(next);
    onFlippedChange?.(next);
    setTimeout(() => {
      pendingFocus.current = null;
    }, 0);
  };

  // After a turn, focus follows to the face now showing.
  React.useEffect(() => {
    const asked = pendingFocus.current;
    pendingFocus.current = null;
    if (asked !== flipped) return;
    (flipped ? backButton : frontButton).current?.focus({
      preventScroll: true,
    });
  }, [flipped]);

  return (
    <div
      data-slot="flip-card"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-flipped={flipped ? "" : undefined}
      // h-full: in a grid row the card fills its cell, so cards with
      // different amounts of text line up. Outside a sized parent it is auto.
      className={cn(
        "group/flip h-full min-w-0 perspective-[1600px]",
        className,
      )}
      {...props}
    >
      <div
        data-slot="flip-card-inner"
        className={cn(
          "relative grid h-full transform-3d",
          "motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:ease-move",
          "motion-safe:group-data-flipped/flip:rotate-y-180",
          "noscript:gap-3 noscript:transform-none",
        )}
      >
        <div
          data-slot="flip-card-front"
          inert={hydrated && flipped ? true : undefined}
          className={cn(
            FACE,
            "motion-reduce:transition-opacity motion-reduce:duration-(--duration-medium)",
            "motion-reduce:group-data-flipped/flip:opacity-0",
          )}
        >
          {front}
          <button
            ref={frontButton}
            type="button"
            data-slot="flip-card-toggle"
            aria-expanded={flipped}
            aria-controls={backId}
            onClick={() => turn(true)}
            // Stretched over the face, so a tap anywhere on the front turns it.
            className={cn(
              TOGGLE,
              "after:absolute after:inset-0 after:rounded-xl after:content-['']",
            )}
          >
            {revealLabel}
            <span aria-hidden>↻</span>
          </button>
        </div>
        <div
          id={backId}
          data-slot="flip-card-back"
          inert={hydrated && !flipped ? true : undefined}
          className={cn(
            FACE,
            "motion-safe:rotate-y-180",
            "motion-reduce:opacity-0 motion-reduce:transition-opacity motion-reduce:duration-(--duration-medium)",
            "motion-reduce:group-data-flipped/flip:opacity-100",
            "noscript:row-start-2 noscript:rotate-none noscript:opacity-100",
          )}
        >
          {back}
          <button
            ref={backButton}
            type="button"
            data-slot="flip-card-toggle"
            aria-expanded={flipped}
            aria-controls={backId}
            onClick={() => turn(false)}
            className={TOGGLE}
          >
            <span aria-hidden>↺</span>
            {returnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
FlipCard.displayName = "FlipCard";

export { FlipCard };
export type { FlipCardProps };
