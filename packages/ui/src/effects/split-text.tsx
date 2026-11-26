"use client";

/**
 * @interlace/ui — SplitText
 *
 * A headline or short line that arrives a word, or a letter, at a time the
 * first time it scrolls into view. It gives one line on a page a moment of
 * attention; use it once or twice per page, on text short enough to read
 * while it arrives.
 *
 * ## Content first
 *
 * The whole string is in the server HTML. Assistive tech reads it once, from
 * a visually hidden copy; the split pieces beside it are `aria-hidden`, so a
 * screen reader never spells a word out letter by letter. Pieces are inline
 * spans in reading order, so right-to-left text arrives from the right, and
 * a word split into letters never breaks across lines.
 *
 * ## Motion
 *
 * Before the first paint the pieces are set to transparent; when the line
 * enters the viewport each one fades in, `step` milliseconds after the one
 * before, rising a little (`rise`), coming into focus (`blur`) or neither
 * (`fade`). It runs on the Web Animations API on `opacity`, `transform` and
 * `filter`. Under `prefers-reduced-motion: reduce`, or without
 * IntersectionObserver or `element.animate`, the line is simply there.
 * Letters are cut with `Intl.Segmenter` where it exists, so an emoji or a
 * letter with combining marks stays whole.
 *
 * ## Composition
 *
 *   SplitText                           (as — data-slot="split-text", data-by)
 *     ├─ span.sr-only                   (the whole string, read once)
 *     └─ span[aria-hidden]              (data-slot="split-text-visual")
 *          └─ span × n                  (data-slot="split-text-piece")
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `as` element props                                    |
 * | R6   | data-slot per part      | split-text / -visual / -piece                         |
 * | R7   | cn + ...rest            | `cn(className)` + `{...props}`                        |
 * | R8   | Enums, not booleans     | `by`, `effect`, `as`                                  |
 * | R25  | Client component        | the arrival runs in the browser                       |
 * | R26  | A11y from native el     | the heading keeps its role; text read once            |
 */

import * as React from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";
import { motionEase } from "../lib/motion-token.js";

const FROM = {
  fade: { opacity: 0 },
  rise: { opacity: 0, transform: "translateY(0.35em)" },
  blur: { opacity: 0, filter: "blur(0.25em)" },
} as const satisfies Record<string, Keyframe>;

const TO = {
  fade: { opacity: 1 },
  rise: { opacity: 1, transform: "none" },
  blur: { opacity: 1, filter: "none" },
} as const satisfies Record<keyof typeof FROM, Keyframe>;

export type SplitTextEffect = keyof typeof FROM;

type SplitTextElement = "h1" | "h2" | "h3" | "h4" | "p" | "span";

export interface SplitTextProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "children"
> {
  /** The text. A plain string, so it can be split and read whole. */
  children: string;
  /** The element to render; a heading keeps its heading role. @default 'span' */
  as?: SplitTextElement;
  /** Arrive a word at a time, or a letter at a time. @default 'word' */
  by?: "word" | "letter";
  /** How each piece arrives. Every effect fades; `rise` also lifts, `blur` sharpens. @default 'rise' */
  effect?: SplitTextEffect;
  /** Milliseconds between one piece and the next. @default by === 'word' ? 80 : 30 */
  step?: number;
  /** Milliseconds each piece takes to arrive. @default 500 */
  duration?: number;
  /** Milliseconds to wait after the line enters the viewport. @default 0 */
  delay?: number;
}

/** One grapheme segmenter for the module, where the platform has one. */
const GRAPHEMES =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Letters, keeping emoji and combining marks whole where the platform can. */
function letters(word: string): string[] {
  if (GRAPHEMES) return Array.from(GRAPHEMES.segment(word), (s) => s.segment);
  return Array.from(word);
}

const PIECE = "inline-block whitespace-pre";

export function SplitText({
  children,
  as: Tag = "span",
  by = "word",
  effect = "rise",
  step,
  duration = 500,
  delay = 0,
  className,
  ...props
}: SplitTextProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const gap = step ?? (by === "word" ? 80 : 30);
  const words = children.split(/(\s+)/);

  // Before paint: hide the pieces, so they can arrive instead of flashing.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced || typeof el.animate !== "function") return;
    if (typeof IntersectionObserver === "undefined") return;
    // Once played, a prop change (or a Fast Refresh) never plays it again.
    if (el.dataset.revealed) return;
    const pieces = Array.from(
      el.querySelectorAll<HTMLElement>('[data-slot="split-text-piece"]'),
    );
    for (const piece of pieces) piece.style.opacity = "0";

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        el.dataset.revealed = "true";
        pieces.forEach((piece, i) => {
          piece.style.opacity = "";
          piece.animate([FROM[effect], TO[effect]], {
            duration,
            delay: delay + i * gap,
            easing: motionEase(piece, 'enter'),
            fill: "backwards",
          });
        });
      },
      { threshold: 0.5 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      for (const piece of pieces) {
        piece.style.opacity = "";
        for (const a of piece.getAnimations?.() ?? []) a.cancel();
      }
    };
  }, [reduced, effect, duration, delay, gap, by, children]);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-slot="split-text"
      data-by={by}
      className={cn(className)}
      {...props}
    >
      <span className="sr-only">{children}</span>
      <span data-slot="split-text-visual" aria-hidden="true">
        {words.map((word, w) => {
          if (word === "") return null;
          if (/^\s+$/.test(word)) return word;
          if (by === "word") {
            return (
              <span key={w} data-slot="split-text-piece" className={PIECE}>
                {word}
              </span>
            );
          }
          // A word's letters stay together, so it never breaks mid-word.
          return (
            <span key={w} className="inline-block whitespace-nowrap">
              {letters(word).map((letter, l) => (
                <span key={l} data-slot="split-text-piece" className={PIECE}>
                  {letter}
                </span>
              ))}
            </span>
          );
        })}
      </span>
    </Tag>
  );
}
