'use client';

/**
 * @interlace/ui — DailyPuzzle
 *
 * The frame around a daily game: its name, today's number and date, how far
 * through the rounds the player is, and, once they finish, a countdown to the
 * next one. The game itself is the children, so any round (a CloserGame, a
 * GuessReveal, your own) sits inside the same shell.
 *
 * ## Anatomy
 *
 *   DailyPuzzle                    (section — data-slot="daily-puzzle", data-state=playing|done, data-size, labelled by the title)
 *     ├─ header                    (data-slot="daily-puzzle-header")
 *     │   ├─ h2                    (data-slot="daily-puzzle-title")
 *     │   ├─ p                     (data-slot="daily-puzzle-meta": "No. 42 · Tuesday, November 24")
 *     │   └─ div                   (data-slot="daily-puzzle-aside": a compact Streak, a menu)
 *     ├─ div                       (data-slot="daily-puzzle-progress": "Round 2 of 3" + marks)
 *     └─ div                       (data-slot="daily-puzzle-body", keyed by round so each one arrives)
 *
 *   DailyPuzzleCountdown           (p — data-slot="daily-puzzle-countdown": "Next puzzle in 5 h 12 min")
 *
 * ## Rounds
 *
 * `rounds` is how many there are and `round` the one in play (1-based).
 * The progress line is a polite live region, so moving on is announced.
 * When `done`, every mark fills and the line says so. Each new round's body
 * rises in once (150ms, `motion-safe:` only). The first round does not: it is
 * what the page opens on, often its largest paint, so it is there at first
 * paint and only the rounds after it arrive.
 *
 * ## The countdown
 *
 * The server cannot know the player's clock, so the server HTML says "Next
 * puzzle at midnight" (`labels.nextAtMidnight`) and the browser replaces it
 * with the time left, read in `timeZone`, ticking each minute (each second
 * in the last minute). At zero it calls `onNextDay`, so the page can load
 * the new puzzle.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                     |
 * | ---- | ------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentProps<'section'>`                      |
 * | R6   | data-slot per part        | daily-puzzle / -header / -title / -meta / -aside / -progress / -body / -countdown |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                      |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                   |
 * | R19  | Tokens only               | primary, input, muted-foreground, border               |
 * | R26  | A11y                      | labelled section; progress in words, announced; real `<time>` |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { dayKey, dayKeyToDate, msUntilNextDay, type DayKey } from './daily.js';

export const MIN_VIEWPORT = 320 as const;

interface DailyPuzzleLabels {
  /** @default n => `No. ${n}` */
  number?: (n: string) => string;
  /** @default (round, rounds) => `Round ${round} of ${rounds}` */
  progress?: (round: number, rounds: number) => string;
  /** @default 'All done for today' */
  done?: string;
}

type DailyPuzzleProps = Omit<React.ComponentProps<'section'>, 'title'> & {
  /** The game's name. Rendered as an h2; `headingLevel` changes the element only. */
  title: React.ReactNode;
  /** @default 2 */
  headingLevel?: 1 | 2 | 3;
  /**
   * `default` sets the title at `text-h3`, for a puzzle inside a page. `page` sets it as
   * Typography's `h1` does (`text-h1`), for a page whose content is the puzzle.
   * Visual only: pair it with `headingLevel={1}`.
   * @default 'default'
   */
  size?: 'default' | 'page';
  /** Today's puzzle number (see `puzzleNumber`). */
  number?: number;
  /** Today's day key, shown as a date. */
  day?: DayKey;
  /** Rounds in today's puzzle. Leave out for a one-round game. */
  rounds?: number;
  /** The round in play, 1-based. @default 1 */
  round?: number;
  /** The player has finished today's puzzle. */
  done?: boolean;
  /** Beside the title: a compact Streak, a help button. */
  aside?: React.ReactNode;
  locale?: string;
  labels?: DailyPuzzleLabels;
};

function DailyPuzzle({
  title,
  headingLevel = 2,
  size = 'default',
  number,
  day,
  rounds,
  round = 1,
  done = false,
  aside,
  locale,
  labels,
  className,
  children,
  ...props
}: DailyPuzzleProps) {
  const titleId = React.useId();
  // The entry transition is for one round giving way to the next. On first paint the
  // body is the page's content (often its LCP), so it must not start from opacity 0.
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => setEntered(true), []);
  const Heading = `h${headingLevel}` as const;
  const meta: string[] = [];
  if (number !== undefined) {
    const n = new Intl.NumberFormat(locale).format(number);
    meta.push(labels?.number ? labels.number(n) : `No. ${n}`);
  }
  if (day) {
    meta.push(
      new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(
        dayKeyToDate(day),
      ),
    );
  }
  const current = Math.min(Math.max(round, 1), rounds ?? 1);
  const progress = done
    ? (labels?.done ?? 'All done for today')
    : (labels?.progress ?? ((r: number, of: number) => `Round ${r} of ${of}`))(current, rounds ?? 1);

  return (
    <section
      data-slot="daily-puzzle"
      data-state={done ? 'done' : 'playing'}
      data-size={size}
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-labelledby={titleId}
      className={cn('grid gap-5', className)}
      {...props}
    >
      <header data-slot="daily-puzzle-header" className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="grid min-w-0 gap-1">
          <Heading
            id={titleId}
            data-slot="daily-puzzle-title"
            className={cn(
              'font-heading text-balance',
              size === 'page' ? 'text-h1 tracking-display font-bold' : 'text-h3 font-semibold',
            )}
          >
            {title}
          </Heading>
          {meta.length ? (
            <p data-slot="daily-puzzle-meta" className="text-muted-foreground text-sm">
              {number !== undefined && day ? (
                <>
                  {meta[0]} <span aria-hidden>·</span> <time dateTime={day}>{meta[1]}</time>
                </>
              ) : day ? (
                <time dateTime={day}>{meta[0]}</time>
              ) : (
                meta[0]
              )}
            </p>
          ) : null}
        </div>
        {aside ? (
          <div data-slot="daily-puzzle-aside" className="flex shrink-0 items-center gap-2">
            {aside}
          </div>
        ) : null}
      </header>

      {rounds && rounds > 1 ? (
        <div data-slot="daily-puzzle-progress" className="flex flex-wrap items-center gap-3">
          <ol aria-hidden className="flex gap-1.5">
            {Array.from({ length: rounds }, (_, i) => {
              const state = done || i + 1 < current ? 'done' : i + 1 === current ? 'current' : 'next';
              return (
                <li
                  key={i}
                  data-state={state}
                  className={cn(
                    'h-1.5 w-6 rounded-full',
                    'motion-safe:transition-colors motion-safe:duration-(--duration-medium) motion-safe:ease-enter',
                    state === 'done' && 'bg-primary',
                    state === 'current' && 'bg-primary/40 ring-primary ring-1',
                    state === 'next' && 'bg-input',
                  )}
                />
              );
            })}
          </ol>
          <p aria-live="polite" className="text-muted-foreground text-sm font-medium">
            {progress}
          </p>
        </div>
      ) : done ? (
        <p data-slot="daily-puzzle-progress" aria-live="polite" className="text-muted-foreground text-sm font-medium">
          {progress}
        </p>
      ) : null}

      <div
        key={done ? 'done' : current}
        data-slot="daily-puzzle-body"
        className={cn(
          'motion-safe:transition-[translate,opacity] motion-safe:duration-(--duration-base) motion-safe:ease-enter',
          entered && 'motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0',
        )}
      >
        {children}
      </div>
    </section>
  );
}
DailyPuzzle.displayName = 'DailyPuzzle';

interface DailyPuzzleCountdownProps extends Omit<React.ComponentProps<'p'>, 'children'> {
  /** IANA zone the next day starts in. @default the runtime's */
  timeZone?: string;
  /** Called once when the next day starts. */
  onNextDay?: () => void;
  locale?: string;
  labels?: {
    /** Server HTML, before the clock is known. @default 'Next puzzle at midnight' */
    nextAtMidnight?: string;
    /** @default time => `Next puzzle in ${time}` */
    nextIn?: (time: string) => string;
    /** @default 'A new puzzle is ready' */
    ready?: string;
  };
}

/** Time left in the locale's own short unit words, such as "5 hr 12 min", "12 min" or "45 sec" in en-US. */
function formatLeft(ms: number, locale?: string) {
  const unit = (u: 'hour' | 'minute' | 'second', n: number) =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: u, unitDisplay: 'short' }).format(n);
  if (ms < 60_000) return unit('second', Math.max(0, Math.ceil(ms / 1000)));
  const minutes = Math.ceil(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${unit('hour', h)} ${unit('minute', m)}` : unit('hour', h)) : unit('minute', m);
}

function DailyPuzzleCountdown({ timeZone, onNextDay, locale, labels, className, ...props }: DailyPuzzleCountdownProps) {
  const [left, setLeft] = React.useState<number | null>(null);
  const onNextDayRef = React.useRef(onNextDay);
  onNextDayRef.current = onNextDay;

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const startDay = dayKey(Date.now(), timeZone);
    const tick = () => {
      const now = Date.now();
      if (dayKey(now, timeZone) !== startDay) {
        setLeft(0);
        onNextDayRef.current?.();
        return;
      }
      const ms = msUntilNextDay(now, timeZone);
      setLeft(ms);
      // Tick as each minute turns; every second in the last minute.
      timer = setTimeout(tick, (ms <= 60_000 ? ms % 1000 : ms % 60_000) + 20);
    };
    tick();
    return () => clearTimeout(timer);
  }, [timeZone]);

  const text =
    left === null
      ? (labels?.nextAtMidnight ?? 'Next puzzle at midnight')
      : left === 0
        ? (labels?.ready ?? 'A new puzzle is ready')
        : (labels?.nextIn ?? ((t: string) => `Next puzzle in ${t}`))(formatLeft(left, locale));

  return (
    <p
      data-slot="daily-puzzle-countdown"
      data-state={left === 0 ? 'ready' : 'waiting'}
      className={cn('text-muted-foreground text-sm tabular-nums', className)}
      {...props}
    >
      {/* The ticks stay quiet; only the day turning is announced. A live region
          must exist before its text changes, so it is always rendered. */}
      <span aria-hidden={left === 0 || undefined}>{text}</span>
      <span data-slot="daily-puzzle-countdown-status" aria-live="polite" className="sr-only">
        {left === 0 ? text : ''}
      </span>
    </p>
  );
}
DailyPuzzleCountdown.displayName = 'DailyPuzzleCountdown';

export { DailyPuzzle, DailyPuzzleCountdown, formatLeft };
export type { DailyPuzzleProps, DailyPuzzleLabels, DailyPuzzleCountdownProps };
