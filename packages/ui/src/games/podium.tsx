'use client';

/**
 * @interlace/ui — Podium
 *
 * The end of a game: the top three on steps, second and third rising first
 * and the winner last, with a burst for first place. Below it, everyone
 * else, so no one has to wonder where they came. Ranking is the
 * leaderboard's (`rankEntries`), so ties share a place on both.
 *
 * ## Anatomy
 *
 *   Podium                         (section — data-slot="podium")
 *     ├─ ol                        (data-slot="podium-steps": 1st, 2nd, 3rd in reading order)
 *     │   └─ li × ≤3               (data-slot="podium-place", data-place, data-current)
 *     │       ├─ span              (data-slot="podium-label": name, "You", score)
 *     │       │   ├─ span          (data-slot="podium-name")
 *     │       │   └─ span          (data-slot="podium-score")
 *     │       └─ span aria-hidden  (data-slot="podium-step": the block, its place on it)
 *     └─ ol                        (data-slot="podium-rest": everyone after the top three)
 *
 * ## Order
 *
 * The list reads 1st, 2nd, 3rd for a screen reader and a phone; the steps
 * are placed 2nd, 1st, 3rd with grid columns, which mirror in RTL. Place
 * words come from `labels.place` (English ordinals by default), and the
 * viewer's row says "You" in words.
 *
 * ## Motion
 *
 * On mount (or when `play` changes), the steps grow up from the floor,
 * 3rd, 2nd, then 1st, 350ms apart, each name fading in on its step, and a
 * Celebrate burst on the winner. Transform and opacity only. Under reduced
 * motion, or with `animate={false}`, the podium is simply there. The text
 * is in the server HTML from the start.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                    |
 * | ---- | ------------------------- | ----------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'section'>`                     |
 * | R6   | data-slot per part        | podium / -steps / -place / -name / -score / -step / -rest |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                     |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                  |
 * | R19  | Tokens only               | primary, muted, border                                |
 * | R26  | A11y                      | ordered lists in rank order; "You" in words           |
 */

import * as React from 'react';

import { Celebrate } from '../effects/celebrate.js';
import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { rankEntries, type LeaderboardEntry, type RankedEntry } from './leaderboard-model.js';

export const MIN_VIEWPORT = 320 as const;

const ORDINAL: Record<string, string> = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th',
};
const en = new Intl.PluralRules('en-US', { type: 'ordinal' });
const PLACE = (rank: number) => `${rank}${ORDINAL[en.select(rank)] ?? 'th'}`;

interface PodiumLabels {
  /** A place in words. @default English ordinals: 1st, 2nd, 3rd */
  place?: (rank: number) => string;
  /** @default 'You' */
  you?: string;
  /** Names the top three. @default 'Top three' */
  top?: string;
  /** Names everyone else. @default 'Everyone else' */
  rest?: string;
}

type PodiumProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  entries: readonly LeaderboardEntry[];
  /** The viewer's id, to mark their place. */
  currentId?: string;
  /** Rise on mount. @default true */
  animate?: boolean;
  /** Plays the rise again each time this changes. */
  play?: string | number;
  /** List everyone after the top three. @default true */
  showRest?: boolean;
  /** `Intl.NumberFormat` options for scores. */
  format?: Intl.NumberFormatOptions;
  locale?: string;
  labels?: PodiumLabels;
};

// Column (2nd, 1st, 3rd) and height per place.
const STEP = [
  {
    col: 'col-start-2',
    height: 'h-32',
    tone: 'bg-primary text-primary-foreground',
  },
  {
    col: 'col-start-1',
    height: 'h-24',
    tone: 'bg-muted text-foreground border-border border border-b-0',
  },
  { col: 'col-start-3', height: 'h-16', tone: 'bg-muted text-foreground border-border border border-b-0' },
] as const;
const RISE_ORDER = [2, 1, 0];
const GAP = 350;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function Podium({
  entries,
  currentId,
  animate = true,
  play,
  showRest = true,
  format,
  locale,
  labels,
  className,
  ...props
}: PodiumProps) {
  const reduced = useReducedMotion();
  const ranked = rankEntries(entries);
  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const nf = new Intl.NumberFormat(locale, format);
  const place = labels?.place ?? PLACE;
  const you = labels?.you ?? 'You';
  const stepsRef = React.useRef<HTMLOListElement>(null);
  const [cheer, setCheer] = React.useState(0);

  React.useEffect(() => {
    if (!animate || reduced) return;
    const items = stepsRef.current?.querySelectorAll<HTMLElement>('[data-slot="podium-place"]');
    if (!items) return;
    const running: Animation[] = [];
    RISE_ORDER.forEach((index, order) => {
      const item = items[index];
      if (!item) return;
      const delay = order * GAP - (3 - items.length) * GAP;
      const step = item.querySelector<HTMLElement>('[data-slot="podium-step"]');
      const label = item.querySelector<HTMLElement>('[data-slot="podium-label"]');
      if (step && typeof step.animate === 'function') {
        running.push(
          step.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
            duration: 500,
            delay: Math.max(0, delay),
            easing: EASE,
            fill: 'backwards',
          }),
        );
      }
      if (label && typeof label.animate === 'function') {
        running.push(
          label.animate(
            [
              { transform: 'translateY(0.5rem)', opacity: 0 },
              { transform: 'translateY(0)', opacity: 1 },
            ],
            {
              duration: 300,
              delay: Math.max(0, delay) + 350,
              easing: EASE,
              fill: 'backwards',
            },
          ),
        );
      }
    });
    const t = setTimeout(() => setCheer((c) => c + 1), (items.length - 1) * GAP + 650);
    return () => {
      clearTimeout(t);
      running.forEach((a) => a.cancel());
    };
  }, [animate, reduced, play]);

  return (
    <section
      data-slot="podium"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex flex-col gap-6', className)}
      {...props}
    >
      <ol
        ref={stepsRef}
        data-slot="podium-steps"
        aria-label={labels?.top ?? 'Top three'}
        className="grid grid-cols-3 items-end gap-2"
      >
        {top.map((e: RankedEntry, i) => {
          const s = STEP[i]!;
          const current = e.id === currentId;
          return (
            <li
              key={e.id}
              data-slot="podium-place"
              data-place={e.rank}
              data-current={current ? '' : undefined}
              className={cn('row-start-1 flex min-w-0 flex-col items-center gap-2 text-center', s.col)}
            >
              <span data-slot="podium-label" className="flex w-full min-w-0 flex-col items-center gap-0.5">
                <span data-slot="podium-name" className={cn('w-full truncate font-semibold', i === 0 && 'text-lg')}>
                  {e.name}
                </span>
                {current ? (
                  <span className="border-primary text-primary rounded-full border px-2 text-xs leading-5 font-semibold">
                    {you}
                  </span>
                ) : null}
                <span data-slot="podium-score" className="text-muted-foreground text-sm tabular-nums">
                  {nf.format(e.score)}
                </span>
              </span>
              <span
                data-slot="podium-step"
                className={cn(
                  'flex w-full origin-bottom items-start justify-center rounded-t-lg pt-3 text-xl font-semibold',
                  s.height,
                  s.tone,
                )}
              >
                {i === 0 ? (
                  <Celebrate play={cheer || null} tone="highlight">
                    <span className="px-2">{place(e.rank)}</span>
                  </Celebrate>
                ) : (
                  place(e.rank)
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {showRest && rest.length ? (
        <ol
          data-slot="podium-rest"
          aria-label={labels?.rest ?? 'Everyone else'}
          className="border-border divide-border divide-y rounded-xl border text-sm"
        >
          {rest.map((e) => {
            const current = e.id === currentId;
            return (
              <li
                key={e.id}
                data-current={current ? '' : undefined}
                className={cn('flex items-center gap-3 px-3 py-2.5', current && 'bg-primary/8')}
              >
                <span className="text-muted-foreground w-10 shrink-0 tabular-nums">{place(e.rank)}</span>
                <span className={cn('min-w-0 flex-1 truncate', current && 'font-semibold')}>{e.name}</span>
                {current ? (
                  <span className="border-primary text-primary shrink-0 rounded-full border px-2 text-xs leading-5 font-semibold">
                    {you}
                  </span>
                ) : null}
                <span className={cn('shrink-0 tabular-nums', current && 'font-semibold')}>{nf.format(e.score)}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
Podium.displayName = 'Podium';

export { Podium };
export type { PodiumProps, PodiumLabels };
