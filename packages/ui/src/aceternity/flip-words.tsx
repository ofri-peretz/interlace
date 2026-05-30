"use client";

import {
  type ComponentPropsWithoutRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/**
 * ## API parity
 *
 * Re-authored from Aceternity UI's `FlipWords`
 * (https://ui.aceternity.com/components/flip-words). Deviations from upstream,
 * each justified:
 *
 * - **Controlled + uncontrolled cycling.** Upstream is uncontrolled-only and
 *   reads its own index off `words.indexOf(currentWord)` (buggy with duplicate
 *   words). We track a numeric `index` and expose `index` + `onIndexChange` for
 *   controlled use, `defaultIndex` for uncontrolled (R14).
 * - **Reduced-motion contract.** Upstream animates unconditionally. We read
 *   `useReducedMotion()` and render a static word with no enter/exit transition,
 *   honoring `prefers-reduced-motion: reduce` (MOTION_PHILOSOPHY).
 * - **Tokens, not raw colors.** Upstream hard-codes
 *   `text-neutral-900 dark:text-neutral-100`. We default to `currentColor`
 *   (inherit from the consumer's text context) and never ship a color literal
 *   (R19).
 * - **Consumer-agnostic root.** Extends `<span>` props, spreads `...props`,
 *   merges `className`, and exposes `data-testid` / `data-slot` (R4–R7).
 * - **`pauseOnHover`.** Lets pointer users hold a word to read it; a small
 *   ergonomic win over the upstream fixed cadence.
 */

interface FlipWordsProps
  extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /**
   * Ordered list of words (or short phrases) to cycle through. Each entry is
   * animated in word-by-word and letter-by-letter, then animated out before the
   * next entry enters.
   */
  words: string[];
  /**
   * Time in milliseconds a word stays on screen before flipping to the next
   * one. The enter/exit animation runs on top of this dwell time.
   * @default 3000
   */
  duration?: number;
  /**
   * The index of the word shown on first render when the component is
   * uncontrolled. Ignored when `index` is provided.
   * @default 0
   */
  defaultIndex?: number;
  /**
   * Controlled index of the active word. When provided, the component will not
   * advance on its own — drive it from the parent and pair with
   * `onIndexChange`.
   */
  index?: number;
  /**
   * Called with the next index whenever the active word changes, in both
   * controlled and uncontrolled modes.
   * @default undefined
   */
  onIndexChange?: (index: number, details: { word: string }) => void;
  /**
   * Pause cycling while the pointer is over the component, giving readers time
   * to finish the current word. Has no effect under reduced motion (cycling is
   * already disabled).
   * @default false
   */
  pauseOnHover?: boolean;
  /**
   * Stagger between each word in a multi-word entry, in seconds.
   * @default 0.3
   */
  wordStagger?: number;
  /**
   * Stagger between each letter within a word, in seconds.
   * @default 0.05
   */
  letterStagger?: number;
  /**
   * Stable selector hook for end-to-end tests. Required so consumers never rely
   * on a silent default; sub-parts derive `{value}-word` / `{value}-letter`.
   */
  "data-testid": string;
}

const SPRING = { type: "spring", stiffness: 100, damping: 10 } as const;

/**
 * FlipWords — an animated headline word that flips through a list, revealing
 * each replacement letter-by-letter with a soft blur-and-rise.
 *
 * Motion contract: under `prefers-reduced-motion: reduce` the component renders
 * the active word statically with no enter/exit animation and stops cycling, so
 * reduced-motion users get a stable, readable headline (WCAG 2.3.3).
 *
 * Color is inherited via `currentColor` by default — set the text color on a
 * parent (or pass a Tailwind text token through `className`) so the flipping
 * word matches its surrounding type. The component never ships a color literal.
 */
export function FlipWords({
  words,
  duration = 3000,
  defaultIndex = 0,
  index: controlledIndex,
  onIndexChange,
  pauseOnHover = false,
  wordStagger = 0.3,
  letterStagger = 0.05,
  className,
  "data-testid": testId,
  ...props
}: FlipWordsProps) {
  const reducedMotion = useReducedMotion();
  const liveRegionId = useId();

  const isControlled = controlledIndex !== undefined;
  const [uncontrolledIndex, setUncontrolledIndex] = useState(defaultIndex);
  const [hovered, setHovered] = useState(false);

  // Clamp so an out-of-range index (controlled or default) never renders
  // `undefined`. Empty `words` falls back to an empty string.
  const activeIndex =
    words.length === 0
      ? 0
      : ((isControlled ? controlledIndex : uncontrolledIndex) % words.length +
          words.length) %
        words.length;
  const currentWord = words[activeIndex] ?? "";

  const advance = useCallback(() => {
    if (words.length === 0) return;
    const next = (activeIndex + 1) % words.length;
    onIndexChange?.(next, { word: words[next] ?? "" });
    if (!isControlled) setUncontrolledIndex(next);
  }, [activeIndex, isControlled, onIndexChange, words]);

  // Cycle on a timer unless the parent controls the index, the user prefers
  // reduced motion, or the pointer is hovering with `pauseOnHover`.
  const cyclingPaused =
    isControlled || reducedMotion || (pauseOnHover && hovered);

  useEffect(() => {
    if (cyclingPaused || words.length <= 1) return;
    const timer = setTimeout(advance, duration);
    return () => clearTimeout(timer);
  }, [advance, cyclingPaused, duration, words.length, activeIndex]);

  const hoverHandlers = useMemo(
    () =>
      pauseOnHover
        ? {
            onPointerEnter: () => setHovered(true),
            onPointerLeave: () => setHovered(false),
          }
        : {},
    [pauseOnHover],
  );

  const segments = currentWord.split(" ");

  return (
    <span
      {...props}
      {...hoverHandlers}
      data-slot="flip-words"
      data-testid={testId}
      className={cn(
        "relative inline-block text-left text-current",
        className,
      )}
    >
      {/* Polite live region so screen readers announce each new word. */}
      <span id={liveRegionId} aria-live="polite" className="sr-only">
        {currentWord}
      </span>

      {reducedMotion ? (
        <span data-slot="flip-words-static" aria-hidden="true">
          {currentWord}
        </span>
      ) : (
        <AnimatePresence mode="wait">
          <motion.span
            key={`${currentWord}-${activeIndex}`}
            data-slot="flip-words-word"
            data-testid={`${testId}-word`}
            aria-hidden="true"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: -40,
              x: 40,
              filter: "blur(8px)",
              scale: 2,
              position: "absolute",
            }}
            transition={SPRING}
            className="relative z-10 inline-block"
          >
            {segments.map((segment, segmentIndex) => (
              <span
                key={`${segment}-${segmentIndex}`}
                className="inline-block whitespace-nowrap"
              >
                {Array.from(segment).map((letter, letterIndex) => (
                  <motion.span
                    key={`${letter}-${letterIndex}`}
                    initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{
                      delay:
                        segmentIndex * wordStagger +
                        letterIndex * letterStagger,
                      duration: 0.2,
                    }}
                    className="inline-block"
                  >
                    {letter}
                  </motion.span>
                ))}
                {segmentIndex < segments.length - 1 ? (
                  <span className="inline-block">&nbsp;</span>
                ) : null}
              </span>
            ))}
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  );
}
