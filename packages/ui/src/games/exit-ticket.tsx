'use client';

/**
 * @interlace/ui — ExitTicket
 *
 * Three quick questions as people leave, while it is fresh: how likely to recommend (0 to 10, grouped
 * the standard way into promoters, passives and detractors), a rating on a short scale, and a choice.
 * Answers go in with one button and can be changed until the host closes it. After sending, the room's
 * numbers are shown as plain sentences, never as who said what, and only once enough people have sent
 * theirs.
 *
 * ## Anatomy
 *
 *   ExitTicket                       (div — data-slot="exit-ticket", data-state=answering|sent|closed)
 *     ├─ form                        (data-slot="exit-ticket-form", while answering)
 *     │    ├─ RadioGroup × n         (data-slot="exit-ticket-question": one radio per step or option)
 *     │    └─ Button                 (data-slot="exit-ticket-send")
 *     ├─ ul                          (data-slot="exit-ticket-results", after sending, once `minResponses` have)
 *     └─ p tabIndex=-1 aria-live     (data-slot="exit-ticket-status": thanks, or why not)
 *
 * ## Data
 *
 * `questions` are from `exit-ticket-model` (`nps`, `scale`, `choice`). `value` is this viewer's
 * answers (controlled; null before they send), `defaultValue` starts uncontrolled, `onSend` receives
 * the answers (question id to number or option id). `summary` and `count` are the room's, from
 * `summarizeTicket`. `closed` stops changing. `minResponses` keeps the numbers hidden until then.
 *
 * ## Motion
 *
 * None beyond a colour change on the chosen step (`--duration-fast`).
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                     |
 * | ---- | ------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el         | `div` props                                            |
 * | R6   | data-slot per part        | exit-ticket / -form / -question / -send / -results / -status |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                      |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onSend`                    |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                   |
 * | R26  | A11y                      | labelled radio groups; thanks announced and focused    |
 */

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import type { QuestionSummary, TicketAnswers, TicketQuestion } from './exit-ticket-model.js';

export const MIN_VIEWPORT = 320 as const;

interface ExitTicketLabels {
  /** @default 'Send' */
  send?: string;
  /** @default 'Change my answers' */
  change?: string;
  /** The low and high ends of the 0 to 10 question. @default ['Not at all likely', 'Extremely likely'] */
  npsEnds?: readonly [string, string];
  /** @default 'Thanks. Your answers are in.' */
  thanks?: string;
  /** While fewer than `minResponses` have sent. @default (min) => `The room's numbers show once ${min} people have sent theirs.` */
  pending?: (min: number) => string;
  /** Once the host closes it. @default 'The exit ticket is closed.' */
  closed?: string;
  /** Under the send button until one question is answered. @default 'Answer at least one question.' */
  needOne?: string;
}

type ExitTicketProps = Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue' | 'onChange'> & {
  questions: readonly TicketQuestion[];
  /** This viewer's answers, controlled. null before they send. */
  value?: TicketAnswers | null;
  /** This viewer's answers, uncontrolled. */
  defaultValue?: TicketAnswers | null;
  /** Called with the answers each time the viewer sends. */
  onSend?: (answers: TicketAnswers) => void;
  /** The room's answers, per question, from `summarizeTicket`. */
  summary?: readonly QuestionSummary[];
  /** How many people have sent theirs. */
  count?: number;
  /** The host closed it: no more changes. @default false */
  closed?: boolean;
  /** Hide the room's numbers until this many have sent. @default 1 */
  minResponses?: number;
  labels?: ExitTicketLabels;
};

const PENDING: NonNullable<ExitTicketLabels['pending']> = (min) => `The room's numbers show once ${min} people have sent theirs.`;

const step =
  'bg-background text-foreground grid min-h-11 min-w-11 place-items-center rounded-md border px-2 text-base font-semibold tabular-nums ' +
  'motion-safe:transition-colors motion-safe:duration-(--duration-fast) hover:bg-muted ' +
  'data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[checked]:border-primary ' +
  'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2';

function Results({ questions, summary, nf }: { questions: readonly TicketQuestion[]; summary: readonly QuestionSummary[]; nf: Intl.NumberFormat }) {
  return (
    <ul data-slot="exit-ticket-results" className="grid gap-3 text-sm">
      {questions.map((q) => {
        const s = summary.find((x) => x.id === q.id);
        if (!s) return null;
        return (
          <li key={q.id} className="grid gap-1">
            <span className="font-semibold">{q.prompt}</span>
            {s.kind === 'nps' ? (
              <span data-slot="exit-ticket-nps">
                {s.score === null
                  ? 'No answers yet.'
                  : `Score ${nf.format(s.score)}: ${nf.format(s.promoters)} promoters, ${nf.format(s.passives)} passives, ${nf.format(s.detractors)} detractors.`}
              </span>
            ) : s.kind === 'scale' ? (
              <span>
                {s.mean === null ? 'No answers yet.' : `Average ${nf.format(Math.round(s.mean * 10) / 10)} from ${nf.format(s.count)} ${s.count === 1 ? 'person' : 'people'}.`}
              </span>
            ) : (
              <span>{s.options.map((o) => `${o.label}: ${nf.format(o.count)}`).join('. ')}.</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ExitTicket({
  questions,
  value: valueProp,
  defaultValue = null,
  onSend,
  summary = [],
  count = 0,
  closed = false,
  minResponses = 1,
  labels,
  className,
  ...props
}: ExitTicketProps) {
  const [own, setOwn] = React.useState<TicketAnswers | null>(defaultValue);
  const sent = valueProp === undefined ? own : valueProp;
  const [draft, setDraft] = React.useState<TicketAnswers>(sent ?? {});
  const [changing, setChanging] = React.useState(false);
  const [sentHere, setSentHere] = React.useState(false);
  const statusRef = React.useRef<HTMLParagraphElement>(null);
  const baseId = React.useId();
  const nf = React.useMemo(() => new Intl.NumberFormat(), []);

  const answering = (sent === null || changing) && !closed;
  const shown = sent !== null && count >= minResponses;
  const answered = Object.keys(draft).length > 0;

  React.useEffect(() => {
    if (sentHere) statusRef.current?.focus();
  }, [sentHere, sent]);

  const set = (id: string, v: number | string) => setDraft((d) => ({ ...d, [id]: v }));
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answered || closed) return;
    if (valueProp === undefined) setOwn(draft);
    setChanging(false);
    setSentHere(true);
    onSend?.(draft);
  };

  const status = closed
    ? (labels?.closed ?? 'The exit ticket is closed.')
    : sent !== null && !changing
      ? [labels?.thanks ?? 'Thanks. Your answers are in.', shown ? '' : (labels?.pending ?? PENDING)(minResponses)].filter(Boolean).join(' ')
      : '';

  return (
    <div
      data-slot="exit-ticket"
      data-state={closed ? 'closed' : answering ? 'answering' : 'sent'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      {answering ? (
        <form data-slot="exit-ticket-form" onSubmit={send} className="grid gap-5">
          {questions.map((q) => {
            const id = `${baseId}-${q.id}`;
            const current = Object.hasOwn(draft, q.id) ? draft[q.id] : undefined;
            const ends = labels?.npsEnds ?? ['Not at all likely', 'Extremely likely'];
            return (
              <div key={q.id} className="grid gap-2">
                <p id={id} className="font-heading text-base font-semibold text-balance">
                  {q.prompt}
                </p>
                <RadioGroup
                  data-slot="exit-ticket-question"
                  aria-labelledby={id}
                  value={current === undefined ? null : current}
                  onValueChange={(v) => set(q.id, v as number | string)}
                  className={cn('flex gap-1.5', q.kind === 'choice' ? 'flex-col' : 'flex-wrap')}
                >
                  {q.kind === 'choice'
                    ? q.options.map((o) => (
                        <Radio.Root key={o.id} value={o.id} className={cn(step, 'justify-start text-start font-normal')}>
                          {o.label}
                        </Radio.Root>
                      ))
                    : Array.from(
                        q.kind === 'nps' ? { length: 11 } : { length: q.max - q.min + 1 },
                        (_, i) => (q.kind === 'nps' ? 0 : q.min) + i,
                      ).map((n) => (
                        <Radio.Root key={n} value={n} className={step}>
                          {n}
                        </Radio.Root>
                      ))}
                </RadioGroup>
                {q.kind === 'nps' ? (
                  <div className="text-muted-foreground flex justify-between gap-4 text-sm">
                    <span>{ends[0]}</span>
                    <span className="text-end">{ends[1]}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={!answered} data-slot="exit-ticket-send">
              {labels?.send ?? 'Send'}
            </Button>
            {!answered ? <span className="text-muted-foreground text-sm">{labels?.needOne ?? 'Answer at least one question.'}</span> : null}
          </div>
        </form>
      ) : null}

      {shown && !answering ? <Results questions={questions} summary={summary} nf={nf} /> : null}

      {sent !== null && !changing && !closed ? (
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => {
            setDraft(sent);
            setChanging(true);
          }}
        >
          {labels?.change ?? 'Change my answers'}
        </Button>
      ) : null}

      <p
        ref={statusRef}
        tabIndex={-1}
        data-slot="exit-ticket-status"
        aria-live="polite"
        className="focus-visible:outline-ring rounded-sm text-sm outline-offset-4 empty:hidden focus-visible:outline-2"
      >
        {status}
      </p>
    </div>
  );
}
ExitTicket.displayName = 'ExitTicket';

export { ExitTicket };
export type { ExitTicketProps, ExitTicketLabels };
