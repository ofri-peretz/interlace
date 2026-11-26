'use client';

/**
 * @interlace/ui — RankChoices and RankResults
 *
 * A room ranks the same items by preference. `RankChoices` is a phone: the
 * items in a seeded starting order (so nobody's first item is favoured by
 * where it was printed), moved with up and down buttons or the arrow keys
 * on each row's handle, then sent. `RankResults` is the screen: the room's
 * order with each item's average place and first-place count, gliding as
 * answers arrive. For a round with a right order, use `OrderGame`.
 *
 * ## Anatomy
 *
 *   RankChoices                    (div — data-slot="rank-choices", data-state=ranking|sent)
 *     ├─ p                         (data-slot="rank-choices-question", labels the list)
 *     ├─ ol (FlipGroup)            (data-slot="rank-choices-list")
 *     │   └─ li × n                (place, handle button (arrow keys), label, up / down)
 *     ├─ Button                    (data-slot="rank-choices-send")
 *     └─ span sr-only aria-live    (data-slot="rank-choices-announce": "Music, now 2 of 4")
 *   RankResults                    (FlipGroup ol — data-slot="rank-results")
 *     └─ li × n                    (place, label, bar, average place; read as one line)
 *
 * ## Motion
 *
 * A moved row and its neighbour glide (FlipGroup, 250ms); room rows glide
 * to their new places as answers arrive. Under reduced motion they jump.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                          |
 * | R6   | data-slot per part        | rank-choices / -question / -list / -send / -announce; rank-results |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R9   | Controlled + uncontrolled | `order` / `defaultOrder` / `onOrderChange` / `onSend` |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | moves by button or key, each announced; results read as one line per row |
 */

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { FlipGroup } from '../effects/flip-group.js';
import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { seededShuffle } from './daily.js';
import { moveItem } from './order-model.js';
import type { RankedItem } from './ranking-model.js';

export const MIN_VIEWPORT = 320 as const;

interface RankOption {
  id: string;
  label: string;
}

interface RankChoicesLabels {
  /** @default (label) => `Move ${label} up` */
  up?: (label: string) => string;
  /** @default (label) => `Move ${label} down` */
  down?: (label: string) => string;
  /** The handle's name. @default (label, place, total) => `${label}, ${place} of ${total}. Use the arrow keys to move it.` */
  handle?: (label: string, place: number, total: number) => string;
  /** Announced after a move. @default (label, place, total) => `${label}, now ${place} of ${total}` */
  moved?: (label: string, place: number, total: number) => string;
  /** @default 'Send my order' */
  send?: string;
  /** @default 'Sent. Thank you.' */
  sent?: string;
}

type RankChoicesProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  question: React.ReactNode;
  options: readonly RankOption[];
  /** Seeds the starting order. @default the ids joined */
  seed?: number | string;
  order?: readonly string[];
  defaultOrder?: readonly string[];
  onOrderChange?: (order: string[]) => void;
  /** Called once, with the order. */
  onSend?: (order: string[]) => void;
  /** Shown as sent, from the parent. */
  sent?: boolean;
  labels?: RankChoicesLabels;
};

function RankChoices({
  question,
  options,
  seed,
  order: orderProp,
  defaultOrder,
  onOrderChange,
  onSend,
  sent: sentProp,
  labels,
  className,
  ...props
}: RankChoicesProps) {
  const ids = options.map((o) => o.id);
  const [own, setOwn] = React.useState<readonly string[]>(
    () => defaultOrder ?? seededShuffle(ids, seed ?? ids.join('|')),
  );
  const order = orderProp ?? own;
  const [sentHere, setSentHere] = React.useState(false);
  const sent = sentProp ?? sentHere;
  const [announce, setAnnounce] = React.useState('');
  const questionId = React.useId();
  const names = new Map(options.map((o) => [o.id, o.label]));
  const rootRef = React.useRef<HTMLDivElement>(null);
  const total = order.length;

  const move = (from: number, to: number, focusHandle: boolean) => {
    if (sent || to < 0 || to >= total || from === to) return;
    const next = moveItem(order, from, to);
    const id = order[from] as string;
    if (orderProp === undefined) setOwn(next);
    onOrderChange?.(next);
    setAnnounce(
      (labels?.moved ?? ((l: string, p: number, t: number) => `${l}, now ${p} of ${t}`))(
        names.get(id) ?? id,
        to + 1,
        total,
      ),
    );
    if (focusHandle) {
      // Keep focus on the moved row's handle after the DOM reorders.
      queueMicrotask(() =>
        [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-handle]') ?? [])]
          .find((el) => el.dataset.handle === id)
          ?.focus(),
      );
    }
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const to =
      e.key === 'ArrowUp'
        ? i - 1
        : e.key === 'ArrowDown'
          ? i + 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? total - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    move(i, to, true);
  };

  return (
    <div
      ref={rootRef}
      data-slot="rank-choices"
      data-state={sent ? 'sent' : 'ranking'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      <p id={questionId} data-slot="rank-choices-question" className="font-heading text-lg font-semibold text-balance">
        {question}
      </p>
      <FlipGroup
        render={<ol />}
        duration={250}
        aria-labelledby={questionId}
        data-slot="rank-choices-list"
        className="grid gap-2"
      >
        {order.map((id, i) => {
          const label = names.get(id) ?? id;
          return (
            <li key={id} data-flip-id={id} className="bg-card flex items-center gap-2 rounded-lg border p-2 ps-3">
              <span aria-hidden className="text-muted-foreground w-5 text-sm font-semibold tabular-nums">
                {i + 1}
              </span>
              <button
                type="button"
                data-handle={id}
                disabled={sent}
                aria-label={(
                  labels?.handle ??
                  ((l: string, p: number, t: number) => `${l}, ${p} of ${t}. Use the arrow keys to move it.`)
                )(label, i + 1, total)}
                onKeyDown={(e) => onKey(e, i)}
                className="text-muted-foreground focus-visible:outline-ring grid size-8 place-items-center rounded-md outline-offset-2 focus-visible:outline-2 disabled:opacity-50"
              >
                <ChevronsUpDown aria-hidden className="size-4" />
              </button>
              <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={(labels?.up ?? ((l: string) => `Move ${l} up`))(label)}
                disabled={sent || i === 0}
                onClick={() => move(i, i - 1, false)}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={(labels?.down ?? ((l: string) => `Move ${l} down`))(label)}
                disabled={sent || i === total - 1}
                onClick={() => move(i, i + 1, false)}
              >
                <ArrowDown aria-hidden />
              </Button>
            </li>
          );
        })}
      </FlipGroup>
      {sent ? (
        <p className="text-muted-foreground text-sm">{labels?.sent ?? 'Sent. Thank you.'}</p>
      ) : (
        <Button
          data-slot="rank-choices-send"
          size="lg"
          className="justify-self-start"
          onClick={() => {
            setSentHere(true);
            onSend?.([...order]);
          }}
        >
          {labels?.send ?? 'Send my order'}
        </Button>
      )}
      <span data-slot="rank-choices-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
RankChoices.displayName = 'RankChoices';

// --- RankResults (screen) --------------------------------------------------------

interface RankResultsLabels {
  /** One row, read whole; `mean` is null while nobody has ranked. @default English: 'Music: place 1, average place 1.8, first for 4 people' */
  row?: (r: { place: number; label: string; mean: string | null; firsts: string }) => string;
  /** The visible average. @default (mean) => `avg ${mean}` */
  mean?: (mean: string) => string;
}

type RankResultsProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** From `tallyRankings`. */
  items: readonly RankedItem[];
  options: readonly RankOption[];
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
  locale?: string;
  labels?: RankResultsLabels;
};

function RankResults({ items, options, size = 'default', locale, labels, className, ...props }: RankResultsProps) {
  const one = React.useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const names = new Map(options.map((o) => [o.id, o.label]));
  const top = Math.max(...items.map((r) => r.points), 1);
  const stage = size === 'stage';
  return (
    <FlipGroup
      render={<ol />}
      data-slot="rank-results"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', className)}
      {...props}
    >
      {items.map((r, i) => {
        const label = names.get(r.id) ?? r.id;
        const mean = r.meanPlace === null ? null : one.format(r.meanPlace);
        const firsts = nf.format(r.firsts);
        return (
          <li key={r.id} data-flip-id={r.id} className="grid gap-1">
            <span className="sr-only">
              {(
                labels?.row ??
                ((x) =>
                  `${x.label}: place ${x.place}${x.mean === null ? '' : `, average place ${x.mean}`}, first for ${x.firsts} ${x.firsts === '1' ? 'person' : 'people'}`)
              )({ place: i + 1, label, mean, firsts })}
            </span>
            <div aria-hidden className={cn('flex items-baseline gap-3', stage ? 'text-lg' : 'text-sm')}>
              <span className="text-muted-foreground w-5 font-semibold tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 font-medium">{label}</span>
              {mean === null ? null : (
                <span className="text-muted-foreground tabular-nums">
                  {(labels?.mean ?? ((m: string) => `avg ${m}`))(mean)}
                </span>
              )}
            </div>
            <span aria-hidden className={cn('bg-muted ms-8 block overflow-hidden rounded-full', stage ? 'h-3' : 'h-2')}>
              <span
                className="bg-primary block h-full origin-left rounded-full motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:ease-move rtl:origin-right"
                style={{ transform: `scaleX(${r.points / top})` }}
              />
            </span>
          </li>
        );
      })}
    </FlipGroup>
  );
}
RankResults.displayName = 'RankResults';

export { RankChoices, RankResults };
export type { RankChoicesProps, RankChoicesLabels, RankResultsProps, RankResultsLabels, RankOption };
