'use client';

/**
 * @interlace/ui — CommitmentPicker, CommitmentCheckIn
 *
 * The end of a session, and a week later. `CommitmentPicker` asks each
 * person to pick one thing to do this week, from a short list or in their
 * own words, and says when they will be asked about it. `CommitmentCheckIn`
 * is that question, on the follow-up link: did you? Yes, partly, or not yet.
 * Together they turn "that was interesting" into something a person did,
 * and give whoever ran the session a number for it (`commitmentImpact`).
 *
 * ## Anatomy
 *
 *   CommitmentPicker               (div — data-slot="commitment", data-state=open|own|committed)
 *     ├─ p                         (data-slot="commitment-prompt", the options' group label)
 *     ├─ div role="group"          (data-slot="commitment-options": one Button per option, then "Something else")
 *     ├─ form                      (data-slot="commitment-own": label, input, submit; after "Something else")
 *     └─ div tabIndex=-1           (data-slot="commitment-summary": once committed)
 *         ├─ svg                   (data-slot="commitment-icon")
 *         ├─ p                     (data-slot="commitment-choice": "Your pick: …")
 *         ├─ p                     (data-slot="commitment-follow-up": when they will be asked)
 *         └─ Button?               (data-slot="commitment-change")
 *
 *   CommitmentCheckIn              (div — data-slot="commitment-check-in", data-state=open|answered, data-answer)
 *     ├─ p                         (data-slot="commitment-check-in-commitment": what they picked)
 *     ├─ p                         (data-slot="commitment-check-in-question", the group label)
 *     ├─ div role="group"          (data-slot="commitment-check-in-options": Yes / Partly / Not yet)
 *     ├─ p tabIndex=-1 aria-live   (data-slot="commitment-check-in-thanks")
 *     └─ div                       (data-slot="commitment-check-in-footer": optional, e.g. the next step)
 *
 * ## Data
 *
 * A commitment is `{ id, text }`: the option's id and its words, or
 * `id: null` for the person's own words. `value` / `defaultValue` /
 * `onValueChange` hold it (null after "Change"). Store `madeAt` with it;
 * `patterns/commitment-model` says when the follow-up is due
 * (`followUpAt`, `followUpState`) and what a room's answers add up to.
 *
 * ## Motion
 *
 * The check lands with a short scale (200ms) when the person commits here.
 * Transform only, off under reduced motion; a restored commitment shows
 * still.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                        |
 * | R6   | data-slot per part        | commitment-* / commitment-check-in-*                 |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onValueChange`; `answer` / `defaultAnswer` / `onAnswer` |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | labelled groups of buttons; focus moves to what replaced them |
 */

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { Input } from '../primitives/input.js';
import { CHECK_IN_ANSWERS, followUpAt, type CheckInAnswer } from './commitment-model.js';

export const MIN_VIEWPORT = 320 as const;

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const OWN_MAX = 120;

/** Moves focus to `ref` after a render that replaced the control the reader was on. */
function useFocusAfter<T extends HTMLElement>(when: boolean) {
  const ref = React.useRef<T>(null);
  const pending = React.useRef(false);
  React.useEffect(() => {
    if (!when || !pending.current) return;
    pending.current = false;
    ref.current?.focus();
  }, [when]);
  return [ref, pending] as const;
}

function usePop(when: boolean, reduced: boolean) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const armed = React.useRef(false);
  React.useEffect(() => {
    if (!when || !armed.current) return;
    armed.current = false;
    const el = ref.current;
    if (reduced || !el || typeof el.animate !== 'function') return;
    el.animate([{ transform: 'scale(0.5)' }, { transform: 'scale(1)' }], { duration: 200, easing: EASE });
  }, [when, reduced]);
  return [ref, armed] as const;
}

interface CommitmentOption {
  id: string;
  label: React.ReactNode;
  /** Plain text for the summary, when `label` is not a string. */
  text?: string;
}

interface CommitmentValue {
  /** The option's id, or null for the person's own words. */
  id: string | null;
  text: string;
}

interface CommitmentPickerLabels {
  /** The button that opens the own-words field. @default 'Something else' */
  own?: string;
  /** The own-words field's label. @default 'What will you do?' */
  ownField?: string;
  /** Submits the own words. @default 'Commit to it' */
  ownSubmit?: string;
  /** Before the choice in the summary. @default 'Your pick' */
  committed?: string;
  /** When they will be asked. `date` is null when the commitment time is unknown. */
  followUp?: (date: string | null) => string;
  /** @default 'Change' */
  change?: string;
}

type CommitmentPickerProps = Omit<React.ComponentProps<'div'>, 'children' | 'onChange' | 'defaultValue'> & {
  /** The ask, e.g. "Pick one thing to try this week". */
  prompt: React.ReactNode;
  options: readonly CommitmentOption[];
  /** Offer "Something else" with a short field. @default false */
  allowOwn?: boolean;
  value?: CommitmentValue | null;
  defaultValue?: CommitmentValue | null;
  /** Called with the commitment, and with null after "Change". */
  onValueChange?: (value: CommitmentValue | null) => void;
  /** When the shown commitment was made, in ms. Set for a restored one; the picker stamps its own. */
  madeAt?: number;
  /** Days until "did you?". @default 7 */
  followUpDays?: number;
  /** Show "Change" after committing. @default true */
  allowChange?: boolean;
  locale?: string;
  labels?: CommitmentPickerLabels;
};

const FOLLOW_UP: NonNullable<CommitmentPickerLabels['followUp']> = (date) =>
  date ? `We will ask how it went on ${date}.` : 'We will ask how it went in a week.';

const textOf = (o: CommitmentOption) =>
  o.text ?? (typeof o.label === 'string' || typeof o.label === 'number' ? String(o.label) : o.id);

function CommitmentPicker({
  prompt,
  options,
  allowOwn = false,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  madeAt: madeAtProp,
  followUpDays = 7,
  allowChange = true,
  locale,
  labels,
  className,
  ...props
}: CommitmentPickerProps) {
  const [uncontrolled, setUncontrolled] = React.useState<CommitmentValue | null>(defaultValue);
  const value = valueProp === undefined ? uncontrolled : valueProp;
  const committed = !!value && value.text.trim() !== '';
  const [writing, setWriting] = React.useState(false);
  const [own, setOwn] = React.useState('');
  const [stamped, setStamped] = React.useState<number | null>(null);
  const reduced = useReducedMotion();
  const promptId = React.useId();
  const fieldId = React.useId();
  const [summaryRef, focusSummary] = useFocusAfter<HTMLDivElement>(committed);
  const [iconRef, pop] = usePop(committed, reduced);
  const groupRef = React.useRef<HTMLDivElement>(null);
  const fieldRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (writing) fieldRef.current?.focus();
  }, [writing]);

  const set = (next: CommitmentValue | null) => {
    if (valueProp === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };

  const commit = (next: CommitmentValue) => {
    focusSummary.current = true;
    pop.current = true;
    setStamped(Date.now());
    setWriting(false);
    set(next);
  };

  const change = () => {
    setStamped(null);
    setOwn('');
    set(null);
    // The summary goes away; the options come back with focus on the first.
    requestFocus(groupRef);
  };

  const madeAt = madeAtProp ?? stamped;
  const date =
    madeAt === null || madeAt === undefined
      ? null
      : new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(
          new Date(followUpAt(madeAt, { days: followUpDays })),
        );

  return (
    <div
      data-slot="commitment"
      data-state={committed ? 'committed' : writing ? 'own' : 'open'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      {committed && value ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          data-slot="commitment-summary"
          className="bg-card text-card-foreground focus-visible:outline-ring grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-xl border p-4 outline-offset-4 focus-visible:outline-2"
        >
          <span
            ref={iconRef}
            data-slot="commitment-icon"
            aria-hidden="true"
            className="bg-primary text-primary-foreground row-span-2 inline-flex size-8 items-center justify-center rounded-full"
          >
            <Check className="size-4" />
          </span>
          <p data-slot="commitment-choice" className="font-medium text-pretty">
            <span className="text-muted-foreground font-normal">{labels?.committed ?? 'Your pick'}: </span>
            {value.text}
          </p>
          <p data-slot="commitment-follow-up" className="text-muted-foreground text-sm">
            {(labels?.followUp ?? FOLLOW_UP)(date)}
          </p>
          {allowChange ? (
            <div className="col-start-2 pt-2">
              <Button type="button" variant="outline" size="sm" data-slot="commitment-change" onClick={change}>
                {labels?.change ?? 'Change'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <p id={promptId} data-slot="commitment-prompt" className="font-heading text-lg font-semibold text-balance">
            {prompt}
          </p>
          <div ref={groupRef} role="group" aria-labelledby={promptId} data-slot="commitment-options" className="grid gap-2">
            {options.map((o) => (
              <Button
                key={o.id}
                type="button"
                variant="outline"
                size="lg"
                className="h-auto min-h-11 justify-start py-2.5 text-start whitespace-normal"
                onClick={() => commit({ id: o.id, text: textOf(o) })}
              >
                {o.label}
              </Button>
            ))}
            {allowOwn && !writing ? (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-auto min-h-11 justify-start py-2.5 text-start whitespace-normal"
                onClick={() => setWriting(true)}
              >
                {labels?.own ?? 'Something else'}
              </Button>
            ) : null}
          </div>
          {allowOwn && writing ? (
            <form
              data-slot="commitment-own"
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = own.trim();
                if (text) commit({ id: null, text });
              }}
            >
              <label htmlFor={fieldId} className="text-sm font-medium">
                {labels?.ownField ?? 'What will you do?'}
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  ref={fieldRef}
                  id={fieldId}
                  value={own}
                  maxLength={OWN_MAX}
                  autoComplete="off"
                  onChange={(e) => setOwn(e.target.value)}
                  className="min-w-0 flex-1 basis-48"
                />
                <Button type="submit" disabled={!own.trim()}>
                  {labels?.ownSubmit ?? 'Commit to it'}
                </Button>
              </div>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
CommitmentPicker.displayName = 'CommitmentPicker';

/** Focus the first button in a group once it is back in the document. */
function requestFocus(ref: React.RefObject<HTMLElement | null>) {
  setTimeout(() => ref.current?.querySelector<HTMLElement>('button')?.focus(), 0);
}

interface CommitmentCheckInLabels {
  /** @default 'Did you do it?' */
  question?: string;
  /** @default 'Yes' */
  done?: string;
  /** @default 'Partly' */
  partly?: string;
  /** @default 'Not yet' */
  notYet?: string;
  /** After answering. */
  thanks?: (answer: CheckInAnswer) => string;
  /** Before the commitment. @default 'Last time you picked' */
  picked?: string;
  /** @default 'Change my answer' */
  change?: string;
}

type CommitmentCheckInProps = Omit<React.ComponentProps<'div'>, 'children' | 'onChange'> & {
  /** What they picked, from the stored commitment. */
  commitment: React.ReactNode;
  answer?: CheckInAnswer | null;
  defaultAnswer?: CheckInAnswer | null;
  /** Called with each answer. */
  onAnswer?: (answer: CheckInAnswer | null) => void;
  /** Show "Change my answer" after answering. @default true */
  allowChange?: boolean;
  /** Under the answer: what to do next. */
  footer?: React.ReactNode;
  labels?: CommitmentCheckInLabels;
};

const THANKS: Record<CheckInAnswer, string> = {
  done: 'Well done, and thank you for telling us.',
  partly: 'A start counts. Thank you for telling us.',
  'not-yet': 'Thank you for saying so. It is still worth a try.',
};

function CommitmentCheckIn({
  commitment,
  answer: answerProp,
  defaultAnswer = null,
  onAnswer,
  allowChange = true,
  footer,
  labels,
  className,
  ...props
}: CommitmentCheckInProps) {
  const [uncontrolled, setUncontrolled] = React.useState<CheckInAnswer | null>(defaultAnswer);
  const raw = answerProp === undefined ? uncontrolled : answerProp;
  const answer = raw && CHECK_IN_ANSWERS.includes(raw) ? raw : null;
  const questionId = React.useId();
  const groupRef = React.useRef<HTMLDivElement>(null);
  const [thanksRef, focusThanks] = useFocusAfter<HTMLParagraphElement>(answer !== null);

  const set = (next: CheckInAnswer | null) => {
    if (answerProp === undefined) setUncontrolled(next);
    onAnswer?.(next);
  };

  const words: Record<CheckInAnswer, string> = {
    done: labels?.done ?? 'Yes',
    partly: labels?.partly ?? 'Partly',
    'not-yet': labels?.notYet ?? 'Not yet',
  };

  return (
    <div
      data-slot="commitment-check-in"
      data-state={answer ? 'answered' : 'open'}
      data-answer={answer ?? undefined}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      <p data-slot="commitment-check-in-commitment" className="text-pretty">
        <span className="text-muted-foreground">{labels?.picked ?? 'Last time you picked'}: </span>
        <span className="font-medium">{commitment}</span>
      </p>
      <p id={questionId} data-slot="commitment-check-in-question" className="font-heading text-lg font-semibold text-balance">
        {labels?.question ?? 'Did you do it?'}
      </p>
      {answer ? null : (
        <div
          ref={groupRef}
          role="group"
          aria-labelledby={questionId}
          data-slot="commitment-check-in-options"
          className="flex flex-wrap gap-2"
        >
          {CHECK_IN_ANSWERS.map((a) => (
            <Button
              key={a}
              type="button"
              variant="outline"
              size="lg"
              data-answer={a}
              className="min-w-24 flex-1"
              onClick={() => {
                focusThanks.current = !!groupRef.current?.contains(document.activeElement);
                set(a);
              }}
            >
              {words[a]}
            </Button>
          ))}
        </div>
      )}
      <p
        ref={thanksRef}
        tabIndex={-1}
        data-slot="commitment-check-in-thanks"
        aria-live="polite"
        className="focus-visible:outline-ring rounded-sm outline-offset-4 empty:hidden focus-visible:outline-2"
      >
        {answer ? (labels?.thanks?.(answer) ?? THANKS[answer]) : ''}
      </p>
      {answer && allowChange ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-slot="commitment-check-in-change"
            onClick={() => {
              set(null);
              requestFocus(groupRef);
            }}
          >
            {labels?.change ?? 'Change my answer'}
          </Button>
        </div>
      ) : null}
      {footer ? (
        <div data-slot="commitment-check-in-footer" className="text-muted-foreground text-sm">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
CommitmentCheckIn.displayName = 'CommitmentCheckIn';

export { CommitmentPicker, CommitmentCheckIn };
export type {
  CommitmentPickerProps,
  CommitmentPickerLabels,
  CommitmentOption,
  CommitmentValue,
  CommitmentCheckInProps,
  CommitmentCheckInLabels,
};
