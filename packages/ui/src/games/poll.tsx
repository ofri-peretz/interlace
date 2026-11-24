'use client';

/**
 * @interlace/ui — Poll
 *
 * One question, one tap. The options are plain buttons; tapping one casts
 * the vote, and the options turn into the results in place, with the bars
 * growing to everyone's shares and the viewer's choice named. There is no
 * submit step, because a poll that asks twice gets half the answers.
 *
 * ## Anatomy
 *
 *   Poll                           (div — data-slot="poll", data-state=open|voted)
 *     ├─ p                         (data-slot="poll-question", id ← the option group's label)
 *     ├─ div role="group"          (data-slot="poll-options": one Button per option, before the vote)
 *     ├─ TallyBars                 (after the vote, when at least `minVotes` are in)
 *     ├─ p tabIndex=-1 aria-live   (data-slot="poll-result": the result in one sentence)
 *     └─ div                       (data-slot="poll-footer": optional, e.g. "Closes Friday")
 *
 * ## Data
 *
 * `counts` are the votes per option id from your store. Leave out the
 * viewer's own vote (`countsIncludeVote={false}`, the default) and the poll
 * adds it, so the results are right the moment they tap; pass `true` when
 * the counts came back from the server with it. `vote` / `defaultVote` hold
 * the viewer's choice, so a page that remembers it opens on the results.
 * `onVote` fires once, with the option id.
 *
 * Small polls give voters away. `minVotes` keeps the shares hidden until
 * that many votes are in, and says so.
 *
 * ## Motion
 *
 * The bars grow from zero to their shares on the vote (TallyBars, 400ms).
 * Under reduced motion they are simply there. Restoring a stored vote
 * draws them in place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                        |
 * | R6   | data-slot per part        | poll / -question / -options / -result / -footer      |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R9   | Controlled + uncontrolled | `vote` / `defaultVote` / `onVote`                    |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | labelled group of buttons; result announced and focused |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { TallyBars, type TallyBarsLabels } from './tally-bars.js';
import { tally } from './tally-model.js';

export const MIN_VIEWPORT = 320 as const;

interface PollOption {
  id: string;
  label: React.ReactNode;
  /** Plain text for the result sentence, when `label` is not a string. */
  text?: string;
}

interface PollLabels extends TallyBarsLabels {
  /** After the vote. @default ({ option, percent, total }) => `You chose ${option}, with ${percent} of ${total}.` */
  result?: (r: { option: string; percent: string; total: string; count: number }) => string;
  /** While fewer than `minVotes` are in. @default (min) => `Thanks. The results show once ${min} people have voted.` */
  pending?: (min: number) => string;
}

type PollProps = Omit<React.ComponentProps<'div'>, 'children' | 'onChange'> & {
  question: React.ReactNode;
  options: readonly PollOption[];
  /** Votes per option id from your store. */
  counts?: Readonly<Record<string, number>>;
  /** `counts` already include this viewer's vote. @default false */
  countsIncludeVote?: boolean;
  /** The viewer's choice, controlled. null for none yet. */
  vote?: string | null;
  /** The viewer's choice, uncontrolled. */
  defaultVote?: string | null;
  /** Called once, when the viewer taps an option. */
  onVote?: (optionId: string) => void;
  /** Hide the shares until this many votes are in. @default 1 */
  minVotes?: number;
  /** Under the results: when the poll closes, what it is for. */
  footer?: React.ReactNode;
  locale?: string;
  labels?: PollLabels;
};

const RESULT: NonNullable<PollLabels['result']> = ({ option, percent, total }) =>
  `You chose ${option}, with ${percent} of ${total}.`;
const PENDING: NonNullable<PollLabels['pending']> = (min) =>
  `Thanks. The results show once ${min} people have voted.`;

const textOf = (o: PollOption) => o.text ?? (typeof o.label === 'string' || typeof o.label === 'number' ? String(o.label) : o.id);

function Poll({
  question,
  options,
  counts,
  countsIncludeVote = false,
  vote: voteProp,
  defaultVote = null,
  onVote,
  minVotes = 1,
  footer,
  locale,
  labels,
  className,
  ...props
}: PollProps) {
  const [uncontrolled, setUncontrolled] = React.useState<string | null>(defaultVote);
  const vote = voteProp === undefined ? uncontrolled : voteProp;
  const voted = vote !== null && vote !== undefined && options.some((o) => o.id === vote);
  const questionId = React.useId();
  const resultRef = React.useRef<HTMLParagraphElement>(null);
  const groupRef = React.useRef<HTMLDivElement>(null);
  const sent = React.useRef(voted);
  const moveFocus = React.useRef(false);
  // Bars grow only for a vote cast here, not for one restored on load.
  const [castHere, setCastHere] = React.useState(false);

  const ids = options.map((o) => o.id);
  const { rows, total } = tally(ids, counts, { vote: voted ? vote : null, countsIncludeVote });
  const shown = voted && total >= minVotes;
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = React.useMemo(() => new Intl.NumberFormat(locale, { style: 'percent' }), [locale]);

  React.useEffect(() => {
    if (!voted) sent.current = false;
  }, [voted]);

  React.useEffect(() => {
    if (!voted || !moveFocus.current) return;
    moveFocus.current = false;
    resultRef.current?.focus();
  }, [voted]);

  const cast = (id: string) => {
    if (voted || sent.current) return;
    sent.current = true;
    // The buttons go away: if focus was on one, the result takes it.
    moveFocus.current = !!groupRef.current?.contains(document.activeElement);
    setCastHere(true);
    if (voteProp === undefined) setUncontrolled(id);
    onVote?.(id);
  };

  const mine = rows.find((r) => r.mine);
  const chosen = options.find((o) => o.id === vote);
  const totalText = (labels?.total ?? ((n: number, f: string) => `${f} ${n === 1 ? 'vote' : 'votes'}`))(total, nf.format(total));

  return (
    <div
      data-slot="poll"
      data-state={voted ? 'voted' : 'open'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      <p id={questionId} data-slot="poll-question" className="font-heading text-lg font-semibold text-balance">
        {question}
      </p>

      {!voted ? (
        <div ref={groupRef} role="group" aria-labelledby={questionId} data-slot="poll-options" className="grid gap-2">
          {options.map((o) => (
            <Button
              key={o.id}
              type="button"
              variant="outline"
              size="lg"
              className="h-auto min-h-11 justify-start py-2.5 text-start whitespace-normal"
              onClick={() => cast(o.id)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      ) : shown ? (
        <TallyBars
          rows={rows}
          optionLabels={Object.fromEntries(options.map((o) => [o.id, o.label]))}
          animate={castHere}
          locale={locale}
          labels={labels}
        />
      ) : null}

      <p
        ref={resultRef}
        tabIndex={-1}
        data-slot="poll-result"
        aria-live="polite"
        className="focus-visible:outline-ring rounded-sm text-sm outline-offset-4 empty:hidden focus-visible:outline-2"
      >
        {voted && chosen && mine
          ? shown
            ? (labels?.result ?? RESULT)({
                option: textOf(chosen),
                percent: pf.format(mine.percent / 100),
                total: totalText,
                count: total,
              })
            : (labels?.pending ?? PENDING)(minVotes)
          : ''}
      </p>

      {footer ? (
        <div data-slot="poll-footer" className="text-muted-foreground text-xs">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
Poll.displayName = 'Poll';

export { Poll };
export type { PollProps, PollOption, PollLabels };
