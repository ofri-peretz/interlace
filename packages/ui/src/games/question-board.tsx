'use client';

/**
 * @interlace/ui — QuestionBoard, QuestionAsk and QuestionQueue
 *
 * Questions from the room, ranked by the room. People ask from their phone
 * (`QuestionAsk`), vote up the questions they want answered
 * (`QuestionBoard`), and a moderator approves, pins, answers or hides them
 * (`QuestionQueue`) before anything typed reaches a shared screen.
 *
 * ## Who uses which part
 *
 * | Phase            | Who        | Part                                   |
 * | ---------------- | ---------- | -------------------------------------- |
 * | Asking           | Everyone   | `QuestionAsk`                          |
 * | In review        | Moderator  | `QuestionQueue` (review list)          |
 * | Live and voting  | Everyone   | `QuestionBoard` (vote buttons)         |
 * | Answering now    | Moderator  | `QuestionQueue` pin → board highlights |
 * | Answered, hidden | Moderator  | `QuestionQueue` answer / dismiss       |
 *
 * State lives in your app as a `BoardState` from `question-board-model`;
 * every part takes the ranked questions and sends events back. Run the same
 * `applyBoardEvent` on the host or server: it is the one that counts.
 *
 * ## Anatomy
 *
 *   QuestionBoard                   (section — data-slot="question-board")
 *     ├─ ol (FlipGroup)             (data-slot="question-board-list")
 *     │    └─ li × n                (data-slot="question-board-item", data-pinned, data-mine)
 *     │         ├─ p                (data-slot="question-board-text")
 *     │         └─ Button | span    (data-slot="question-board-vote", aria-pressed; or "question-board-count"
 *     │                              where nobody can vote: a shared screen, or the viewer's own)
 *     └─ p aria-live               (data-slot="question-board-status")
 *
 *   QuestionAsk                     (form — data-slot="question-ask": Textarea, counter, Send, message)
 *   QuestionQueue                   (div — data-slot="question-queue": review and live lists with actions)
 *
 * ## Motion
 *
 * When a vote changes the order, questions glide to their new places
 * (FlipGroup, 400ms, `--ease-move`); the vote count ticks with a short rise
 * of the new number (transform only). The pinned question carries a quiet
 * accent edge. Under reduced motion, everything simply takes its place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                     |
 * | ---- | ------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el         | `section` / `form` / `div` props                       |
 * | R6   | data-slot per part        | question-board / -list / -item / -text / -vote / …     |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                      |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                   |
 * | R26  | A11y                      | ordered list; vote is a toggle button with its count in its name |
 */

import { ArrowUp, Check, EyeOff, Pin, PinOff, RotateCcw } from 'lucide-react';
import * as React from 'react';

import { FlipGroup } from '../effects/flip-group.js';
import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { Textarea } from '../primitives/textarea.js';
import type { BoardEvent, RankedQuestion } from './question-board-model.js';
import { checkText, visibleLength, type TextRefusal, type TextRules } from './text-safety-model.js';

export const MIN_VIEWPORT = 320 as const;

// --- QuestionBoard ----------------------------------------------------------------

interface QuestionBoardLabels {
  /** The vote button's name. @default (count, voted) => voted ? `Remove your vote, ${count} votes` : `Vote up, ${count} votes` */
  vote?: (count: number, voted: boolean, formatted: string) => string;
  /** The count where there is no vote button (a shared screen, or the viewer's own). @default (n) => `${n} votes` */
  count?: (count: number, formatted: string) => string;
  /** Beside the pinned question. @default 'Answering now' */
  pinned?: string;
  /** Beside the viewer's own. @default 'Your question' */
  mine?: string;
  /** Under the list. @default (n) => `${n} questions` */
  status?: (count: number, formatted: string) => string;
  /** With no live questions. @default 'No questions yet. Ask the first one.' */
  empty?: string;
}

type QuestionBoardProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  /** Live questions, ranked (`rankQuestions`). */
  questions: readonly RankedQuestion[];
  /** Called when the viewer votes (`true`) or takes a vote back (`false`). Leave out for a shared screen: counts show without buttons. */
  onVote?: (id: string, on: boolean) => void;
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
  locale?: string;
  labels?: QuestionBoardLabels;
};

const VOTE: NonNullable<QuestionBoardLabels['vote']> = (n, voted, f) =>
  `${voted ? 'Remove your vote' : 'Vote up'}, ${f} ${n === 1 ? 'vote' : 'votes'}`;

const COUNT: NonNullable<QuestionBoardLabels['count']> = (n, f) => `${f} ${n === 1 ? 'vote' : 'votes'}`;

function VoteCount({ value, formatted }: { value: number; formatted: string }) {
  // Re-keyed on change, so the new number rises into place once.
  return (
    <span
      key={value}
      aria-hidden
      className="motion-safe:animate-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-(--duration-base) motion-safe:ease-enter inline-block tabular-nums"
    >
      {formatted}
    </span>
  );
}

function QuestionBoard({
  questions,
  onVote,
  size = 'default',
  locale,
  labels,
  className,
  ...props
}: QuestionBoardProps) {
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const stage = size === 'stage';

  return (
    <section
      data-slot="question-board"
      data-size={size}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      {questions.length > 0 ? (
        <FlipGroup render={<ol />} data-slot="question-board-list" className="grid gap-3">
          {questions.map((q) => {
            const formatted = nf.format(q.count);
            return (
              <li
                key={q.id}
                data-flip-id={q.id}
                data-slot="question-board-item"
                data-pinned={q.pinned ? '' : undefined}
                data-mine={q.mine ? '' : undefined}
                className={cn(
                  'bg-card relative grid grid-cols-[1fr_auto] items-start gap-4 rounded-lg border p-4',
                  'transition-[border-color,box-shadow] duration-(--duration-medium) ease-enter',
                  q.pinned && 'border-primary shadow-sm',
                  stage && 'p-6',
                )}
              >
                {q.pinned ? (
                  <span aria-hidden className="bg-primary absolute inset-y-3 start-0 w-1 rounded-e-full" />
                ) : null}
                <div className="grid min-w-0 gap-1.5">
                  {q.pinned || q.mine ? (
                    <p className="flex flex-wrap gap-x-3 text-xs font-semibold">
                      {q.pinned ? (
                        <span className="text-primary inline-flex items-center gap-1">
                          <Pin aria-hidden className="size-3.5" />
                          {labels?.pinned ?? 'Answering now'}
                        </span>
                      ) : null}
                      {q.mine ? <span className="text-muted-foreground">{labels?.mine ?? 'Your question'}</span> : null}
                    </p>
                  ) : null}
                  <p
                    data-slot="question-board-text"
                    className={cn('break-words text-pretty', stage ? 'text-2xl leading-snug' : 'text-base')}
                  >
                    {q.text}
                  </p>
                </div>
                {onVote && !q.mine ? (
                  <Button
                    type="button"
                    data-slot="question-board-vote"
                    variant={q.voted ? 'default' : 'outline'}
                    size={stage ? 'lg' : 'default'}
                    aria-pressed={q.voted}
                    aria-label={(labels?.vote ?? VOTE)(q.count, q.voted, formatted)}
                    onClick={() => onVote(q.id, !q.voted)}
                    className="h-auto min-h-11 min-w-14 flex-col gap-0 py-1.5"
                  >
                    <ArrowUp
                      aria-hidden
                      className={cn(
                        'size-4 transition-transform duration-(--duration-fast) ease-enter',
                        q.voted && 'motion-safe:-translate-y-0.5',
                      )}
                    />
                    <VoteCount value={q.count} formatted={formatted} />
                  </Button>
                ) : (
                  <span
                    data-slot="question-board-count"
                    className={cn(
                      'text-muted-foreground flex min-h-11 min-w-14 flex-col items-center justify-center text-sm font-medium',
                      stage && 'text-lg',
                    )}
                  >
                    <ArrowUp aria-hidden className="size-4" />
                    <VoteCount value={q.count} formatted={formatted} />
                    <span className="sr-only">{(labels?.count ?? COUNT)(q.count, formatted)}</span>
                  </span>
                )}
              </li>
            );
          })}
        </FlipGroup>
      ) : null}
      <p data-slot="question-board-status" aria-live="polite" className="text-muted-foreground text-sm">
        {questions.length === 0
          ? (labels?.empty ?? 'No questions yet. Ask the first one.')
          : (labels?.status ?? ((n: number, f: string) => `${f} ${n === 1 ? 'question' : 'questions'}`))(
              questions.length,
              nf.format(questions.length),
            )}
      </p>
    </section>
  );
}
QuestionBoard.displayName = 'QuestionBoard';

// --- QuestionAsk ------------------------------------------------------------------

interface QuestionAskLabels {
  /** @default 'Your question' */
  field?: string;
  /** @default 'Ask' */
  send?: string;
  /** After sending, when the room is moderated. @default 'Sent. A moderator will check it before it shows.' */
  sentReview?: string;
  /** After sending, when it goes live at once. @default 'Sent. It is on the board.' */
  sentLive?: string;
  /** Characters left. @default (n) => `${n} characters left` */
  left?: (remaining: number) => string;
  /** When asking is closed. @default 'Questions are closed for now.' */
  closed?: string;
  refused?: Partial<Record<TextRefusal, string>>;
}

type QuestionAskProps = Omit<React.ComponentProps<'form'>, 'onSubmit' | 'children'> &
  Pick<TextRules, 'blocklist'> & {
    /** Called with the checked text. */
    onAsk?: (text: string) => void;
    /** New questions wait for review (changes the thanks). @default true */
    moderated?: boolean;
    /** @default 200 */
    maxLength?: number;
    disabled?: boolean;
    placeholder?: string;
    labels?: QuestionAskLabels;
  };

const ASK_REFUSED: Record<TextRefusal, string> = {
  empty: 'Type a question first.',
  'too-long': 'That is too long. Try a shorter question.',
  'too-many-words': 'That is too long. Try a shorter question.',
  link: 'Links cannot be sent here.',
  contact: 'Email addresses and phone numbers cannot be sent here.',
  blocked: 'That question cannot be shown here. Try other words.',
};

function QuestionAsk({
  onAsk,
  moderated = true,
  maxLength = 200,
  blocklist,
  disabled = false,
  placeholder,
  labels,
  className,
  ...props
}: QuestionAskProps) {
  const [value, setValue] = React.useState('');
  const [state, setState] = React.useState<
    { kind: 'idle' } | { kind: 'sent' } | { kind: 'refused'; reason: TextRefusal }
  >({
    kind: 'idle',
  });
  const fieldId = React.useId();
  const messageId = React.useId();
  const remaining = maxLength - visibleLength(value);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    const check = checkText(value, { maxLength, blocklist });
    if (!check.ok) {
      setState({ kind: 'refused', reason: check.reason });
      return;
    }
    setValue('');
    setState({ kind: 'sent' });
    onAsk?.(check.text);
  };

  const message = disabled
    ? (labels?.closed ?? 'Questions are closed for now.')
    : state.kind === 'refused'
      ? (labels?.refused?.[state.reason] ?? ASK_REFUSED[state.reason])
      : state.kind === 'sent'
        ? moderated
          ? (labels?.sentReview ?? 'Sent. A moderator will check it before it shows.')
          : (labels?.sentLive ?? 'Sent. It is on the board.')
        : '';

  return (
    <form
      data-slot="question-ask"
      data-state={disabled ? 'closed' : state.kind}
      data-min-viewport={String(MIN_VIEWPORT)}
      noValidate
      onSubmit={submit}
      className={cn('grid gap-2', className)}
      {...props}
    >
      <label htmlFor={fieldId} className="text-sm font-medium">
        {labels?.field ?? 'Your question'}
      </label>
      <Textarea
        id={fieldId}
        value={value}
        rows={3}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={state.kind === 'refused' ? true : undefined}
        aria-describedby={messageId}
        onChange={(e) => {
          setValue(e.target.value);
          if (state.kind !== 'idle') setState({ kind: 'idle' });
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <span
          data-slot="question-ask-count"
          className={cn('text-xs tabular-nums', remaining < 0 ? 'text-destructive' : 'text-muted-foreground')}
        >
          {(labels?.left ?? ((n: number) => `${n} characters left`))(remaining)}
        </span>
        <Button type="submit" disabled={disabled}>
          {labels?.send ?? 'Ask'}
        </Button>
      </div>
      <p
        id={messageId}
        data-slot="question-ask-message"
        aria-live="polite"
        className={cn('min-h-5 text-sm', state.kind === 'refused' ? 'text-destructive' : 'text-muted-foreground')}
      >
        {message}
      </p>
    </form>
  );
}
QuestionAsk.displayName = 'QuestionAsk';

// --- QuestionQueue ----------------------------------------------------------------

interface QuestionQueueLabels {
  /** @default 'In review' */
  review?: string;
  /** @default 'On the board' */
  live?: string;
  /** @default 'Answered and hidden' */
  done?: string;
  /** @default 'Nothing waiting.' */
  emptyReview?: string;
  approve?: string;
  dismiss?: string;
  pin?: string;
  unpin?: string;
  answer?: string;
  restore?: string;
  /** Vote count beside a live question. @default (n) => `${n} votes` */
  votes?: (count: number, formatted: string) => string;
}

type QuestionQueueProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** Questions waiting for review, oldest first. */
  review: readonly RankedQuestion[];
  /** Live questions, ranked. */
  live: readonly RankedQuestion[];
  /** Answered and dismissed questions, to restore. */
  done?: readonly RankedQuestion[];
  /** Every action sends one event for `applyBoardEvent`. */
  onEvent: (event: BoardEvent) => void;
  locale?: string;
  labels?: QuestionQueueLabels;
};

function QueueRow({ q, children, meta }: { q: RankedQuestion; children: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <li
      data-flip-id={q.id}
      data-slot="question-queue-item"
      data-status={q.status}
      data-pinned={q.pinned ? '' : undefined}
      className={cn('grid gap-2 rounded-md border p-3', q.pinned && 'border-primary')}
    >
      <p className="break-words text-sm">{q.text}</p>
      <div className="flex flex-wrap items-center gap-2">
        {meta ? <span className="text-muted-foreground me-auto text-xs tabular-nums">{meta}</span> : null}
        {children}
      </div>
    </li>
  );
}

function QueueSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h3 id={id} className="flex items-baseline gap-2 text-sm font-semibold">
        {title}
        <span className="text-muted-foreground text-xs font-normal tabular-nums">{count}</span>
      </h3>
      {children}
    </section>
  );
}

function QuestionQueue({ review, live, done = [], onEvent, locale, labels, className, ...props }: QuestionQueueProps) {
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const votes = labels?.votes ?? ((n: number, f: string) => `${f} ${n === 1 ? 'vote' : 'votes'}`);
  return (
    <div
      data-slot="question-queue"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-6', className)}
      {...props}
    >
      <QueueSection title={labels?.review ?? 'In review'} count={review.length}>
        {review.length === 0 ? (
          <p className="text-muted-foreground text-sm">{labels?.emptyReview ?? 'Nothing waiting.'}</p>
        ) : (
          <FlipGroup render={<ul />} className="grid gap-2">
            {review.map((q) => (
              <QueueRow key={q.id} q={q}>
                <Button size="sm" onClick={() => onEvent({ type: 'approve', id: q.id })}>
                  <Check aria-hidden />
                  {labels?.approve ?? 'Approve'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onEvent({ type: 'dismiss', id: q.id })}>
                  <EyeOff aria-hidden />
                  {labels?.dismiss ?? 'Dismiss'}
                </Button>
              </QueueRow>
            ))}
          </FlipGroup>
        )}
      </QueueSection>

      <QueueSection title={labels?.live ?? 'On the board'} count={live.length}>
        <FlipGroup render={<ul />} className="grid gap-2">
          {live.map((q) => (
            <QueueRow key={q.id} q={q} meta={votes(q.count, nf.format(q.count))}>
              <Button
                size="sm"
                variant={q.pinned ? 'default' : 'outline'}
                aria-pressed={q.pinned}
                onClick={() => onEvent({ type: 'pin', id: q.pinned ? null : q.id })}
              >
                {q.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
                {q.pinned ? (labels?.unpin ?? 'Unpin') : (labels?.pin ?? 'Pin')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEvent({ type: 'answer', id: q.id })}>
                <Check aria-hidden />
                {labels?.answer ?? 'Answered'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEvent({ type: 'dismiss', id: q.id })}>
                <EyeOff aria-hidden />
                {labels?.dismiss ?? 'Hide'}
              </Button>
            </QueueRow>
          ))}
        </FlipGroup>
      </QueueSection>

      {done.length > 0 ? (
        <QueueSection title={labels?.done ?? 'Answered and hidden'} count={done.length}>
          <ul className="grid gap-2">
            {done.map((q) => (
              <QueueRow key={q.id} q={q}>
                <Button size="sm" variant="ghost" onClick={() => onEvent({ type: 'restore', id: q.id })}>
                  <RotateCcw aria-hidden />
                  {labels?.restore ?? 'Back to the board'}
                </Button>
              </QueueRow>
            ))}
          </ul>
        </QueueSection>
      ) : null}
    </div>
  );
}
QuestionQueue.displayName = 'QuestionQueue';

export { QuestionBoard, QuestionAsk, QuestionQueue };
export type {
  QuestionBoardProps,
  QuestionBoardLabels,
  QuestionAskProps,
  QuestionAskLabels,
  QuestionQueueProps,
  QuestionQueueLabels,
};
