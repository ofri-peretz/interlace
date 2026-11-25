'use client';

/**
 * @interlace/ui — InterestSignal, InterestBoard
 *
 * "I want more on this": one tap that tells whoever runs the talk, the
 * lesson or the page what people want to hear more about. The reader
 * presses a toggle on a topic; the host sees every topic ranked by how
 * many asked. It is the cheapest way to learn what an audience cares
 * about, because asking costs the reader nothing and can be taken back.
 *
 * ## Anatomy
 *
 *   InterestSignal                 (div — data-slot="interest-signal", data-state=idle|pressed)
 *     ├─ Button aria-pressed       (data-slot="interest-signal-button": the label never changes)
 *     │   └─ svg                   (data-slot="interest-signal-icon": plus, then a check)
 *     └─ p aria-live               (data-slot="interest-signal-status": "Noted", and how many others asked)
 *
 *   InterestBoard                  (section — data-slot="interest-board")
 *     ├─ h2?                       (data-slot="interest-board-title")
 *     ├─ ol                        (data-slot="interest-board-list")
 *     │   └─ li × n                (data-slot="interest-board-row", data-rank, data-mine)
 *     │       ├─ span              (data-slot="interest-board-label")
 *     │       ├─ span              (data-slot="interest-board-count": the number, in words for a screen reader)
 *     │       └─ span aria-hidden  (data-slot="interest-board-bar": the track)
 *     │           └─ span          (data-slot="interest-board-fill": drawn against the top topic, grows on mount)
 *     └─ p                         (data-slot="interest-board-note": empty, held back, or "+3 more")
 *
 * ## Data
 *
 * `InterestSignal` is a toggle: `pressed` / `defaultPressed` /
 * `onPressedChange`. Its accessible name stays the same in both states, as
 * `aria-pressed` requires; the status line says what happened. `count` is
 * how many others asked, from your store.
 *
 * `InterestBoard` ranks topics with `patterns/interest-model`
 * (`rankInterest`). `minCount` holds back topics too small to be anonymous.
 *
 * ## Motion
 *
 * The icon lands with a short scale (200ms) when pressed here, and the
 * board's bars grow from the start edge (400ms) when it first shows. Both
 * are transform only, and both are off under reduced motion.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>` / `<'section'>`         |
 * | R6   | data-slot per part        | interest-signal-* / interest-board-*                 |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R9   | Controlled + uncontrolled | `pressed` / `defaultPressed` / `onPressedChange`     |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | toggle with a stable name; status announced politely |
 */

import * as React from 'react';
import { Check, Plus } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { rankInterest } from './interest-model.js';

export const MIN_VIEWPORT = 320 as const;

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface InterestSignalLabels {
  /** The button. It stays the same when pressed. @default 'I want more on this' */
  action?: string;
  /** After pressing. @default 'Noted.' */
  noted?: string;
  /** How many others asked. @default (n, f) => `${f} other(s) asked too.` */
  others?: (count: number, formatted: string) => string;
}

type InterestSignalProps = Omit<React.ComponentProps<'div'>, 'children' | 'onChange'> & {
  /** Pressed, controlled. */
  pressed?: boolean;
  /** Pressed, uncontrolled. @default false */
  defaultPressed?: boolean;
  /** Called on every press and un-press. */
  onPressedChange?: (pressed: boolean) => void;
  /** How many others asked for more, from your store. Shown once pressed. */
  count?: number;
  /** What the topic is, for a screen reader, when the button sits away from its heading. */
  topic?: string;
  /** @default 'default' */
  size?: 'sm' | 'default';
  disabled?: boolean;
  locale?: string;
  labels?: InterestSignalLabels;
};

const OTHERS: NonNullable<InterestSignalLabels['others']> = (n, f) =>
  `${f} ${n === 1 ? 'other person' : 'others'} asked too.`;

function InterestSignal({
  pressed: pressedProp,
  defaultPressed = false,
  onPressedChange,
  count,
  topic,
  size = 'default',
  disabled,
  locale,
  labels,
  className,
  ...props
}: InterestSignalProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultPressed);
  const pressed = pressedProp ?? uncontrolled;
  const reduced = useReducedMotion();
  const iconRef = React.useRef<HTMLSpanElement>(null);
  const pressedHere = React.useRef(false);
  const topicId = React.useId();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);

  React.useEffect(() => {
    if (!pressed || !pressedHere.current) return;
    pressedHere.current = false;
    const el = iconRef.current;
    if (reduced || !el || typeof el.animate !== 'function') return;
    el.animate([{ transform: 'scale(0.5)' }, { transform: 'scale(1)' }], { duration: 200, easing: EASE });
  }, [pressed, reduced]);

  const toggle = () => {
    const next = !pressed;
    pressedHere.current = next;
    if (pressedProp === undefined) setUncontrolled(next);
    onPressedChange?.(next);
  };

  const others = typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const Icon = pressed ? Check : Plus;

  return (
    <div
      data-slot="interest-signal"
      data-state={pressed ? 'pressed' : 'idle'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}
      {...props}
    >
      <Button
        type="button"
        data-slot="interest-signal-button"
        variant={pressed ? 'default' : 'outline'}
        size={size === 'sm' ? 'sm' : 'default'}
        aria-pressed={pressed}
        aria-describedby={topic ? topicId : undefined}
        disabled={disabled}
        onClick={toggle}
        className="rounded-full"
      >
        <span ref={iconRef} data-slot="interest-signal-icon" aria-hidden="true" className="inline-flex">
          <Icon className="size-4" />
        </span>
        {labels?.action ?? 'I want more on this'}
      </Button>
      {topic ? (
        <span id={topicId} hidden>
          {topic}
        </span>
      ) : null}
      <p data-slot="interest-signal-status" aria-live="polite" className="text-muted-foreground text-sm empty:hidden">
        {pressed
          ? [labels?.noted ?? 'Noted.', others ? (labels?.others ?? OTHERS)(others, nf.format(others)) : '']
              .filter(Boolean)
              .join(' ')
          : ''}
      </p>
    </div>
  );
}
InterestSignal.displayName = 'InterestSignal';

interface InterestTopic {
  id: string;
  label: React.ReactNode;
}

interface InterestBoardLabels {
  /** The count beside a topic. @default (n, f) => `${f} asked` */
  count?: (count: number, formatted: string) => string;
  /** Marks the viewer's own asks. @default 'You asked' */
  mine?: string;
  /** Nobody asked yet. @default 'No one has asked for more yet.' */
  empty?: string;
  /** Topics held back by `minCount`. @default (n, min) => `${n} more topic(s) show once ${min} people ask.` */
  held?: (topics: number, minCount: number) => string;
  /** Topics left out by `top`. @default (n) => `And ${n} more.` */
  more?: (topics: number) => string;
}

type InterestBoardProps = Omit<React.ComponentProps<'section'>, 'children' | 'title'> & {
  topics: readonly InterestTopic[];
  /** Asks per topic id, from your store. */
  counts?: Readonly<Record<string, number>>;
  /** Topic ids the viewer asked about. */
  mine?: readonly string[];
  /** `counts` already include the viewer's asks. @default false */
  countsIncludeMine?: boolean;
  /** Hold back topics with fewer asks. @default 1 */
  minCount?: number;
  /** Show only the most-asked few. */
  top?: number;
  /** A heading, rendered as an h2 unless `titleAs` says otherwise. */
  title?: React.ReactNode;
  titleAs?: 'h2' | 'h3' | 'h4';
  /** Grow the bars when the board first shows. @default true */
  animate?: boolean;
  locale?: string;
  labels?: InterestBoardLabels;
};

const COUNT: NonNullable<InterestBoardLabels['count']> = (_n, f) => `${f} asked`;
const HELD: NonNullable<InterestBoardLabels['held']> = (n, min) =>
  `${n} more ${n === 1 ? 'topic shows' : 'topics show'} once ${min} people ask.`;
const MORE: NonNullable<InterestBoardLabels['more']> = (n) => `And ${n} more.`;

function InterestBoard({
  topics,
  counts,
  mine,
  countsIncludeMine,
  minCount = 1,
  top,
  title,
  titleAs: Heading = 'h2',
  animate = true,
  locale,
  labels,
  className,
  ...props
}: InterestBoardProps) {
  const reduced = useReducedMotion();
  const listRef = React.useRef<HTMLOListElement>(null);
  const headingId = React.useId();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const { rows, held, more } = rankInterest(
    topics.map((t) => t.id),
    counts,
    { mine, countsIncludeMine, minCount, top },
  );
  const labelOf = new Map(topics.map((t) => [t.id, t.label]));

  React.useEffect(() => {
    if (!animate || reduced) return;
    const bars = listRef.current?.querySelectorAll<HTMLElement>('[data-slot="interest-board-fill"]') ?? [];
    for (const el of bars) {
      if (typeof el.animate !== 'function') continue;
      el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 400, easing: EASE });
    }
    // Mount only: a count that moves later should not redraw the whole board.
    // eslint-disable-next-line react-features/hooks-exhaustive-deps
  }, []);

  const notes = [
    rows.length === 0 && held === 0 ? (labels?.empty ?? 'No one has asked for more yet.') : '',
    held ? (labels?.held ?? HELD)(held, Math.max(1, Math.floor(minCount))) : '',
    more ? (labels?.more ?? MORE)(more) : '',
  ].filter(Boolean);

  return (
    <section
      data-slot="interest-board"
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-labelledby={title ? headingId : undefined}
      className={cn('@container grid gap-4', className)}
      {...props}
    >
      {title ? (
        <Heading id={headingId} data-slot="interest-board-title" className="font-heading text-lg font-semibold text-balance">
          {title}
        </Heading>
      ) : null}
      {rows.length ? (
        <ol ref={listRef} data-slot="interest-board-list" className="grid gap-3">
          {rows.map((r) => (
            <li
              key={r.id}
              data-slot="interest-board-row"
              data-rank={r.rank}
              data-mine={r.mine ? '' : undefined}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1.5"
            >
              <span data-slot="interest-board-label" className="min-w-0 font-medium text-pretty">
                {labelOf.get(r.id)}
                {r.mine ? (
                  <span className="text-muted-foreground ms-2 text-xs font-normal">{labels?.mine ?? 'You asked'}</span>
                ) : null}
              </span>
              <span data-slot="interest-board-count" className="text-muted-foreground text-sm tabular-nums">
                {(labels?.count ?? COUNT)(r.count, nf.format(r.count))}
              </span>
              <span
                data-slot="interest-board-bar"
                aria-hidden="true"
                className="bg-muted col-span-2 block h-2 overflow-hidden rounded-full"
              >
                <span
                  data-slot="interest-board-fill"
                  className={cn(
                    'block h-full origin-left rounded-full rtl:origin-right',
                    r.rank === 1 ? 'bg-primary' : 'bg-foreground/60',
                  )}
                  style={{ inlineSize: `${Math.max(4, Math.round(r.share * 100))}%` }}
                />
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {notes.length ? (
        <p data-slot="interest-board-note" className="text-muted-foreground text-sm">
          {notes.join(' ')}
        </p>
      ) : null}
    </section>
  );
}
InterestBoard.displayName = 'InterestBoard';

export { InterestSignal, InterestBoard };
export type { InterestSignalProps, InterestSignalLabels, InterestBoardProps, InterestBoardLabels, InterestTopic };
