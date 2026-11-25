'use client';

/**
 * @interlace/ui — Standings
 *
 * The board between rounds of a live game: who is where now, and how they
 * got there. Each player's points from this round pop up beside their name,
 * their total counts up from where it was, and then the rows glide to their
 * new places, with the places gained said in words. It is the moment a room
 * looks up at the big screen, so the change is the content: a board that
 * jumped would hide who overtook whom.
 *
 * ## Anatomy
 *
 *   Standings                       (section — data-slot="standings", data-phase=before|after)
 *     ├─ h2/p?                      (data-slot="standings-caption", when `showCaption`)
 *     └─ ol (FlipGroup)             (data-slot="standings-list")
 *         └─ li × n                 (data-slot="standings-row", data-flip-id, data-rank, data-current, data-moved)
 *             ├─ span               (data-slot="standings-rank")
 *             ├─ span               (data-slot="standings-name", with a "You" tag on the viewer's row)
 *             │   under it: span?   (data-slot="standings-gained": "+990", this round)
 *             │         and span?   (data-slot="standings-moved": "▲ 2", places gained)
 *             └─ span               (data-slot="standings-score", CountUp)
 *
 * ## Content first
 *
 * The list is an ordered list in the final order once the glide starts, and
 * every figure is text: rank, name, points this round, places gained and
 * the total, read as one sentence per row. The moving digits are hidden from
 * assistive tech (CountUp keeps one stable label). Ranking is
 * `rankEntries` from leaderboard-model, so ties share a place everywhere.
 *
 * ## Motion
 *
 * Three beats, each one a thing the eye can follow: the round's points pop
 * in (scale only, so the text is never faint; 40ms apart a row), the totals
 * count up (`countMs`, 900ms), then the rows glide to their new places (FlipGroup,
 * transform only, 520ms) and a row that climbed shows its arrow. Under
 * reduced motion, or with `animate={false}`, the board is simply in its new
 * order with every figure in place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Names truncate before the figures move.
 *
 * | Rule | Concept                   | Where in this file                               |
 * | ---- | ------------------------- | ------------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentProps<'section'>`                |
 * | R6   | data-slot per part        | standings / -list / -row / -rank / -name / …     |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const             |
 * | R19  | Tokens only               | primary, success, muted, border                  |
 * | R26  | A11y                      | ordered list, figures in words, stable labels    |
 */

import * as React from 'react';

import { CountUp } from '../effects/count-up.js';
import { FlipGroup } from '../effects/flip-group.js';
import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { rankEntries, type RankedEntry } from './leaderboard-model.js';

export const MIN_VIEWPORT = 320 as const;

export interface StandingsEntry {
  id: string;
  name: string;
  /** The total after this round. */
  score: number;
  /** Points won this round, already in `score`. 0 or missing: none. */
  gained?: number;
}

export interface StandingsLabels {
  /** @default 'You' */
  you?: string;
  /** Read for a row's points this round. @default (n) => `${n} points this round` */
  gained?: (formatted: string) => string;
  /** Read for places gained. @default (n) => n === 1 ? 'up 1 place' : `up ${n} places` */
  up?: (n: number) => string;
  /** Read for places lost. @default (n) => n === 1 ? 'down 1 place' : `down ${n} places` */
  down?: (n: number) => string;
  /** Read before the total. @default 'total' */
  total?: string;
}

type StandingsProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  entries: readonly StandingsEntry[];
  /** Names the board. */
  caption: React.ReactNode;
  /** Show the caption, or keep it for assistive tech only. @default true */
  showCaption?: boolean;
  /** The viewing player's id: their row is marked and always shown. */
  currentId?: string;
  /** The most rows shown, plus the viewer's own if it falls below. @default 8 */
  limit?: number;
  /** Play the three beats. @default true */
  animate?: boolean;
  /** How long the totals count, in ms; the glide follows. @default 900 */
  countMs?: number;
  locale?: string;
  labels?: StandingsLabels;
};

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** The rows to show: the top `limit` by the new ranking, plus the viewer's own. */
function pick(now: RankedEntry[], limit: number, currentId?: string): Set<string> {
  const ids = new Set(now.slice(0, limit).map((e) => e.id));
  if (currentId && now.some((e) => e.id === currentId)) ids.add(currentId);
  return ids;
}

function Standings({
  entries,
  caption,
  showCaption = true,
  currentId,
  limit = 8,
  animate = true,
  countMs = 900,
  locale,
  labels,
  className,
  ...props
}: StandingsProps) {
  const reduced = useReducedMotion();
  const play = animate && !reduced;
  const captionId = React.useId();
  const rootRef = React.useRef<HTMLElement>(null);

  const gainedOf = React.useMemo(() => new Map(entries.map((e) => [e.id, Math.max(0, e.gained ?? 0)])), [entries]);
  const now = React.useMemo(() => rankEntries(entries.map(({ id, name, score }) => ({ id, name, score }))), [entries]);
  const before = React.useMemo(
    () =>
      rankEntries(
        entries.map(({ id, name, score, gained }) => ({ id, name, score: score - Math.max(0, gained ?? 0) })),
      ),
    [entries],
  );
  const shown = React.useMemo(() => pick(now, limit, currentId), [now, limit, currentId]);
  const beforeRank = React.useMemo(() => new Map(before.map((e) => [e.id, e.rank])), [before]);

  // A new round's figures start the beats again.
  const roundKey = entries.map((e) => `${e.id}:${e.score}`).join('|');
  const [phase, setPhase] = React.useState<'before' | 'after'>(play ? 'before' : 'after');
  React.useEffect(() => {
    if (!play) {
      setPhase('after');
      return;
    }
    setPhase('before');
    const list = rootRef.current;
    // Beat one: the round's points pop in, a row at a time.
    list?.querySelectorAll<HTMLElement>('[data-slot="standings-gained"]').forEach((chip, i) => {
      if (typeof chip.animate === 'function')
        chip.animate(
          [{ transform: 'scale(0.4)' }, { transform: 'scale(1.12)', offset: 0.6 }, { transform: 'scale(1)' }],
          { duration: 420, delay: i * 40, easing: EASE, fill: 'backwards' },
        );
    });
    // Beat three, once the totals have counted: the glide.
    const t = setTimeout(() => setPhase('after'), countMs);
    return () => clearTimeout(t);
  }, [roundKey, play, countMs]);

  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const order = (phase === 'before' ? before : now).filter((e) => shown.has(e.id));
  const nowRank = new Map(now.map((e) => [e.id, e]));
  const you = labels?.you ?? 'You';
  const words = {
    gained: labels?.gained ?? ((n: string) => `${n} points this round`),
    up: labels?.up ?? ((n: number) => (n === 1 ? 'up 1 place' : `up ${n} places`)),
    down: labels?.down ?? ((n: number) => (n === 1 ? 'down 1 place' : `down ${n} places`)),
    total: labels?.total ?? 'total',
  };

  return (
    <section
      ref={rootRef}
      data-slot="standings"
      data-phase={phase}
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-labelledby={captionId}
      className={cn('grid gap-3', className)}
      {...props}
    >
      <p
        id={captionId}
        data-slot="standings-caption"
        className={cn('font-heading text-lg font-semibold', !showCaption && 'sr-only')}
      >
        {caption}
      </p>
      <FlipGroup duration={520} render={<ol data-slot="standings-list" className="grid gap-2" />}>
        {order.map((shownEntry) => {
          const final = nowRank.get(shownEntry.id)!;
          const rank = phase === 'before' ? shownEntry.rank : final.rank;
          const tied = phase === 'before' ? shownEntry.tied : final.tied;
          const gained = gainedOf.get(final.id) ?? 0;
          const moved = (beforeRank.get(final.id) ?? final.rank) - final.rank;
          const current = final.id === currentId;
          const showMoved = phase === 'after' && moved !== 0;
          return (
            <li
              key={final.id}
              data-flip-id={final.id}
              data-slot="standings-row"
              data-rank={final.rank}
              data-current={current ? '' : undefined}
              data-moved={moved > 0 ? 'up' : moved < 0 ? 'down' : undefined}
              className={cn(
                'border-border bg-card text-card-foreground flex items-center gap-3 rounded-lg border px-3 py-2.5',
                current && 'border-primary bg-primary/8',
              )}
            >
              <span
                data-slot="standings-rank"
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-md text-sm font-semibold tabular-nums',
                  rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                )}
              >
                {tied ? `=${rank}` : rank}
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span data-slot="standings-name" className="flex min-w-0 items-center gap-2">
                  <span className={cn('truncate', current && 'font-semibold')}>{final.name}</span>
                  {current ? (
                    <span className="border-primary text-primary shrink-0 rounded-full border px-2 text-xs leading-5 font-semibold">
                      {you}
                    </span>
                  ) : null}
                </span>
                {gained > 0 || showMoved ? (
                  <span className="flex flex-wrap items-center gap-x-2 text-sm">
                    {gained > 0 ? (
                      <span
                        data-slot="standings-gained"
                        className="text-success inline-block font-semibold tabular-nums"
                      >
                        <span aria-hidden>+{nf.format(gained)}</span>
                        <span className="sr-only">, {words.gained(nf.format(gained))}</span>
                      </span>
                    ) : null}
                    {showMoved ? (
                      <span
                        data-slot="standings-moved"
                        className={cn(
                          'font-semibold tabular-nums',
                          moved > 0 ? 'text-success' : 'text-muted-foreground',
                        )}
                      >
                        <span aria-hidden>
                          {moved > 0 ? '▲' : '▼'} {Math.abs(moved)}
                        </span>
                        <span className="sr-only">, {moved > 0 ? words.up(moved) : words.down(-moved)}</span>
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
              <span data-slot="standings-score" className="shrink-0 text-end font-semibold tabular-nums">
                <span className="sr-only">, {words.total} </span>
                {play ? (
                  <CountUp
                    key={`${final.id}:${final.score}`}
                    value={final.score}
                    from={final.score - gained}
                    duration={countMs}
                    start="mount"
                    locale={locale}
                  />
                ) : (
                  nf.format(final.score)
                )}
              </span>
            </li>
          );
        })}
      </FlipGroup>
    </section>
  );
}

Standings.displayName = 'Standings';

export { Standings };
export type { StandingsProps };
