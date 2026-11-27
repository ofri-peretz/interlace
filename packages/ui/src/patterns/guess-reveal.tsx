"use client";

/**
 * @interlace/ui — GuessReveal
 *
 * A one-question quiz: a question, two to four answers as buttons, and an
 * explanation that opens once the reader picks. The pick is marked right or
 * wrong with a short movement, the right answer is always shown, and the
 * consumer hears about it through `onAnswer` to record it if it wants to.
 * It turns a fact into a guess first, which is what makes it stick.
 *
 * ## Anatomy
 *
 *   GuessReveal                      (div — data-slot="guess-reveal", data-state=open|answered)
 *     ├─ p                           (data-slot="guess-reveal-question", id ← group label)
 *     ├─ div role="group"            (data-slot="guess-reveal-options")
 *     │   └─ button × 2–4            (data-slot="guess-reveal-option", data-result=right|wrong|none)
 *     ├─ p aria-live="polite"        (data-slot="guess-reveal-status": "Right." / "Not quite.")
 *     ├─ div                         (data-slot="guess-reveal-explanation" — opens on answer)
 *     └─ details                     (data-slot="guess-reveal-fallback" — only without JavaScript)
 *
 * ## After the pick
 *
 * Every option stays focusable but `aria-disabled`, so focus does not fall
 * to the page when the buttons stop taking answers. The pick is marked with
 * a word and an icon, never colour alone. The status line is a polite live
 * region, so a screen reader hears the result without moving.
 *
 * ## Without JavaScript
 *
 * A `<details>` under the options (shown only under `noscript:`) holds the
 * right answer and the explanation, so the fact is never locked behind a
 * script.
 *
 * ## Reduced motion
 *
 * The right pick lifts and a wrong one shakes, through the Web Animations
 * API. Under `prefers-reduced-motion` neither moves and the explanation
 * opens without a transition.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Options stack below 30rem and sit in a row above it.
 *
 * | Rule | Concept                   | Where in this file                                       |
 * | ---- | ------------------------- | -------------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                            |
 * | R6   | data-slot per part        | guess-reveal / -question / -options / -option / -status / -explanation / -fallback |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                        |
 * | R9   | Controlled + uncontrolled | `answer` / `defaultAnswer` / `onAnswer`                  |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                     |
 * | R19  | Tokens only               | `success`, `destructive`, `border`, `card`               |
 * | R26  | A11y                      | group labelled by the question; live status; aria-disabled after the pick |
 */

import * as React from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";
import { motionEase } from "../lib/motion-token.js";

export const MIN_VIEWPORT = 320 as const;

interface GuessRevealOption {
  /** Stable id, passed back through `onAnswer`. */
  id: string;
  label: React.ReactNode;
  /** Exactly one option should be correct. */
  correct?: boolean;
}

type GuessRevealProps = Omit<React.ComponentProps<"div">, "children"> & {
  question: React.ReactNode;
  /** Two to four answers. */
  options: GuessRevealOption[];
  /** Shown once the reader picks: why the right answer is right, with its source. */
  explanation?: React.ReactNode;
  /** Controlled: the id of the picked option, or null for none yet. */
  answer?: string | null;
  /** Uncontrolled initial pick. */
  defaultAnswer?: string | null;
  /** Called once, with the picked option and whether it was right. */
  onAnswer?: (id: string, correct: boolean) => void;
  /** Status words. @default { right: 'Right.', wrong: 'Not quite.' } */
  labels?: { right?: string; wrong?: string; reveal?: string };
};

const OPTION =
  "border-border bg-card text-card-foreground focus-visible:outline-ring relative flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-start text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

function GuessReveal({
  question,
  options,
  explanation,
  answer: answerProp,
  defaultAnswer = null,
  onAnswer,
  labels,
  className,
  ...props
}: GuessRevealProps) {
  const [uncontrolled, setUncontrolled] = React.useState<string | null>(
    defaultAnswer,
  );
  const answer = answerProp === undefined ? uncontrolled : answerProp;
  const reduced = useReducedMotion();
  const questionId = React.useId();
  const explanationId = React.useId();
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  const animateOn = React.useRef<string | null>(null);

  const right = options.find((o) => o.correct);
  const picked = options.find((o) => o.id === answer);
  const answered = picked !== undefined;
  const pickedRight = picked?.correct === true;
  const words = {
    right: "Right.",
    wrong: "Not quite.",
    reveal: "Show the answer",
    ...labels,
  };

  // Closes the door on the first pick at once. `answered` only flips when the
  // answer renders, and a controlled parent that sets it after an await
  // would otherwise let a second click through and call onAnswer twice.
  const pickedRef = React.useRef(answered);
  React.useEffect(() => {
    // A parent that clears the answer (a retry) opens the door again.
    if (!answered) pickedRef.current = false;
  }, [answered]);

  const pick = (option: GuessRevealOption) => {
    if (answered || pickedRef.current) return;
    pickedRef.current = true;
    animateOn.current = option.id;
    if (answerProp === undefined) setUncontrolled(option.id);
    onAnswer?.(option.id, option.correct === true);
  };

  // The pick moves once: a lift when right, a shake when wrong.
  React.useEffect(() => {
    const id = animateOn.current;
    if (!id || id !== answer) return;
    animateOn.current = null;
    const el = refs.current.get(id);
    if (!el || reduced || typeof el.animate !== "function") return;
    const keyframes = pickedRight
      ? [
          { transform: "scale(1)" },
          { transform: "scale(1.04)" },
          { transform: "scale(1)" },
        ]
      : [
          { transform: "translateX(0)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(0)" },
        ];
    el.animate(keyframes, {
      duration: pickedRight ? 320 : 360,
      easing: motionEase(el, 'enter'),
    });
  }, [answer, pickedRight, reduced]);

  return (
    <div
      data-slot="guess-reveal"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-state={answered ? "answered" : "open"}
      className={cn("grid gap-4", className)}
      {...props}
    >
      <p
        id={questionId}
        data-slot="guess-reveal-question"
        className="font-heading text-lg font-semibold text-balance"
      >
        {question}
      </p>
      <div
        role="group"
        aria-labelledby={questionId}
        data-slot="guess-reveal-options"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,max(13rem,calc(50%_-_0.25rem))),1fr))] gap-2"
      >
        {options.map((option) => {
          const result = !answered
            ? "none"
            : option.correct
              ? "right"
              : option.id === answer
                ? "wrong"
                : "none";
          return (
            <button
              key={option.id}
              ref={(el) => {
                if (el) refs.current.set(option.id, el);
                else refs.current.delete(option.id);
              }}
              type="button"
              data-slot="guess-reveal-option"
              data-result={result}
              data-picked={option.id === answer ? "" : undefined}
              aria-disabled={answered || undefined}
              aria-describedby={
                answered && result !== "none" && explanation
                  ? explanationId
                  : undefined
              }
              onClick={() => pick(option)}
              className={cn(
                OPTION,
                !answered && "hover:bg-muted cursor-pointer",
                answered && "cursor-default",
                answered && result === "none" && "text-muted-foreground",
                result === "right" &&
                  "border-success bg-[color-mix(in_oklab,var(--success)_12%,var(--card))] text-foreground",
                result === "wrong" &&
                  "border-destructive bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] text-foreground",
              )}
            >
              <span>{option.label}</span>
              {result === "right" ? (
                <span className="text-success inline-flex items-center gap-1 text-xs font-semibold">
                  <span aria-hidden>✓</span>
                  {option.id === answer ? "Your answer" : "The answer"}
                </span>
              ) : result === "wrong" ? (
                <span className="text-destructive inline-flex items-center gap-1 text-xs font-semibold">
                  <span aria-hidden>✗</span>
                  Your answer
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p
        data-slot="guess-reveal-status"
        aria-live="polite"
        className="text-sm font-semibold empty:hidden"
      >
        {answered ? (pickedRight ? words.right : words.wrong) : ""}
      </p>
      {explanation ? (
        <div
          data-slot="guess-reveal-explanation"
          className={cn(
            "grid",
            "motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-enter",
            answered
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
          // Closed, its links are out of the tab order and the accessibility tree.
          inert={answered ? undefined : true}
        >
          <div
            id={explanationId}
            className="text-muted-foreground -m-1 min-h-0 overflow-hidden p-1 text-sm leading-relaxed"
          >
            {explanation}
          </div>
        </div>
      ) : null}
      <details
        data-slot="guess-reveal-fallback"
        className="hidden text-sm noscript:block"
      >
        <summary className="text-primary cursor-pointer font-semibold">
          {words.reveal}
        </summary>
        <div className="mt-2 grid gap-2">
          {right ? <p className="font-semibold">{right.label}</p> : null}
          {explanation ? (
            <div className="text-muted-foreground">{explanation}</div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
GuessReveal.displayName = "GuessReveal";

export { GuessReveal };
export type { GuessRevealProps, GuessRevealOption };
