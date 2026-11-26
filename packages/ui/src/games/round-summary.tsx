'use client';

/**
 * @interlace/ui — RoundSummary
 *
 * The moment a round ends: what the player earned, where today's goal
 * stands, the streak it kept, and anything new they reached (a milestone,
 * a level). Then the next step, which the app passes as children: share,
 * play on, come back tomorrow. It celebrates once, quietly, and gets out of
 * the way.
 *
 * ## Anatomy
 *
 *   RoundSummary                   (section — data-slot="round-summary", labelled by its heading)
 *     ├─ h2…h4                     (data-slot="round-summary-title", focusable with focusOnMount)
 *     ├─ p                         (data-slot="round-summary-description")
 *     ├─ dl                        (data-slot="round-summary-stats", a container-query grid)
 *     │   ├─ div                   (data-slot="round-summary-stat", data-stat="xp": +XP counted up)
 *     │   ├─ div                   (data-stat="goal": a small GoalRing and what is left)
 *     │   └─ div                   (data-stat="streak": the count, burst when it grew)
 *     ├─ div role="status"         (data-slot="round-summary-highlight": a check and the news)
 *     └─ div                       (data-slot="round-summary-actions": children)
 *
 * Every stat is optional; leave one out and the grid closes up.
 *
 * ## When it celebrates
 *
 * The XP counts up, the streak and the highlight play a short burst, once,
 * after mount, and only with `celebrate` (default true). Pass
 * `celebrate={false}` when showing a round finished earlier, so a reload
 * does not replay it. Under reduced motion the numbers land at once and no
 * burst plays; the words are the same.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Stats stack below a 28rem container and sit in a row above it.
 *
 * | Rule | Concept                   | Where in this file                                     |
 * | ---- | ------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentProps<'section'>`                      |
 * | R6   | data-slot per part        | round-summary / -title / -description / -stats / -stat / -highlight / -actions |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                      |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                   |
 * | R19  | Tokens only               | card, border, primary, muted-foreground                |
 * | R25  | Client component          | the count and the burst run in the browser             |
 * | R26  | A11y                      | a labelled section; stats as a description list; the news as a status |
 */

import * as React from 'react';
import { Flame } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Celebrate, CelebrateCheck } from '../effects/celebrate.js';
import { CountUp } from '../effects/count-up.js';
import { GoalRing } from './goal-ring.js';

export const MIN_VIEWPORT = 320 as const;

interface RoundSummaryLabels {
  /** @default 'XP earned' */
  xp?: string;
  /** @default 'Daily goal' */
  goal?: string;
  /** @default 'Goal met' */
  goalMet?: string;
  /** @default n => `${n} XP to go` */
  goalLeft?: (xp: string) => string;
  /** @default 'Day streak' */
  streak?: string;
  /** Said after the streak count when it grew today. @default 'Kept today' */
  streakKept?: string;
}

type RoundSummaryProps = Omit<React.ComponentProps<'section'>, 'title'> & {
  title: React.ReactNode;
  /** The heading's level. @default 2 */
  headingLevel?: 2 | 3 | 4;
  /** A line under the title: how the round went, in words. */
  description?: React.ReactNode;
  /** XP this round earned. */
  xp?: number;
  /** Today's XP (this round included) and the goal. */
  goal?: { earned: number; goal: number; unit?: string };
  /** The streak now, and whether this round extended it. */
  streak?: { current: number; extended?: boolean };
  /** News worth a moment: a milestone, a new level. Announced politely. */
  highlight?: React.ReactNode;
  /** Play the count and the bursts once after mount. @default true */
  celebrate?: boolean;
  /** Move focus to the title on mount, for a screen that replaces the round. @default false */
  focusOnMount?: boolean;
  /** BCP 47 locale for the numbers. */
  locale?: string;
  labels?: RoundSummaryLabels;
  /** The next step: share, play again, come back tomorrow. */
  children?: React.ReactNode;
};

const STAT = 'grid content-start justify-items-start gap-1.5 rounded-xl border border-border bg-card p-4';

function RoundSummary({
  title,
  headingLevel = 2,
  description,
  xp,
  goal,
  streak,
  highlight,
  celebrate = true,
  focusOnMount = false,
  locale,
  labels,
  className,
  children,
  ...props
}: RoundSummaryProps) {
  const id = React.useId();
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    setShown(true);
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);
  const play = celebrate && shown;
  const Heading = `h${headingLevel}` as 'h2';
  const nf = new Intl.NumberFormat(locale);
  const goalMet = goal ? goal.goal <= 0 || goal.earned >= goal.goal : false;

  return (
    <section
      aria-labelledby={`${id}-title`}
      data-slot="round-summary"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container grid gap-5', className)}
      {...props}
    >
      <div className="grid gap-1.5">
        <Heading
          ref={headingRef}
          id={`${id}-title`}
          tabIndex={focusOnMount ? -1 : undefined}
          data-slot="round-summary-title"
          className="font-heading text-h2 font-semibold text-balance outline-none"
        >
          {title}
        </Heading>
        {description ? (
          <p data-slot="round-summary-description" className="text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>

      {xp !== undefined || goal || streak ? (
        <dl data-slot="round-summary-stats" className="grid gap-3 @md:auto-cols-fr @md:grid-flow-col">
          {xp !== undefined ? (
            <div data-slot="round-summary-stat" data-stat="xp" className={STAT}>
              <dt className="text-muted-foreground text-sm">{labels?.xp ?? 'XP earned'}</dt>
              <dd className="font-heading text-section text-primary leading-none font-semibold tabular-nums">
                <span aria-hidden>+</span>
                {play ? (
                  <CountUp value={xp} start="mount" duration={700} locale={locale} />
                ) : (
                  nf.format(xp)
                )}
              </dd>
            </div>
          ) : null}
          {goal ? (
            <div data-slot="round-summary-stat" data-stat="goal" className={cn(STAT, 'grid-cols-[auto_1fr] items-center gap-x-3')}>
              <dt className="sr-only">{labels?.goal ?? 'Daily goal'}</dt>
              <dd className="contents">
                <GoalRing
                  size="sm"
                  value={goal.earned}
                  goal={goal.goal}
                  unit={goal.unit}
                  locale={locale}
                  labels={{ name: labels?.goal ?? 'Daily goal' }}
                />
                <span className="grid gap-0.5">
                  <span className="text-muted-foreground text-sm" aria-hidden>
                    {labels?.goal ?? 'Daily goal'}
                  </span>
                  <span className="font-semibold">
                    {goalMet
                      ? (labels?.goalMet ?? 'Goal met')
                      : (labels?.goalLeft ?? ((n: string) => `${n} XP to go`))(nf.format(goal.goal - goal.earned))}
                  </span>
                </span>
              </dd>
            </div>
          ) : null}
          {streak ? (
            <div data-slot="round-summary-stat" data-stat="streak" className={STAT}>
              <dt className="text-muted-foreground text-sm">{labels?.streak ?? 'Day streak'}</dt>
              <dd className="flex items-center gap-2">
                <Celebrate play={play && streak.extended ? 'streak' : null} tone="primary" rays={10}>
                  <Flame
                    aria-hidden
                    className={cn('size-7', streak.extended ? 'text-primary' : 'text-muted-foreground')}
                  />
                </Celebrate>
                <span className="font-heading text-section leading-none font-semibold tabular-nums">
                  {nf.format(streak.current)}
                </span>
                {streak.extended ? (
                  <span className="text-muted-foreground self-end text-sm">{labels?.streakKept ?? 'Kept today'}</span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {highlight ? (
        <div
          role="status"
          data-slot="round-summary-highlight"
          className="border-primary/30 bg-primary/5 flex items-center gap-3 rounded-xl border p-4"
        >
          <Celebrate play={play ? 'highlight' : null} tone="primary">
            <CelebrateCheck tone="primary" animate={celebrate} />
          </Celebrate>
          <div className="min-w-0 font-medium text-pretty">{highlight}</div>
        </div>
      ) : null}

      {children ? (
        <div data-slot="round-summary-actions" className="grid gap-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
RoundSummary.displayName = 'RoundSummary';

export { RoundSummary };
export type { RoundSummaryProps, RoundSummaryLabels };
