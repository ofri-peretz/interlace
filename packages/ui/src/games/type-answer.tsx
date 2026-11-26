'use client';

/**
 * @interlace/ui — TypeAnswer
 *
 * A quiz round where people type the answer. Harder than picking, and
 * fairer than it looks: case, accents, punctuation and a slip of a letter in
 * a long word are forgiven, while a different number never is (see
 * `typed-answer-model`). The reveal marks the answer, says in words how you
 * did (and the right spelling when you were close), and shows what the room
 * typed, folded together, so a common wrong answer becomes the talking
 * point.
 *
 * ## Anatomy
 *
 *   TypeAnswer                       (div — data-slot="type-answer", data-state=asking|revealed, data-outcome)
 *     ├─ div                         (data-slot="type-answer-header": meta, clock and "Stop the clock")
 *     ├─ p                           (data-slot="type-answer-prompt", labels the field)
 *     ├─ form                        (data-slot="type-answer-form": Input + Answer; Enter sends)
 *     ├─ p tabIndex=-1 aria-live     (data-slot="type-answer-result")
 *     ├─ TallyBars                   (data-slot="type-answer-spread": what the room typed, optional)
 *     └─ div                         (data-slot="type-answer-explanation": opens on reveal)
 *
 * ## The clock
 *
 * As in `QuizQuestion`: `timeLimit` starts a TimerRing when the round is on
 * screen; running out sends whatever is typed so far (an empty field is no
 * answer). "Stop the clock" turns it off (WCAG 2.2.1) and scores without
 * the speed share. Typing takes longer than tapping: give it more seconds.
 *
 * ## Motion
 *
 * On the reveal the field settles with a small lift when right and a short
 * sideways shake when wrong (250ms, transform), and the room's bars grow.
 * Under reduced motion all of it is in its end state.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                    |
 * | ---- | ------------------------- | ----------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                           |
 * | R6   | data-slot per part        | type-answer / -header / -prompt / -form / -field / -send / -result / -spread / -explanation |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                     |
 * | R9   | Controlled + uncontrolled | `result` / `defaultResult` / `onAnswer`               |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                  |
 * | R26  | A11y                      | labelled field; outcome in words; result focused; a close answer spelled out |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { Input } from '../primitives/input.js';
import type { QuizScoreOptions } from './quiz-model.js';
import { TallyBars, type TallyBarsLabels, type TallyMark } from './tally-bars.js';
import { tally } from './tally-model.js';
import { TimerRing, type TimerRingLabels } from './timer-ring.js';
import { groupTyped, normalizeAnswer, scoreTyped, type TypedResult, type TypedRules } from './typed-answer-model.js';

export const MIN_VIEWPORT = 320 as const;

interface TypeAnswerLabels {
  /** @default 'Answer' */
  send?: string;
  /** The field's placeholder. @default 'Type your answer' */
  placeholder?: string;
  /** The result sentence. `answer` is the first accepted answer. */
  result?: (r: { outcome: 'exact' | 'close' | 'wrong' | 'timeout'; points: number; answer: string }) => string;
  /** @default 'Stop the clock' */
  stopClock?: string;
  /** @default 'Clock stopped' */
  clockStopped?: string;
  /** Names the room's answers. @default 'What the room typed' */
  spread?: string;
  /** The row that folds the rest together. @default 'Something else' */
  other?: string;
  timer?: TimerRingLabels;
  tally?: TallyBarsLabels;
}

type TypeAnswerProps = Omit<React.ComponentProps<'div'>, 'children' | 'onChange'> &
  TypedRules & {
    question: React.ReactNode;
    /** Every answer that counts, the main one first. Keep them off the client until the reveal if the game is competitive. */
    accepted: readonly string[];
    /** Seconds to answer. Leave out for no clock. */
    timeLimit?: number;
    result?: TypedResult | null;
    defaultResult?: TypedResult | null;
    /** Called once, when the player sends or time runs out. */
    onAnswer?: (result: TypedResult) => void;
    /** What everyone else typed, shown after the reveal. */
    room?: readonly string[];
    /** `room` already holds this player's answer. @default false */
    roomIncludesAnswer?: boolean;
    /** Rows in the room's answers before the rest fold into one. @default 5 */
    spreadRows?: number;
    /** @default 60 */
    maxLength?: number;
    meta?: React.ReactNode;
    explanation?: React.ReactNode;
    score?: QuizScoreOptions;
    locale?: string;
    labels?: TypeAnswerLabels;
  };

const RESULT: NonNullable<TypeAnswerLabels['result']> = ({ outcome, points, answer }) =>
  outcome === 'exact'
    ? `Right. +${points} points.`
    : outcome === 'close'
      ? `Right, it is spelled ${answer}. +${points} points.`
      : outcome === 'timeout'
        ? `Time's up. The answer is ${answer}.`
        : `Not this time. The answer is ${answer}.`;

function TypeAnswer({
  question,
  accepted,
  timeLimit,
  result: resultProp,
  defaultResult = null,
  onAnswer,
  room,
  roomIncludesAnswer = false,
  spreadRows = 5,
  maxLength = 60,
  meta,
  explanation,
  score,
  tolerance,
  ignore,
  locale,
  labels,
  className,
  ...props
}: TypeAnswerProps) {
  const [uncontrolled, setUncontrolled] = React.useState<TypedResult | null>(defaultResult);
  const result = resultProp === undefined ? uncontrolled : resultProp;
  const revealed = result !== null && result !== undefined;
  const reduced = useReducedMotion();
  const timed = typeof timeLimit === 'number' && timeLimit > 0;
  const [text, setText] = React.useState('');
  const [deadline, setDeadline] = React.useState<number | null>(null);
  const [stopped, setStopped] = React.useState(false);
  const startRef = React.useRef<number | null>(null);
  const sent = React.useRef(revealed);
  const animate = React.useRef(false);
  const promptId = React.useId();
  const explanationId = React.useId();
  const fieldRef = React.useRef<HTMLInputElement>(null);
  const resultRef = React.useRef<HTMLParagraphElement>(null);
  const rules = { tolerance, ignore };

  React.useEffect(() => {
    if (!timed || revealed) return;
    const start = Date.now();
    startRef.current = start;
    setDeadline(start + (timeLimit as number) * 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, timeLimit]);

  React.useEffect(() => {
    if (!revealed) sent.current = false;
  }, [revealed]);

  const answer = (typed: string | null) => {
    if (revealed || sent.current) return;
    sent.current = true;
    animate.current = true;
    const limitMs = timed ? (timeLimit as number) * 1000 : undefined;
    const elapsedMs = timed && !stopped && startRef.current !== null ? Date.now() - startRef.current : undefined;
    const scored = scoreTyped({ text: typed, limitMs, elapsedMs }, accepted, { ...score, ...rules });
    setDeadline(null);
    if (resultProp === undefined) setUncontrolled(scored);
    onAnswer?.(scored);
  };

  React.useEffect(() => {
    if (!revealed || !animate.current) return;
    animate.current = false;
    // Take focus from the field (or from nowhere, on a timeout); never from elsewhere on the page.
    const active = document.activeElement;
    if (!active || active === document.body || fieldRef.current?.form?.contains(active)) resultRef.current?.focus();
    const field = fieldRef.current;
    if (reduced || !field || typeof field.animate !== 'function') return;
    const timing = { duration: 250, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' };
    if (result.outcome === 'correct') {
      field.animate([{ transform: 'none' }, { transform: 'translateY(-3px)' }, { transform: 'none' }], timing);
    } else if (result.outcome === 'wrong') {
      field.animate(
        [
          { transform: 'none' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(4px)' },
          { transform: 'translateX(-2px)' },
          { transform: 'none' },
        ],
        timing,
      );
    }
    // Once, on the reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const main = accepted[0] ?? '';
  const mark: TallyMark | undefined = !revealed ? undefined : result.outcome === 'correct' ? 'correct' : 'wrong';
  const shownText = revealed ? (result.text ?? '') : text;

  const spread = React.useMemo(() => {
    if (!revealed || !room) return null;
    const own = result.text && normalizeAnswer(result.text, ignore) ? result.text : null;
    const all = own && !roomIncludesAnswer ? [...room, own] : [...room];
    const groups = groupTyped(all, accepted, rules);
    if (groups.length === 0) return null;
    const keep = Math.max(1, spreadRows);
    // The right answer always has a row, even when few typed it.
    const right = groups.find((g) => g.correct);
    let top = groups.slice(0, keep);
    if (right && !top.includes(right)) top = [...top.slice(0, keep - 1), right];
    const rest = groups.filter((g) => !top.includes(g)).reduce((n, g) => n + g.count, 0);
    const ids = top.map((_, i) => `g${i}`).concat(rest > 0 ? ['other'] : []);
    const counts: Record<string, number> = Object.fromEntries(top.map((g, i) => [`g${i}`, g.count]));
    if (rest > 0) counts.other = rest;
    const mine =
      own === null
        ? null
        : result.outcome === 'correct'
          ? `g${top.indexOf(right as (typeof groups)[number])}`
          : (() => {
              const i = top.findIndex(
                (g) => !g.correct && normalizeAnswer(g.text, ignore) === normalizeAnswer(own, ignore),
              );
              return i >= 0 ? `g${i}` : rest > 0 ? 'other' : null;
            })();
    const names: Record<string, React.ReactNode> = Object.fromEntries(top.map((g, i) => [`g${i}`, g.text]));
    names.other = labels?.other ?? 'Something else';
    const marks: Record<string, TallyMark> = {};
    top.forEach((g, i) => {
      if (g.correct) marks[`g${i}`] = 'correct';
    });
    if (mine && !marks[mine]) marks[mine] = 'wrong';
    return { rows: tally(ids, counts, { vote: mine, countsIncludeVote: true }).rows, names, marks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, result, room, roomIncludesAnswer, accepted, spreadRows, tolerance, ignore, labels?.other]);

  return (
    <div
      data-slot="type-answer"
      data-state={revealed ? 'revealed' : 'asking'}
      data-outcome={revealed ? result.outcome : undefined}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-5', className)}
      {...props}
    >
      {meta || timed ? (
        <div data-slot="type-answer-header" className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <div className="text-muted-foreground text-sm font-medium">{meta}</div>
          {timed && !revealed ? (
            <div className="flex items-center gap-2">
              {stopped ? (
                <span className="text-muted-foreground text-sm">{labels?.clockStopped ?? 'Clock stopped'}</span>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStopped(true);
                      setDeadline(null);
                    }}
                  >
                    {labels?.stopClock ?? 'Stop the clock'}
                  </Button>
                  <TimerRing
                    seconds={timeLimit as number}
                    deadline={deadline}
                    onExpire={() => answer(text.trim() ? text : null)}
                    labels={labels?.timer}
                  />
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <p id={promptId} data-slot="type-answer-prompt" className="font-heading text-xl font-semibold text-balance">
        {question}
      </p>

      <form
        data-slot="type-answer-form"
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) answer(text);
          else fieldRef.current?.focus();
        }}
      >
        <Input
          ref={fieldRef}
          data-slot="type-answer-field"
          aria-labelledby={promptId}
          value={shownText}
          onChange={(e) => setText(e.target.value)}
          readOnly={revealed}
          maxLength={maxLength}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          placeholder={revealed ? undefined : (labels?.placeholder ?? 'Type your answer')}
          className={cn(
            'min-w-0 flex-1 basis-48',
            mark === 'correct' && 'border-success bg-success/10',
            mark === 'wrong' && 'border-destructive bg-destructive/10',
          )}
        />
        {revealed ? null : (
          <Button data-slot="type-answer-send" type="submit">
            {labels?.send ?? 'Answer'}
          </Button>
        )}
      </form>

      <p
        ref={resultRef}
        tabIndex={-1}
        data-slot="type-answer-result"
        aria-live="polite"
        aria-describedby={revealed && explanation ? explanationId : undefined}
        className={cn(
          'focus-visible:outline-ring rounded-sm text-base font-semibold outline-offset-4 empty:hidden focus-visible:outline-2',
          revealed && result.outcome === 'correct' ? 'text-success' : 'text-foreground',
        )}
      >
        {revealed
          ? (labels?.result ?? RESULT)({
              outcome:
                result.outcome === 'timeout'
                  ? 'timeout'
                  : result.outcome === 'wrong'
                    ? 'wrong'
                    : result.match.outcome === 'close'
                      ? 'close'
                      : 'exact',
              points: result.points,
              answer: result.match.matched ?? main,
            })
          : ''}
      </p>

      {spread ? (
        <section
          data-slot="type-answer-spread"
          aria-label={labels?.spread ?? 'What the room typed'}
          className="grid gap-2"
        >
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {labels?.spread ?? 'What the room typed'}
          </p>
          <TallyBars
            rows={spread.rows}
            optionLabels={spread.names}
            marks={spread.marks}
            locale={locale}
            labels={labels?.tally}
          />
        </section>
      ) : null}

      {explanation ? (
        <div
          data-slot="type-answer-explanation"
          className={cn(
            'grid',
            'motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-enter',
            revealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
          inert={revealed ? undefined : true}
        >
          <div
            id={explanationId}
            className="text-muted-foreground -m-1 min-h-0 overflow-hidden p-1 text-sm leading-relaxed"
          >
            {explanation}
          </div>
        </div>
      ) : null}
    </div>
  );
}
TypeAnswer.displayName = 'TypeAnswer';

export { TypeAnswer };
export type { TypeAnswerProps, TypeAnswerLabels };
