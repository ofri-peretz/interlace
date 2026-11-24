/**
 * @interlace/ui — Streak
 *
 * A player's run of days: the count, a line on where today stands, and a
 * strip of recent days, each marked played, rested, missed or still open.
 * Rest days come from a `RestRule` (weekdays and dates that never break a
 * run), so a habit does not punish a day off. The arithmetic lives in
 * `streak-model.ts` and is exported, so a server can store and check the
 * same numbers this shows.
 *
 * ## Anatomy
 *
 *   Streak                         (div — data-slot="streak", data-status=played|pending|resting|none)
 *     ├─ p                         (data-slot="streak-count": the number and its unit)
 *     ├─ p                         (data-slot="streak-status": where today stands)
 *     ├─ ol                        (data-slot="streak-days", labelled)
 *     │   └─ li × length           (data-slot="streak-day", data-state=played|rest|missed|open|future)
 *     └─ p                         (data-slot="streak-best")
 *
 *   variant="compact" renders one inline chip (data-slot="streak") with the
 *   count and a full sentence for assistive tech, for a header or a toolbar.
 *
 * ## Never colour alone
 *
 * A played day is a filled mark with a check, a rest day a dashed ring with
 * a moon, a missed day an empty ring, today an open ring with a dot. Each
 * day also carries its full date and state as text for screen readers.
 *
 * ## Motion
 *
 * Today's check scales in once when it first appears (CSS `@starting-style`,
 * 250ms, `motion-safe:` only). Nothing else moves.
 *
 * ## Server first
 *
 * No hooks, no state: it renders on the server. Pass `today` (a day key in
 * the player's time zone) when the server's clock is not the player's; the
 * fallback reads the clock in `timeZone`.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Seven 28px marks with their gaps fit a 288px column; they grow to 32px
 * from `xs`.
 *
 * | Rule | Concept                   | Where in this file                                    |
 * | ---- | ------------------------- | ----------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                         |
 * | R6   | data-slot per part        | streak / -count / -status / -days / -day / -best      |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                     |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                  |
 * | R19  | Tokens only               | primary, muted-foreground, input, ring                |
 * | R26  | A11y                      | labelled list; every day as text; status as a sentence |
 */

import * as React from 'react';
import { Check, Flame, Moon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { dayKey, dayKeyToDate, type DayKey } from './daily.js';
import {
  streakDays,
  summarizeStreak,
  type RestRule,
  type StreakDayState,
  type StreakStatus,
} from './streak-model.js';

export const MIN_VIEWPORT = 320 as const;

interface StreakLabels {
  /** After the number. @default 'day streak' */
  unit?: string;
  /** One sentence per status. */
  status?: Partial<Record<StreakStatus, string>>;
  /** The best run. @default n => `Best: ${n} days` */
  best?: (best: number) => string;
  /** Names the strip for assistive tech. @default 'Recent days' */
  days?: string;
  /** Each day's state, read after its date. */
  state?: Partial<Record<StreakDayState, string>>;
}

type StreakProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** Every day the player played, as day keys. Order and duplicates do not matter. */
  played: readonly DayKey[];
  /** Today, in the player's time zone. @default dayKey(new Date(), timeZone) */
  today?: DayKey;
  /** IANA time zone for the fallback `today`. */
  timeZone?: string;
  /** Days that never break a run. */
  rest?: RestRule;
  /** Days in the strip, ending today. @default 7 */
  length?: number;
  /** Days after today to show as still to come. @default 0 */
  after?: number;
  /** `full` shows the strip; `compact` is one inline chip. @default 'full' */
  variant?: 'full' | 'compact';
  /** Show the best run under the strip. @default true */
  showBest?: boolean;
  /** BCP 47 locale for numbers and day names. @default the runtime's */
  locale?: string;
  labels?: StreakLabels;
};

const STATUS: Record<StreakStatus, string> = {
  played: 'Played today. See you tomorrow.',
  pending: 'Play today to keep your streak.',
  resting: 'Rest day. Your streak is safe.',
  none: 'Play today to start a streak.',
};

const STATE: Record<StreakDayState, string> = {
  played: 'played',
  rest: 'rest day',
  missed: 'missed',
  open: 'not played yet',
  future: 'still to come',
};

const MARK =
  'relative grid size-7 xs:size-8 shrink-0 place-items-center rounded-full [&_svg]:size-3.5 xs:[&_svg]:size-4';

function DayMark({ state, today }: { state: StreakDayState; today: boolean }) {
  switch (state) {
    case 'played':
      return (
        <span className={cn(MARK, 'bg-primary text-primary-foreground')}>
          <Check
            aria-hidden
            strokeWidth={3}
            className={cn(
              today &&
                'motion-safe:transition-[scale,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-enter motion-safe:starting:scale-50 motion-safe:starting:opacity-0',
            )}
          />
        </span>
      );
    case 'rest':
      return (
        <span className={cn(MARK, 'border-muted-foreground text-muted-foreground border-2 border-dashed')}>
          <Moon aria-hidden />
        </span>
      );
    case 'open':
      return (
        <span className={cn(MARK, 'border-primary border-2')}>
          <span aria-hidden className="bg-primary size-1.5 rounded-full" />
        </span>
      );
    case 'future':
      return <span className={cn(MARK, 'border-input border border-dashed')} />;
    case 'missed':
    default:
      return <span className={cn(MARK, 'border-input border-2')} />;
  }
}

function Streak({
  played,
  today: todayProp,
  timeZone,
  rest,
  length = 7,
  after = 0,
  variant = 'full',
  showBest = true,
  locale,
  labels,
  className,
  ...props
}: StreakProps) {
  const today = todayProp ?? dayKey(new Date(), timeZone);
  const summary = summarizeStreak(played, today, rest);
  const unit = labels?.unit ?? 'day streak';
  const status = labels?.status?.[summary.status] ?? STATUS[summary.status];
  const count = new Intl.NumberFormat(locale).format(summary.current);

  if (variant === 'compact') {
    return (
      <div
        data-slot="streak"
        data-variant="compact"
        data-status={summary.status}
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(
          'border-border bg-card text-card-foreground inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold tabular-nums',
          className,
        )}
        {...props}
      >
        <Flame
          aria-hidden
          className={cn('size-4', summary.status === 'played' ? 'text-primary' : 'text-muted-foreground')}
        />
        <span aria-hidden>{count}</span>
        <span className="sr-only">
          {count} {unit}. {status}
        </span>
      </div>
    );
  }

  const days = streakDays(played, today, { length, after, rest });
  const short = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  const long = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const best = labels?.best ?? ((n: number) => `Best: ${new Intl.NumberFormat(locale).format(n)} ${n === 1 ? 'day' : 'days'}`);

  return (
    <div
      data-slot="streak"
      data-variant="full"
      data-status={summary.status}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', className)}
      {...props}
    >
      <p data-slot="streak-count" className="flex items-baseline gap-2">
        <span className="font-heading text-section leading-none font-semibold tabular-nums">{count}</span>
        <span className="text-muted-foreground text-sm font-medium">{unit}</span>
      </p>
      <p data-slot="streak-status" className="text-sm">
        {status}
      </p>
      <ol
        data-slot="streak-days"
        aria-label={labels?.days ?? 'Recent days'}
        className="xs:gap-2 flex flex-wrap gap-1.5"
      >
        {days.map((d) => (
          <li
            key={d.day}
            data-slot="streak-day"
            data-state={d.state}
            data-today={d.today ? '' : undefined}
            aria-current={d.today ? 'date' : undefined}
            className="grid justify-items-center gap-1"
          >
            <span
              aria-hidden
              className={cn(
                'text-xs leading-none',
                d.today ? 'text-foreground font-semibold' : 'text-muted-foreground',
              )}
            >
              {short.format(dayKeyToDate(d.day))}
            </span>
            <DayMark state={d.state} today={d.today} />
            <span className="sr-only">
              {long.format(dayKeyToDate(d.day))}: {labels?.state?.[d.state] ?? STATE[d.state]}
            </span>
          </li>
        ))}
      </ol>
      {showBest && summary.best > 0 ? (
        <p data-slot="streak-best" className="text-muted-foreground text-sm">
          {best(summary.best)}
        </p>
      ) : null}
    </div>
  );
}
Streak.displayName = 'Streak';

export { Streak };
export type { StreakProps, StreakLabels };
