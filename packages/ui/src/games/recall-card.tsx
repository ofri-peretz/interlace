'use client';

/**
 * @interlace/ui — RecallCard
 *
 * A prompt the player answers in their head, then checks: they think of
 * their answer, reveal the real one, and say honestly how they did. No
 * typing and no multiple choice, so it fits anything with an answer longer
 * than a word: a definition, a reply to a question, a step in a procedure.
 * It is the round of a flashcard deck or a daily self-check.
 *
 * For a pick from two to four answers, use `GuessReveal`.
 *
 * ## Anatomy
 *
 *   RecallCard                     (div — data-slot="recall-card", data-state=asking|revealed|rated)
 *     ├─ p                         (data-slot="recall-card-prompt", id ← labels the answer region)
 *     ├─ p                         (data-slot="recall-card-hint": "Think of your answer, then reveal it.")
 *     ├─ button                    (data-slot="recall-card-reveal", aria-expanded, aria-controls)
 *     ├─ div role="region"         (data-slot="recall-card-answer" — opens on reveal, inert while closed)
 *     ├─ div role="group"          (data-slot="recall-card-ratings", labelled by labels.rate)
 *     │   └─ button × 2–4          (data-slot="recall-card-rating", aria-pressed)
 *     ├─ p aria-live="polite"      (data-slot="recall-card-status": the rating, in words)
 *     └─ details                   (data-slot="recall-card-fallback" — only without JavaScript)
 *
 * ## The flow
 *
 * Reveal opens the answer and moves focus to it, so a screen reader reads
 * it next and a keyboard player tabs straight on to the ratings. The
 * ratings appear only once the answer is open: rating before looking is not
 * a rating. A rating can be changed until the parent moves on; `onRate`
 * fires on every change, `onReveal` once.
 *
 * Both steps are controlled or uncontrolled: `revealed` / `defaultRevealed`
 * and `rating` / `defaultRating`.
 *
 * ## Without JavaScript
 *
 * A `<details>` (shown only under `noscript:`) holds the answer, so it is
 * never locked behind a script.
 *
 * ## Reduced motion
 *
 * The answer opens by growing its row (`grid-template-rows` 0fr to 1fr,
 * 250ms). Under `prefers-reduced-motion` it opens at once.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Ratings stack below 30rem and sit in a row above it.
 *
 * | Rule | Concept                   | Where in this file                                         |
 * | ---- | ------------------------- | ---------------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                              |
 * | R6   | data-slot per part        | recall-card / -prompt / -hint / -reveal / -answer / -ratings / -rating / -status / -fallback |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                          |
 * | R9   | Controlled + uncontrolled | `revealed` / `defaultRevealed`, `rating` / `defaultRating` |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                       |
 * | R19  | Tokens only               | primary, border, card, muted-foreground, ring              |
 * | R26  | A11y                      | aria-expanded reveal; focus to the answer; pressed ratings; live status |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

interface RecallCardRating {
  /** Stable id, passed back through `onRate`. */
  id: string;
  label: React.ReactNode;
  /** Said in the status line once picked. @default the label, when it is a string */
  status?: string;
}

interface RecallCardLabels {
  /** @default 'Think of your answer, then reveal it.' */
  hint?: string;
  /** @default 'Show the answer' */
  reveal?: string;
  /** Names the answer region. @default 'The answer' */
  answer?: string;
  /** Names the ratings group. @default 'How did you do?' */
  rate?: string;
}

type RecallCardProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** What the player answers in their head. */
  prompt: React.ReactNode;
  /** The answer to check against, with its source. */
  answer: React.ReactNode;
  /** Two to four honest choices. @default "I had it" and "Not yet" */
  ratings?: readonly RecallCardRating[];
  /** Controlled: whether the answer is open. */
  revealed?: boolean;
  defaultRevealed?: boolean;
  /** Called once, when the player opens the answer. */
  onReveal?: () => void;
  /** Controlled: the id of the picked rating, or null for none yet. */
  rating?: string | null;
  defaultRating?: string | null;
  /** Called on every pick. */
  onRate?: (id: string) => void;
  labels?: RecallCardLabels;
};

const DEFAULT_RATINGS: readonly RecallCardRating[] = [
  { id: 'had-it', label: 'I had it', status: 'Marked as one you had.' },
  { id: 'not-yet', label: 'Not yet', status: 'Marked to come back to.' },
];

const CHOICE =
  'border-border bg-card text-card-foreground focus-visible:outline-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors duration-(--duration-fast) ease-enter focus-visible:outline-2 focus-visible:outline-offset-2';

function RecallCard({
  prompt,
  answer,
  ratings = DEFAULT_RATINGS,
  revealed: revealedProp,
  defaultRevealed = false,
  onReveal,
  rating: ratingProp,
  defaultRating = null,
  onRate,
  labels,
  className,
  ...props
}: RecallCardProps) {
  const [revealedState, setRevealed] = React.useState(defaultRevealed);
  const [ratingState, setRating] = React.useState<string | null>(defaultRating);
  const revealed = revealedProp ?? revealedState;
  const rating = ratingProp === undefined ? ratingState : ratingProp;
  const promptId = React.useId();
  const answerId = React.useId();
  const ratingsId = React.useId();
  const answerRef = React.useRef<HTMLDivElement>(null);
  const focusOnOpen = React.useRef(false);
  const words = {
    hint: 'Think of your answer, then reveal it.',
    reveal: 'Show the answer',
    answer: 'The answer',
    rate: 'How did you do?',
    ...labels,
  };
  const picked = ratings.find((r) => r.id === rating);
  const state = picked ? 'rated' : revealed ? 'revealed' : 'asking';

  const reveal = () => {
    if (revealed) return;
    focusOnOpen.current = true;
    if (revealedProp === undefined) setRevealed(true);
    onReveal?.();
  };

  // Focus moves to the answer once it is in the tree and no longer inert.
  React.useEffect(() => {
    if (revealed && focusOnOpen.current) {
      focusOnOpen.current = false;
      answerRef.current?.focus();
    }
  }, [revealed]);

  const rate = (id: string) => {
    if (!revealed || id === rating) return;
    if (ratingProp === undefined) setRating(id);
    onRate?.(id);
  };

  const status = picked
    ? (picked.status ?? (typeof picked.label === 'string' ? picked.label : ''))
    : '';

  return (
    <div
      data-slot="recall-card"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-state={state}
      className={cn('grid gap-4', className)}
      {...props}
    >
      <p
        id={promptId}
        data-slot="recall-card-prompt"
        className="font-heading text-h3 font-semibold text-balance"
      >
        {prompt}
      </p>
      {revealed ? null : (
        <>
          <p data-slot="recall-card-hint" className="text-muted-foreground text-sm noscript:hidden">
            {words.hint}
          </p>
          <div className="noscript:hidden">
            <button
              type="button"
              data-slot="recall-card-reveal"
              aria-expanded={false}
              aria-controls={answerId}
              onClick={reveal}
              className={cn(
                CHOICE,
                'bg-primary text-primary-foreground border-primary hover:bg-primary/90 w-auto cursor-pointer',
              )}
            >
              {words.reveal}
            </button>
          </div>
        </>
      )}
      <div
        data-slot="recall-card-answer"
        className={cn(
          'grid',
          'motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-enter',
          revealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        // Closed, its links are out of the tab order and the accessibility tree.
        inert={revealed ? undefined : true}
      >
        <div
          ref={answerRef}
          id={answerId}
          role="region"
          aria-label={words.answer}
          tabIndex={-1}
          className="focus-visible:outline-ring -m-1 min-h-0 overflow-hidden rounded-md p-1 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {answer}
        </div>
      </div>
      {revealed ? (
        <div className="grid gap-2">
          <p id={ratingsId} className="text-sm font-semibold">
            {words.rate}
          </p>
          <div
            role="group"
            aria-labelledby={ratingsId}
            data-slot="recall-card-ratings"
            className="xs:grid-cols-2 grid gap-2"
          >
            {ratings.map((r) => {
              const on = r.id === rating;
              return (
                <button
                  key={r.id}
                  type="button"
                  data-slot="recall-card-rating"
                  aria-pressed={on}
                  onClick={() => rate(r.id)}
                  className={cn(
                    CHOICE,
                    'hover:bg-muted cursor-pointer',
                    on && 'border-primary bg-primary/10 text-foreground hover:bg-primary/10',
                  )}
                >
                  {on ? <span aria-hidden>✓</span> : null}
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <p data-slot="recall-card-status" aria-live="polite" className="text-muted-foreground text-sm empty:hidden">
        {status}
      </p>
      <details data-slot="recall-card-fallback" className="hidden text-sm noscript:block">
        <summary className="text-primary cursor-pointer font-semibold">{words.reveal}</summary>
        <div className="mt-2">{answer}</div>
      </details>
    </div>
  );
}
RecallCard.displayName = 'RecallCard';

export { RecallCard };
export type { RecallCardProps, RecallCardRating, RecallCardLabels };
