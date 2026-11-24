'use client';

/**
 * @interlace/ui — TallyBars
 *
 * How everyone answered, as one bar per option with its whole percent: the
 * results of a poll, or the spread of answers after a quiz question. The
 * viewer's own choice is named in words, and a quiz can mark the right
 * option, so nothing depends on colour alone.
 *
 * Feed it the rows from `tally()` in `games/tally-model` (percents that sum
 * to 100, the viewer's vote counted once), plus a label per option.
 *
 * ## Anatomy
 *
 *   TallyBars                     (div — data-slot="tally-bars")
 *     ├─ ol                       (data-slot="tally-bars-list")
 *     │   └─ li × n               (data-slot="tally-bars-row", data-mine, data-leading, data-mark)
 *     │       ├─ span             (data-slot="tally-bars-label": label + "Your answer" / mark words)
 *     │       ├─ span             (data-slot="tally-bars-percent")
 *     │       └─ span aria-hidden (data-slot="tally-bars-track" › data-slot="tally-bars-fill")
 *     └─ p                        (data-slot="tally-bars-total": "1,204 votes")
 *
 * ## Motion
 *
 * On mount each fill grows from the start of its track to its share (400ms,
 * `--ease-enter`), all at once, so the eye compares the ends rather than
 * following a sequence. The percents are in the HTML from the start. Under
 * reduced motion the bars are simply at their share. `animate={false}` draws
 * them in place, for a results view restored on reload.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                        |
 * | R6   | data-slot per part        | tally-bars / -list / -row / -label / -percent / -track / -fill / -total |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R19  | Tokens only               | primary, success, foreground, muted                  |
 * | R26  | A11y                      | a list read as text; bars hidden; marks in words     |
 */

import * as React from 'react';
import { Check, X } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import type { TallyRow } from './tally-model.js';

export const MIN_VIEWPORT = 320 as const;

/** A quiz's verdict on one option. */
export type TallyMark = 'correct' | 'wrong';

interface TallyBarsLabels {
  /** Beside the viewer's own option. @default 'Your answer' */
  mine?: string;
  /** Beside the right option. @default 'Right answer' */
  correct?: string;
  /** The total line. @default (n, formatted) => `${formatted} ${n === 1 ? 'vote' : 'votes'}` */
  total?: (count: number, formatted: string) => string;
}

type TallyBarsProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  rows: readonly TallyRow[];
  /** The text for each option id. */
  optionLabels: Readonly<Record<string, React.ReactNode>>;
  /** Marks per option id, for a quiz. Only `correct` is drawn and named; `wrong` just stays plain. */
  marks?: Readonly<Record<string, TallyMark>>;
  /** Grow the bars on mount. @default true */
  animate?: boolean;
  /** Show the total line. @default true */
  showTotal?: boolean;
  locale?: string;
  labels?: TallyBarsLabels;
};

const TOTAL: NonNullable<TallyBarsLabels['total']> = (n, f) => `${f} ${n === 1 ? 'vote' : 'votes'}`;

function TallyBars({
  rows,
  optionLabels,
  marks,
  animate = true,
  showTotal = true,
  locale,
  labels,
  className,
  ...props
}: TallyBarsProps) {
  const reduced = useReducedMotion();
  const listRef = React.useRef<HTMLOListElement>(null);
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = React.useMemo(() => new Intl.NumberFormat(locale, { style: 'percent' }), [locale]);
  const total = rows.reduce((a, r) => a + r.count, 0);

  // Grow every fill once, on mount, together.
  React.useEffect(() => {
    if (!animate || reduced) return;
    const fills = listRef.current?.querySelectorAll<HTMLElement>('[data-slot="tally-bars-fill"]');
    fills?.forEach((fill) => {
      if (typeof fill.animate !== 'function') return;
      fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
        duration: 400,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });
    });
    // Mount only: later count changes move the bars without a replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      data-slot="tally-bars"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', className)}
      {...props}
    >
      <ol ref={listRef} data-slot="tally-bars-list" className="grid gap-3">
        {rows.map((row) => {
          const mark = marks?.[row.id];
          return (
            <li
              key={row.id}
              data-slot="tally-bars-row"
              data-mine={row.mine ? '' : undefined}
              data-leading={row.leading ? '' : undefined}
              data-mark={mark}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1.5"
            >
              <span data-slot="tally-bars-label" className={cn('min-w-0 text-sm', row.mine && 'font-semibold')}>
                {optionLabels[row.id] ?? row.id}
                {mark === 'correct' ? (
                  <span className="text-success ms-2 inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap">
                    <Check aria-hidden className="size-3.5" strokeWidth={3} />
                    {labels?.correct ?? 'Right answer'}
                  </span>
                ) : null}
                {row.mine ? (
                  <span className="text-muted-foreground ms-2 inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap">
                    {mark === 'wrong' ? <X aria-hidden className="size-3.5" strokeWidth={3} /> : null}
                    {labels?.mine ?? 'Your answer'}
                  </span>
                ) : null}
              </span>
              <span data-slot="tally-bars-percent" className="text-sm font-semibold tabular-nums">
                {pf.format(row.percent / 100)}
              </span>
              <span
                aria-hidden
                data-slot="tally-bars-track"
                className="bg-muted col-span-2 block h-2 overflow-hidden rounded-full"
              >
                <span
                  data-slot="tally-bars-fill"
                  className={cn(
                    'block h-full origin-left rounded-full rtl:origin-right',
                    mark === 'correct' ? 'bg-success' : row.mine ? 'bg-primary' : 'bg-foreground/35',
                  )}
                  style={{ width: `${row.percent}%` }}
                />
              </span>
            </li>
          );
        })}
      </ol>
      {showTotal ? (
        <p data-slot="tally-bars-total" className="text-muted-foreground text-xs tabular-nums">
          {(labels?.total ?? TOTAL)(total, nf.format(total))}
        </p>
      ) : null}
    </div>
  );
}
TallyBars.displayName = 'TallyBars';

export { TallyBars };
export type { TallyBarsProps, TallyBarsLabels };
