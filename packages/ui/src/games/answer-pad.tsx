'use client';

/**
 * @interlace/ui — AnswerPad
 *
 * The player's side of a live round: the question is on the big screen, and
 * each phone shows big lettered tiles to pick from. The first pick is final
 * and goes to the host; the pad then says the answer is in and waits. When
 * the host reveals the round, the pad marks the right tile and says in words
 * how this player did. The pad never needs the right answer before the
 * reveal, so a competitive room can keep it off the phones.
 *
 * Letters (A, B, C…) tie a tile to the same choice on the big screen, so a
 * room can show only letters on phones (`display="keys"`) and the words on
 * the shared screen. `choiceKey(i)` gives the host screen the same letters.
 *
 * ## Anatomy
 *
 *   AnswerPad                     (div — data-slot="answer-pad", data-state)
 *     ├─ p?                       (data-slot="answer-pad-prompt", when `prompt` is given)
 *     ├─ div role="group"         (data-slot="answer-pad-choices")
 *     │   └─ button × n           (data-slot="answer-pad-choice", data-key, data-mark, aria-pressed)
 *     │       ├─ span             (data-slot="answer-pad-key": A, B… or a check / cross)
 *     │       └─ span             (data-slot="answer-pad-label", unless display="keys")
 *     └─ p aria-live              (data-slot="answer-pad-status": "Answer in", then the result)
 *
 * ## States
 *
 * `open`: tiles take a pick. `sent`: a pick is in, tiles are locked. `closed`:
 * time ran out with no pick. `revealed`: `correct` is known; the right tile is
 * marked, a wrong pick too, and the status gives the outcome and `points`.
 * The state follows from the props (`value`, `closed`, `correct`), so the pad
 * shows the same thing after a reload or a reconnect.
 *
 * ## Keys
 *
 * While open, the keys A to Z and 1 to 9 pick the matching tile from anywhere
 * inside the pad; each tile declares its keys in `aria-keyshortcuts`.
 *
 * ## Motion
 *
 * A tile presses in slightly when tapped, and the picked tile settles with a
 * small lift (transform only, 200ms). Under reduced motion nothing moves.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                     |
 * | ---- | ------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                          |
 * | R6   | data-slot per part        | answer-pad / -prompt / -choices / -choice / -key / -label / -status |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                      |
 * | R8   | Enums, not booleans       | `display`                                              |
 * | R9   | Controlled                | `value` / `onPick`                                     |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                   |
 * | R19  | Tokens only               | success, destructive, primary, border, muted           |
 * | R26  | A11y                      | labelled group; aria-pressed; keys declared; outcome in words |
 */

import * as React from 'react';
import { Check, X } from 'lucide-react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The letter for the choice at `index` (0 → "A"), shared by the pad and the big screen. */
export function choiceKey(index: number): string {
  return LETTERS[index] ?? String(index + 1);
}

export type AnswerPadState = 'open' | 'sent' | 'closed' | 'revealed';
export type AnswerPadOutcome = 'correct' | 'wrong' | 'missed';

interface AnswerPadChoice {
  id: string;
  label: React.ReactNode;
  /** Plain text for the result sentence, when `label` is not a string. */
  text?: string;
}

interface AnswerPadLabels {
  /** Names the group of tiles. @default 'Your answer' */
  group?: string;
  /** While a pick waits for the reveal. @default 'Answer in. Watch the screen.' */
  sent?: string;
  /** Time ran out with no pick, before the reveal. @default "Time's up." */
  closed?: string;
  /** The result sentence after the reveal. */
  result?: (r: { outcome: AnswerPadOutcome; points: number | null; answer: string }) => string;
  /** Read after the right tile. @default 'right answer' */
  correct?: string;
  /** Read after this player's tile. @default 'your answer' */
  mine?: string;
}

type AnswerPadProps = Omit<React.ComponentProps<'div'>, 'children' | 'onChange'> & {
  choices: readonly AnswerPadChoice[];
  /** The id this player picked, or null for none yet. */
  value: string | null;
  /** Called once, with the picked id, while the pad is open. */
  onPick?: (id: string) => void;
  /** The right choice's id, once the round is revealed. Leave null until then. */
  correct?: string | null;
  /** No more picks (time ran out or the host closed the round). */
  closed?: boolean;
  /** Points this player won this round, shown after the reveal. */
  points?: number | null;
  /** The question, when the pad shows it too. On a shared screen, leave it out. */
  prompt?: React.ReactNode;
  /** `full`: letter and words. `keys`: letters only, with the words on the big screen. @default 'full' */
  display?: 'full' | 'keys';
  locale?: string;
  labels?: AnswerPadLabels;
};

const result =
  (locale?: string): NonNullable<AnswerPadLabels['result']> =>
  ({ outcome, points, answer }) =>
    outcome === 'correct'
      ? points
        ? `Right. +${points.toLocaleString(locale)} points.`
        : 'Right.'
      : outcome === 'missed'
        ? `No answer this time. It was ${answer}.`
        : `Not this time. It was ${answer}.`;

const textOf = (c: AnswerPadChoice) =>
  c.text ?? (typeof c.label === 'string' || typeof c.label === 'number' ? String(c.label) : c.id);

function AnswerPad({
  choices,
  value,
  onPick,
  correct = null,
  closed = false,
  points = null,
  prompt,
  display = 'full',
  locale,
  labels,
  className,
  onKeyDown,
  ...props
}: AnswerPadProps) {
  const revealed = correct !== null && correct !== undefined;
  const state: AnswerPadState = revealed ? 'revealed' : value !== null ? 'sent' : closed ? 'closed' : 'open';
  const open = state === 'open';
  const promptId = React.useId();
  const sent = React.useRef(false);
  React.useEffect(() => {
    if (value === null) sent.current = false;
  }, [value]);

  const pick = (id: string) => {
    if (!open || sent.current) return;
    sent.current = true;
    onPick?.(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || !open || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toUpperCase();
    let index = LETTERS.indexOf(k);
    if (k.length !== 1) index = -1;
    if (index < 0 && /^[1-9]$/.test(k)) index = Number(k) - 1;
    const choice = index >= 0 ? choices[index] : undefined;
    if (!choice) return;
    e.preventDefault();
    pick(choice.id);
  };

  const outcome: AnswerPadOutcome | null = revealed
    ? value === null
      ? 'missed'
      : value === correct
        ? 'correct'
        : 'wrong'
    : null;
  const right = choices.find((c) => c.id === correct);
  const status =
    state === 'revealed'
      ? (labels?.result ?? result(locale))({
          outcome: outcome!,
          points,
          answer: right ? textOf(right) : String(correct),
        })
      : state === 'sent'
        ? (labels?.sent ?? 'Answer in. Watch the screen.')
        : state === 'closed'
          ? (labels?.closed ?? "Time's up.")
          : '';

  return (
    <div
      data-slot="answer-pad"
      data-state={state}
      data-outcome={outcome ?? undefined}
      data-display={display}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container grid gap-4', className)}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {prompt ? (
        <p id={promptId} data-slot="answer-pad-prompt" className="font-heading text-lg font-semibold text-balance">
          {prompt}
        </p>
      ) : null}
      <div
        role="group"
        aria-labelledby={prompt ? promptId : undefined}
        aria-label={prompt ? undefined : (labels?.group ?? 'Your answer')}
        data-slot="answer-pad-choices"
        className={cn('grid gap-3', display === 'keys' ? 'grid-cols-2' : 'grid-cols-1 @md:grid-cols-2')}
      >
        {choices.map((c, i) => {
          const key = choiceKey(i);
          const mine = value === c.id;
          const mark = revealed
            ? c.id === correct
              ? 'correct'
              : mine
                ? 'wrong'
                : undefined
            : mine
              ? 'picked'
              : undefined;
          const shortcuts = i < 9 ? `${key} ${i + 1}` : key;
          return (
            <button
              key={c.id}
              type="button"
              data-slot="answer-pad-choice"
              data-key={key}
              data-mark={mark}
              aria-pressed={mine}
              aria-keyshortcuts={shortcuts}
              aria-disabled={!open || undefined}
              onClick={() => pick(c.id)}
              className={cn(
                'relative flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-start text-base font-medium',
                display === 'keys' ? 'min-h-24 justify-center' : 'min-h-16',
                'bg-card text-card-foreground border-border',
                'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
                'motion-safe:transition-[transform,background-color,border-color] motion-safe:duration-(--duration-fast)',
                open && 'hover:bg-accent hover:border-primary cursor-pointer motion-safe:active:scale-[0.97]',
                !open && 'cursor-default',
                mark === 'picked' && 'border-primary bg-primary/10 motion-safe:-translate-y-0.5',
                mark === 'correct' && 'border-success bg-success/10',
                mark === 'wrong' && 'border-destructive bg-destructive/10',
              )}
            >
              <span
                aria-hidden
                data-slot="answer-pad-key"
                className={cn(
                  'grid shrink-0 place-items-center rounded-md font-semibold',
                  display === 'keys' ? 'size-14 text-2xl' : 'size-9 text-base',
                  mark === 'correct'
                    ? 'bg-success text-success-foreground'
                    : mark === 'wrong'
                      ? 'bg-destructive text-destructive-foreground'
                      : mark === 'picked'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                )}
              >
                {mark === 'correct' ? (
                  <Check className="size-5" strokeWidth={3} />
                ) : mark === 'wrong' ? (
                  <X className="size-5" strokeWidth={3} />
                ) : (
                  key
                )}
              </span>
              {display === 'keys' ? (
                <span className="sr-only">
                  {key}: {textOf(c)}
                </span>
              ) : (
                <span data-slot="answer-pad-label" className="min-w-0 flex-1">
                  <span className="sr-only">{key}: </span>
                  {c.label}
                </span>
              )}
              {mark === 'correct' || mark === 'wrong' ? (
                <span className="sr-only">
                  , {mark === 'correct' ? (labels?.correct ?? 'right answer') : (labels?.mine ?? 'your answer')}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p
        data-slot="answer-pad-status"
        aria-live="polite"
        className={cn('min-h-6 text-base font-semibold', outcome === 'correct' ? 'text-success' : 'text-foreground')}
      >
        {status}
      </p>
    </div>
  );
}

export { AnswerPad };
export type { AnswerPadProps, AnswerPadLabels, AnswerPadChoice };
