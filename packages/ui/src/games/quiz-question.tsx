'use client';

/**
 * @interlace/ui — QuizQuestion
 *
 * A multiple-choice question with the energy of a live quiz and the manners
 * of a form: big answer tiles you can tap, click or pick with a number key,
 * an optional clock that rewards speed, and a reveal that marks the right
 * answer, says in words how you did, and shows how everyone else answered.
 * Scoring lives in `quiz-model.ts` and is exported, so a server can score
 * the same answer.
 *
 * ## Anatomy
 *
 *   QuizQuestion                     (div — data-slot="quiz-question", data-state=asking|revealed, data-outcome)
 *     ├─ div                         (data-slot="quiz-question-header")
 *     │   ├─ div                     (data-slot="quiz-question-meta": e.g. "Question 3 of 10")
 *     │   └─ TimerRing + Button      (when timed: the clock, and "Stop the clock")
 *     ├─ p                           (data-slot="quiz-question-prompt", id ← the choice group's label)
 *     ├─ div role="group"            (data-slot="quiz-question-choices")
 *     │   └─ button × n              (data-slot="quiz-question-choice", data-key, data-mark=correct|wrong)
 *     ├─ p tabIndex=-1 aria-live     (data-slot="quiz-question-result")
 *     ├─ TallyBars                   (data-slot="quiz-question-spread": how others answered, optional)
 *     └─ div                         (data-slot="quiz-question-explanation": opens on reveal)
 *
 * ## Picking an answer
 *
 * Every choice is a real button. While the question is open, the keys 1 to
 * 9 pick the matching choice from anywhere inside the component (each
 * button declares its key in `aria-keyshortcuts` and shows it on the
 * tile). The first pick is final, as in a live quiz.
 *
 * ## The clock
 *
 * `timeLimit` (seconds) starts a TimerRing when the question mounts; time
 * running out reveals the answer with no choice. A visible "Stop the clock"
 * button turns it off at any point (WCAG 2.2.1): the answer then scores
 * without the speed share, so stopping it never pays more than racing it.
 *
 * ## Controlled or not
 *
 * `result` / `defaultResult` hold the scored answer (null for none yet), so
 * a page that stored today's answer restores the revealed state on reload.
 * `onAnswer` fires once, with the scored result.
 *
 * ## Motion
 *
 * Tiles press in slightly. On the reveal the right tile settles with a
 * small lift and a wrong pick gives a short sideways shake (both 250ms,
 * transform only), and the spread's bars grow. Under reduced motion all of
 * it is simply in its end state.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                    |
 * | ---- | ------------------------- | ----------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                         |
 * | R6   | data-slot per part        | quiz-question / -header / -meta / -prompt / -choices / -choice / -result / -spread / -explanation |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                     |
 * | R9   | Controlled + uncontrolled | `result` / `defaultResult` / `onAnswer`               |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                  |
 * | R19  | Tokens only               | success, destructive, primary, border, muted           |
 * | R26  | A11y                      | labelled button group; key shortcuts declared; outcome in words; result focused |
 */

import * as React from 'react';
import { Check, X } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { motionDuration, motionEase } from '../lib/motion-token.js';
import { Button } from '../primitives/button.js';
import { scoreAnswer, type QuizOutcome, type QuizResult, type QuizScoreOptions } from './quiz-model.js';
import { TallyBars, type TallyBarsLabels, type TallyMark } from './tally-bars.js';
import { tally } from './tally-model.js';
import { TimerRing, type TimerRingLabels } from './timer-ring.js';

export const MIN_VIEWPORT = 320 as const;

interface QuizChoice {
  id: string;
  label: React.ReactNode;
  /** Plain text for the result sentence, when `label` is not a string. */
  text?: string;
}

interface QuizQuestionLabels {
  /** The result sentence. */
  result?: (r: { outcome: QuizOutcome; points: number; answer: string }) => string;
  /** The stop button. @default 'Stop the clock' */
  stopClock?: string;
  /** Shown where the clock was. @default 'Clock stopped' */
  clockStopped?: string;
  /** Names the spread. @default 'How everyone answered' */
  spread?: string;
  timer?: TimerRingLabels;
  tally?: TallyBarsLabels;
}

type QuizQuestionProps = Omit<React.ComponentProps<'div'>, 'children' | 'onChange'> & {
  question: React.ReactNode;
  choices: readonly QuizChoice[];
  /** The right choice's id. Keep it off the client until the reveal if the game is competitive. */
  correct: string;
  /** Seconds to answer. Leave out for no clock. */
  timeLimit?: number;
  /** The scored answer, controlled. null for none yet. */
  result?: QuizResult | null;
  /** The scored answer, uncontrolled. */
  defaultResult?: QuizResult | null;
  /** Called once, when the player picks or time runs out. */
  onAnswer?: (result: QuizResult) => void;
  /** Votes per choice id from everyone else, shown after the reveal. */
  distribution?: Readonly<Record<string, number>>;
  /** `distribution` already includes this player's answer. @default false */
  distributionIncludesAnswer?: boolean;
  /** Above the question, e.g. "Question 3 of 10". */
  meta?: React.ReactNode;
  /** Shown after the reveal: why the answer is right, and where it comes from. */
  explanation?: React.ReactNode;
  score?: QuizScoreOptions;
  locale?: string;
  labels?: QuizQuestionLabels;
};

const RESULT: NonNullable<QuizQuestionLabels['result']> = ({ outcome, points, answer }) =>
  outcome === 'correct'
    ? `Right. +${points} points.`
    : outcome === 'timeout'
      ? `Time's up. The answer is ${answer}.`
      : `Not this time. The answer is ${answer}.`;

const textOf = (c: QuizChoice) =>
  c.text ?? (typeof c.label === 'string' || typeof c.label === 'number' ? String(c.label) : c.id);

function QuizQuestion({
  question,
  choices,
  correct,
  timeLimit,
  result: resultProp,
  defaultResult = null,
  onAnswer,
  distribution,
  distributionIncludesAnswer = false,
  meta,
  explanation,
  score,
  locale,
  labels,
  className,
  onKeyDown,
  ...props
}: QuizQuestionProps) {
  const [uncontrolled, setUncontrolled] = React.useState<QuizResult | null>(defaultResult);
  const result = resultProp === undefined ? uncontrolled : resultProp;
  const revealed = result !== null && result !== undefined;
  const reduced = useReducedMotion();
  const timed = typeof timeLimit === 'number' && timeLimit > 0;
  const [deadline, setDeadline] = React.useState<number | null>(null);
  const [stopped, setStopped] = React.useState(false);
  const startRef = React.useRef<number | null>(null);
  const sent = React.useRef(revealed);
  const moveFocus = React.useRef(false);
  const animate = React.useRef(false);
  const promptId = React.useId();
  const explanationId = React.useId();
  const groupRef = React.useRef<HTMLDivElement>(null);
  const resultRef = React.useRef<HTMLParagraphElement>(null);

  // The clock starts in the browser, when the question is on screen.
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

  const answer = (choice: string | null) => {
    if (revealed || sent.current) return;
    sent.current = true;
    animate.current = true;
    moveFocus.current = !!groupRef.current?.contains(document.activeElement) || choice === null;
    const limitMs = timed ? (timeLimit as number) * 1000 : undefined;
    const elapsedMs = timed && !stopped && startRef.current !== null ? Date.now() - startRef.current : undefined;
    const scored = scoreAnswer({ choice, limitMs, elapsedMs }, correct, score);
    setDeadline(null);
    if (resultProp === undefined) setUncontrolled(scored);
    onAnswer?.(scored);
  };

  React.useEffect(() => {
    if (!revealed || !moveFocus.current) return;
    moveFocus.current = false;
    // Only take focus from the tiles (or from nowhere, on a timeout); never from elsewhere on the page.
    const active = document.activeElement;
    if (active && active !== document.body && !groupRef.current?.contains(active)) return;
    resultRef.current?.focus();
  }, [revealed]);

  // The reveal: the right tile lifts, a wrong pick shakes.
  React.useEffect(() => {
    if (!revealed || !animate.current) return;
    animate.current = false;
    if (reduced) return;
    const group = groupRef.current;
    const right = group?.querySelector<HTMLElement>('[data-mark="correct"]');
    const wrong = group?.querySelector<HTMLElement>('[data-mark="wrong"]');
    if (!group) return;
    const timing = { duration: motionDuration(group, 'medium'), easing: motionEase(group, 'move') };
    if (right && typeof right.animate === 'function') {
      right.animate([{ transform: 'none' }, { transform: 'translateY(-3px) scale(1.02)' }, { transform: 'none' }], timing);
    }
    if (wrong && typeof wrong.animate === 'function') {
      wrong.animate(
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
  }, [revealed, reduced]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || revealed || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= Math.min(9, choices.length)) {
      e.preventDefault();
      answer((choices[n - 1] as QuizChoice).id);
    }
  };

  const correctChoice = choices.find((c) => c.id === correct);
  const markOf = (id: string): TallyMark | undefined =>
    !revealed ? undefined : id === correct ? 'correct' : id === result.choice ? 'wrong' : undefined;
  const spread =
    revealed && distribution
      ? tally(
          choices.map((c) => c.id),
          distribution,
          { vote: result.choice, countsIncludeVote: distributionIncludesAnswer },
        )
      : null;

  return (
    <div
      data-slot="quiz-question"
      data-state={revealed ? 'revealed' : 'asking'}
      data-outcome={revealed ? result.outcome : undefined}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container grid gap-5', className)}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {meta || timed ? (
        <div data-slot="quiz-question-header" className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <div data-slot="quiz-question-meta" className="text-muted-foreground text-sm font-medium">
            {meta}
          </div>
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
                    onExpire={() => answer(null)}
                    labels={labels?.timer}
                  />
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <p id={promptId} data-slot="quiz-question-prompt" className="font-heading text-xl font-semibold text-balance">
        {question}
      </p>

      <div
        ref={groupRef}
        role="group"
        aria-labelledby={promptId}
        data-slot="quiz-question-choices"
        className="grid grid-cols-1 gap-3 @md:grid-cols-2"
      >
        {choices.map((c, i) => {
          const mark = markOf(c.id);
          const key = i < 9 ? String(i + 1) : undefined;
          return (
            <button
              key={c.id}
              type="button"
              data-slot="quiz-question-choice"
              data-key={key}
              data-mark={mark}
              aria-keyshortcuts={key}
              disabled={revealed}
              onClick={() => answer(c.id)}
              className={cn(
                'group/choice relative flex min-h-16 items-center gap-3 rounded-lg border-2 px-4 py-3 text-start text-base font-medium',
                'bg-card text-card-foreground border-border',
                'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
                'motion-safe:transition-[transform,background-color,border-color,opacity] motion-safe:duration-(--duration-fast)',
                !revealed && 'hover:bg-accent hover:border-primary cursor-pointer motion-safe:active:scale-[0.98]',
                mark === 'correct' && 'border-success bg-success/10',
                mark === 'wrong' && 'border-destructive bg-destructive/10',
                revealed && !mark && 'opacity-60',
                'disabled:cursor-default',
              )}
            >
              {key ? (
                <span
                  aria-hidden
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-md text-sm font-semibold tabular-nums',
                    mark === 'correct'
                      ? 'bg-success text-success-foreground'
                      : mark === 'wrong'
                        ? 'bg-destructive text-destructive-foreground'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {mark === 'correct' ? (
                    <Check className="size-4" strokeWidth={3} />
                  ) : mark === 'wrong' ? (
                    <X className="size-4" strokeWidth={3} />
                  ) : (
                    key
                  )}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">{c.label}</span>
              {mark ? (
                <span className="sr-only">
                  {mark === 'correct' ? `, ${labels?.tally?.correct ?? 'Right answer'}` : `, ${labels?.tally?.mine ?? 'Your answer'}`}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p
        ref={resultRef}
        tabIndex={-1}
        data-slot="quiz-question-result"
        aria-live="polite"
        aria-describedby={revealed && explanation ? explanationId : undefined}
        className={cn(
          'focus-visible:outline-ring rounded-sm text-base font-semibold outline-offset-4 empty:hidden focus-visible:outline-2',
          revealed && result.outcome === 'correct' ? 'text-success' : 'text-foreground',
        )}
      >
        {revealed
          ? (labels?.result ?? RESULT)({
              outcome: result.outcome,
              points: result.points,
              answer: correctChoice ? textOf(correctChoice) : correct,
            })
          : ''}
      </p>

      {spread ? (
        <section data-slot="quiz-question-spread" aria-label={labels?.spread ?? 'How everyone answered'} className="grid gap-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {labels?.spread ?? 'How everyone answered'}
          </p>
          <TallyBars
            rows={spread.rows}
            optionLabels={Object.fromEntries(choices.map((c) => [c.id, c.label]))}
            marks={Object.fromEntries(choices.flatMap((c) => (markOf(c.id) ? [[c.id, markOf(c.id) as TallyMark]] : [])))}
            locale={locale}
            labels={labels?.tally}
          />
        </section>
      ) : null}

      {explanation ? (
        <div
          data-slot="quiz-question-explanation"
          className={cn(
            'grid',
            'motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-enter',
            revealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
          inert={revealed ? undefined : true}
        >
          <div id={explanationId} className="text-muted-foreground -m-1 min-h-0 overflow-hidden p-1 text-sm leading-relaxed">
            {explanation}
          </div>
        </div>
      ) : null}
    </div>
  );
}
QuizQuestion.displayName = 'QuizQuestion';

export { QuizQuestion };
export type { QuizQuestionProps, QuizChoice, QuizQuestionLabels };
