'use client';

/**
 * @interlace/ui — DotVote
 *
 * After a brainstorm, the room chooses: each person spreads a few dots
 * across the ideas (two on one idea means "this one, really"), sends them,
 * and watches the ideas rank themselves as everyone's dots come in. It
 * pairs with `TextWall` or `QuestionBoard` for the brainstorm before it.
 *
 * ## Anatomy
 *
 *   DotVote                        (div — data-slot="dot-vote", data-state=voting|sent)
 *     ├─ p                         (data-slot="dot-vote-question")
 *     ├─ ul                        (data-slot="dot-vote-ideas": while voting)
 *     │   └─ li × n                (data-slot="dot-vote-idea": text, pips, − and + with names)
 *     ├─ div                       (data-slot="dot-vote-footer": dots left, announced; Send)
 *     ├─ p tabIndex=-1 aria-live   (data-slot="dot-vote-result": after sending)
 *     └─ ol                        (FlipGroup — data-slot="dot-vote-results": most dots first)
 *         └─ li × n                (data-slot="dot-vote-row": rank, text, bar, dots, yours)
 *
 * ## Motion
 *
 * A dot fills its pip with a small pop (`--duration-fast`). Once sent, the
 * bars grow to their share (400ms, `ease-enter`) and, as more dots arrive,
 * ideas glide to their new rank (FlipGroup, 400ms). Under reduced motion
 * everything is simply in place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                          |
 * | R6   | data-slot per part        | dot-vote / -question / -ideas / -idea / -footer / -result / -results / -row |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onSend`                  |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | each button names its idea; dots in words; dots left announced; result focused |
 */

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';

import { FlipGroup } from '../effects/flip-group.js';
import { cn } from '../lib/cn.js';
import { motionEase } from '../lib/motion-token.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { cleanBallot, dotsLeft, tallyDots, type DotBallot } from './dot-vote-model.js';

export const MIN_VIEWPORT = 320 as const;

interface DotIdea {
  id: string;
  text: string;
}

interface DotVoteLabels {
  /** @default 'Send my dots' */
  send?: string;
  /** @default (n) => `${n} dots left` */
  left?: (n: number, formatted: string) => string;
  /** @default (idea) => `Add a dot to ${idea}` */
  add?: (idea: string) => string;
  /** @default (idea) => `Take a dot from ${idea}` */
  remove?: (idea: string) => string;
  /** A count of dots, in words. @default (n) => `${n} dots` */
  count?: (n: number, formatted: string) => string;
  /** Beside the viewer's own dots in the results. @default (n) => `Yours: ${n}` */
  mine?: (n: number, formatted: string) => string;
  /** After sending. @default (voters) => `Sent. ${voters} people have voted so far.` */
  result?: (voters: number, formatted: string) => string;
}

type DotVoteProps = Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue'> & {
  question: React.ReactNode;
  ideas: readonly DotIdea[];
  /** Dots each person has. @default 3 */
  dots?: number;
  /** Most dots on one idea. @default dots */
  maxPerIdea?: number;
  /** The viewer's sent dots, controlled. null while voting. */
  value?: DotBallot | null;
  /** The viewer's sent dots, uncontrolled. */
  defaultValue?: DotBallot | null;
  /** Called once, when the viewer sends, with a valid ballot. */
  onSend?: (ballot: Record<string, number>) => void;
  /** Everyone's ballots, keyed by person; shown once the viewer has sent. */
  ballots?: Readonly<Record<string, DotBallot>>;
  /** `ballots` already hold this viewer's dots. @default false */
  ballotsIncludeOwn?: boolean;
  locale?: string;
  labels?: DotVoteLabels;
};

const plural = (word: string) => (n: number, f: string) => `${f} ${n === 1 ? word : `${word}s`}`;

function DotVote({
  question,
  ideas,
  dots = 3,
  maxPerIdea,
  value: valueProp,
  defaultValue = null,
  onSend,
  ballots = {},
  ballotsIncludeOwn = false,
  locale,
  labels,
  className,
  ...props
}: DotVoteProps) {
  const reduced = useReducedMotion();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const rules = { dots, maxPerIdea };
  const ids = ideas.map((i) => i.id);
  const [own, setOwn] = React.useState<DotBallot | null>(defaultValue);
  const sent = valueProp === undefined ? own : valueProp;
  const [draft, setDraft] = React.useState<Record<string, number>>({});
  const [sentHere, setSentHere] = React.useState(false);
  const questionId = React.useId();
  const resultRef = React.useRef<HTMLParagraphElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const left = dotsLeft(draft, rules);
  const cap = Math.min(dots, maxPerIdea ?? dots);
  const mine = sent ? cleanBallot(sent, ids, rules) : null;
  const room = tallyDots(mine && !ballotsIncludeOwn ? { ...ballots, 'you': mine } : ballots, ids, rules);
  const top = Math.max(1, ...room.rows.map((r) => r.dots));
  const textOf = (id: string) => ideas.find((i) => i.id === id)?.text ?? id;
  const countWords = labels?.count ?? plural('dot');

  React.useEffect(() => {
    if (!sentHere) return;
    resultRef.current?.focus();
    if (reduced) return;
    listRef.current?.querySelectorAll<HTMLElement>('[data-slot="dot-vote-fill"]').forEach((bar) => {
      if (typeof bar.animate !== 'function') return;
      bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
        duration: 400,
        easing: motionEase(bar, 'enter'),
      });
    });
    // Once, when this viewer's dots land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentHere]);

  const change = (id: string, by: 1 | -1) =>
    setDraft((d) => cleanBallot({ ...d, [id]: Math.max(0, (d[id] ?? 0) + by) }, ids, rules));

  const send = () => {
    if (sent) return;
    const ballot = cleanBallot(draft, ids, rules);
    if (Object.keys(ballot).length === 0) return;
    setSentHere(true);
    if (valueProp === undefined) setOwn(ballot);
    onSend?.(ballot);
  };

  return (
    <div
      data-slot="dot-vote"
      data-state={sent ? 'sent' : 'voting'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      <p id={questionId} data-slot="dot-vote-question" className="font-heading text-lg font-semibold text-balance">
        {question}
      </p>

      {sent ? null : (
        <>
          <ul data-slot="dot-vote-ideas" aria-labelledby={questionId} className="grid gap-2">
            {ideas.map((idea) => {
              const n = draft[idea.id] ?? 0;
              return (
                <li
                  key={idea.id}
                  data-slot="dot-vote-idea"
                  data-dots={n}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2',
                    'motion-safe:transition-colors motion-safe:duration-(--duration-fast)',
                    n > 0 ? 'border-primary bg-primary/5' : 'bg-background',
                  )}
                >
                  <span className="min-w-0 flex-1 text-base text-pretty">{idea.text}</span>
                  <span aria-hidden className="flex gap-1">
                    {Array.from({ length: cap }, (_, i) => (
                      <span
                        key={`pip-${i}`}
                        data-filled={i < n ? '' : undefined}
                        className={cn(
                          'size-2.5 rounded-full border',
                          'motion-safe:transition-[transform,background-color] motion-safe:duration-(--duration-fast) motion-safe:ease-enter',
                          i < n ? 'bg-primary border-primary scale-110' : 'border-muted-foreground/50 scale-100',
                        )}
                      />
                    ))}
                  </span>
                  <span className="sr-only">{countWords(n, nf.format(n))}</span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={(labels?.remove ?? ((t: string) => `Take a dot from ${t}`))(idea.text)}
                      disabled={n === 0}
                      onClick={() => change(idea.id, -1)}
                    >
                      <Minus aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={(labels?.add ?? ((t: string) => `Add a dot to ${t}`))(idea.text)}
                      disabled={left === 0 || n >= cap}
                      onClick={() => change(idea.id, 1)}
                    >
                      <Plus aria-hidden />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
          <div data-slot="dot-vote-footer" className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-muted-foreground text-sm tabular-nums">
              {(labels?.left ?? ((n: number, f: string) => `${f} ${n === 1 ? 'dot' : 'dots'} left`))(
                left,
                nf.format(left),
              )}
            </p>
            <Button data-slot="dot-vote-send" size="lg" disabled={left === dots} onClick={send}>
              {labels?.send ?? 'Send my dots'}
            </Button>
          </div>
        </>
      )}

      <p
        ref={resultRef}
        tabIndex={-1}
        data-slot="dot-vote-result"
        aria-live="polite"
        className="focus-visible:outline-ring rounded-sm text-sm outline-offset-4 empty:hidden focus-visible:outline-2"
      >
        {sent
          ? (
              labels?.result ??
              ((v: number, f: string) => `Sent. ${f} ${v === 1 ? 'person has' : 'people have'} voted so far.`)
            )(room.voters, nf.format(room.voters))
          : ''}
      </p>

      {sent ? (
        <div ref={listRef}>
          <FlipGroup render={<ol />} data-slot="dot-vote-results" className="grid gap-2">
            {room.rows.map((row) => {
              const yours = mine?.[row.id] ?? 0;
              return (
                <li
                  key={row.id}
                  data-slot="dot-vote-row"
                  data-flip-id={row.id}
                  data-mine={yours > 0 ? '' : undefined}
                  className="grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-x-3 gap-y-1"
                >
                  <span className="text-muted-foreground text-sm font-semibold tabular-nums">
                    {row.rank > 0 ? nf.format(row.rank) : ''}
                  </span>
                  <span className={cn('min-w-0 text-base text-pretty', yours > 0 && 'font-semibold')}>
                    {textOf(row.id)}
                    {yours > 0 ? (
                      <span className="text-primary ms-2 text-xs font-medium">
                        {(labels?.mine ?? ((_: number, f: string) => `Yours: ${f}`))(yours, nf.format(yours))}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm tabular-nums">{countWords(row.dots, nf.format(row.dots))}</span>
                  <span aria-hidden className="bg-muted col-start-2 col-end-4 block h-2 overflow-hidden rounded-full">
                    <span
                      data-slot="dot-vote-fill"
                      className={cn(
                        'block h-full origin-left rounded-full rtl:origin-right',
                        'motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:ease-move',
                        yours > 0 ? 'bg-primary' : 'bg-foreground/35',
                      )}
                      style={{ transform: `scaleX(${row.dots / top})` }}
                    />
                  </span>
                </li>
              );
            })}
          </FlipGroup>
        </div>
      ) : null}
    </div>
  );
}
DotVote.displayName = 'DotVote';

export { DotVote };
export type { DotVoteProps, DotVoteLabels, DotIdea };
