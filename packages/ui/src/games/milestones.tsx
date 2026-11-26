/**
 * @interlace/ui — Milestones
 *
 * The marks along a path a player is on (a 3, 7 and 30-day streak; levels
 * 5, 10 and 20): the ones reached, the next one with how far is left, and
 * a few beyond. It shows where the player is going, not a wall of locked
 * trophies, so only a window around the next mark is drawn.
 *
 * ## Anatomy
 *
 *   Milestones                     (div — data-slot="milestones")
 *     ├─ ol                        (data-slot="milestones-list", labelled)
 *     │   └─ li × n                (data-slot="milestone", data-state=reached|next|ahead)
 *     │       ├─ span aria-hidden  (data-slot="milestone-mark": the step, an award when reached)
 *     │       └─ span              (data-slot="milestone-label")
 *     └─ p                         (data-slot="milestones-next": "3 more days to 7 days")
 *
 * ## Never colour alone
 *
 * Reached is a filled mark with an award icon, next a ring in the accent
 * with a dot, ahead a dashed ring. Each item also says its state in words
 * for assistive tech.
 *
 * ## Motion
 *
 * The latest reached mark scales in once (CSS `@starting-style`,
 * `motion-safe:` only). Renders on the server.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Five marks fit a 288px column; the row wraps beyond that.
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                        |
 * | R6   | data-slot per part        | milestones / -list / milestone / -mark / -label / -next |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R19  | Tokens only               | primary, input, muted-foreground                     |
 * | R26  | A11y                      | labelled list; every state in words                  |
 */

import * as React from 'react';
import { Award } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { nextMilestone } from './progress-model.js';

export const MIN_VIEWPORT = 320 as const;

export type MilestoneState = 'reached' | 'next' | 'ahead';

interface MilestonesLabels {
  /** Names the list. @default 'Milestones' */
  list?: string;
  /** One step, as words: "7 days". @default n => n */
  step?: (step: number, formatted: string) => string;
  /** The line under the list. @default (left, step) => `${left} more to ${step}` */
  next?: (left: string, step: string) => string;
  /** When every step is reached. @default 'Every milestone reached.' */
  done?: string;
  /** Each state, read after the step. */
  state?: Partial<Record<MilestoneState, string>>;
}

type MilestonesProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** Where the player is: a streak length, a level. */
  value: number;
  /** The steps, any order. */
  steps: readonly number[];
  /** How many reached steps to keep in view. @default 2 */
  behind?: number;
  /** How many steps to show in all. @default 5 */
  show?: number;
  /** BCP 47 locale for the numbers. */
  locale?: string;
  labels?: MilestonesLabels;
};

const STATE: Record<MilestoneState, string> = { reached: 'reached', next: 'next', ahead: 'ahead' };

const MARK =
  'grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums [&_svg]:size-4';

/** The window of steps to draw: a few reached, the next, and some ahead. */
export function milestoneWindow(value: number, steps: readonly number[], behind = 2, show = 5): number[] {
  const sorted = [...new Set(steps)].sort((a, b) => a - b);
  const firstAhead = sorted.findIndex((s) => s > value);
  const pivot = firstAhead === -1 ? sorted.length : firstAhead;
  const count = Math.max(1, show);
  let start = Math.max(0, pivot - Math.max(0, behind));
  start = Math.max(0, Math.min(start, sorted.length - count));
  return sorted.slice(start, start + count);
}

function Milestones({
  value,
  steps,
  behind = 2,
  show = 5,
  locale,
  labels,
  className,
  ...props
}: MilestonesProps) {
  const nf = new Intl.NumberFormat(locale);
  const shown = milestoneWindow(value, steps, behind, show);
  const next = nextMilestone(value, steps);
  const lastReached = [...shown].reverse().find((s) => s <= value);
  const word = (s: number) => (labels?.step ?? ((_n: number, f: string) => f))(s, nf.format(s));

  return (
    <div
      data-slot="milestones"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', className)}
      {...props}
    >
      <ol
        data-slot="milestones-list"
        aria-label={labels?.list ?? 'Milestones'}
        className="flex flex-wrap gap-x-3 gap-y-2"
      >
        {shown.map((s) => {
          const state: MilestoneState = s <= value ? 'reached' : s === next ? 'next' : 'ahead';
          return (
            <li
              key={s}
              data-slot="milestone"
              data-state={state}
              aria-current={state === 'next' ? 'step' : undefined}
              className="grid w-14 justify-items-center gap-1 text-center"
            >
              <span
                aria-hidden
                data-slot="milestone-mark"
                className={cn(
                  MARK,
                  state === 'reached' && 'bg-primary text-primary-foreground',
                  state === 'next' && 'border-primary text-foreground border-2',
                  state === 'ahead' && 'border-input text-muted-foreground border-2 border-dashed',
                  s === lastReached &&
                    'motion-safe:transition-[scale,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-enter motion-safe:starting:scale-75 motion-safe:starting:opacity-0',
                )}
              >
                {state === 'reached' ? <Award /> : nf.format(s)}
              </span>
              <span
                data-slot="milestone-label"
                className={cn('text-xs leading-tight', state === 'ahead' ? 'text-muted-foreground' : 'font-medium')}
              >
                {word(s)}
                <span className="sr-only">: {labels?.state?.[state] ?? STATE[state]}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p data-slot="milestones-next" dir="auto" className="text-muted-foreground text-sm tabular-nums">
        {next === undefined
          ? (labels?.done ?? 'Every milestone reached.')
          : (labels?.next ?? ((l: string, s: string) => `${l} more to ${s}`))(nf.format(next - value), word(next))}
      </p>
    </div>
  );
}
Milestones.displayName = 'Milestones';

export { Milestones };
export type { MilestonesProps, MilestonesLabels };
