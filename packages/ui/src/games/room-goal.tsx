'use client';

/**
 * @interlace/ui — RoomGoal
 *
 * One meter for the whole room: a shared target, named milestones on the
 * way ("Bonus round", "Group photo"), and, when given, how many rounds in a
 * row most of the room got right. Built for the shared screen; it reads the
 * same on a phone.
 *
 * ## Anatomy
 *
 *   RoomGoal                       (div — data-slot="room-goal", data-state=progress|done)
 *     ├─ div                       (data-slot="room-goal-header": the label, the count, the streak)
 *     ├─ div role="meter"          (data-slot="room-goal-meter": track, fill, milestone ticks)
 *     ├─ ol                        (data-slot="room-goal-milestones": each one's name, reached or not)
 *     └─ span sr-only aria-live    (data-slot="room-goal-announce": "Milestone reached: Bonus round")
 *
 * ## Motion
 *
 * The fill moves to each new total (`--duration-slow`, `ease-move`); a
 * milestone the room just passed lifts once (250ms), and the meter's end
 * glows once when the goal is met. Under reduced motion the meter is simply
 * at its value.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                  |
 * | ---- | ------------------------- | --------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                         |
 * | R6   | data-slot per part        | room-goal / -header / -meter / -milestones / -announce |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                   |
 * | R8   | Enums, not booleans       | `size`                                              |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                |
 * | R26  | A11y                      | meter with a value text; milestones as a list; a pass announced once |
 */

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import type { RoomMilestone } from './room-goal-model.js';

export const MIN_VIEWPORT = 320 as const;

interface RoomGoalLabels {
  /** The meter's value in words. @default (v, t) => `${v} of ${t}` */
  value?: (value: string, target: string) => string;
  /** @default (label) => `Milestone reached: ${label}` */
  reached?: (label: string) => string;
  /** @default 'Goal reached.' */
  done?: string;
  /** @default (n) => `${n} rounds in a row` */
  streak?: (n: number, formatted: string) => string;
}

type RoomGoalProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** What the room is working toward. */
  label: React.ReactNode;
  /** The room's total so far, from `tallyRoomGoal`. */
  value: number;
  target: number;
  milestones?: readonly RoomMilestone[];
  /** Rounds in a row most of the room got right, from `roomStreak`. Hidden below 2. */
  streak?: number;
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
  locale?: string;
  labels?: RoomGoalLabels;
};

function RoomGoal({
  label,
  value,
  target,
  milestones = [],
  streak = 0,
  size = 'default',
  locale,
  labels,
  className,
  ...props
}: RoomGoalProps) {
  const reduced = useReducedMotion();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const stage = size === 'stage';
  const t = Number.isFinite(target) && target > 0 ? target : 0;
  const v = Number.isFinite(value) && value > 0 ? value : 0;
  const share = t > 0 ? Math.min(1, v / t) : 0;
  const done = t > 0 && v >= t;
  const ticks = [...milestones]
    .filter((m) => Number.isFinite(m.at) && m.at > 0 && m.at <= t)
    .sort((a, b) => a.at - b.at);
  const labelId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const prev = React.useRef(v);
  const [announce, setAnnounce] = React.useState('');

  // When the total passes a milestone (or the goal), say so once and lift it.
  React.useEffect(() => {
    const before = prev.current;
    prev.current = v;
    if (v <= before) return;
    const passed = ticks.filter((m) => before < m.at && v >= m.at);
    const finished = t > 0 && before < t && v >= t;
    const words = [
      ...passed.map((m) => (labels?.reached ?? ((l: string) => `Milestone reached: ${l}`))(m.label)),
      ...(finished && !passed.some((m) => m.at === t) ? [labels?.done ?? 'Goal reached.'] : []),
    ];
    if (words.length > 0) setAnnounce(words.join(' '));
    if (reduced) return;
    const root = rootRef.current;
    for (const m of passed) {
      const el = root?.querySelector<HTMLElement>(`[data-milestone="${m.at}"]`);
      if (el && typeof el.animate === 'function') {
        el.animate([{ transform: 'none' }, { transform: 'translateY(-4px) scale(1.04)' }, { transform: 'none' }], {
          duration: 250,
          easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
        });
      }
    }
    const end = root?.querySelector<HTMLElement>('[data-slot="room-goal-fill"]');
    if (finished && end && typeof end.animate === 'function') {
      end.animate([{ opacity: 1 }, { opacity: 0.6 }, { opacity: 1 }], { duration: 400, easing: 'ease-in-out' });
    }
    // Runs on each new total.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  const valueText = (labels?.value ?? ((a: string, b: string) => `${a} of ${b}`))(nf.format(v), nf.format(t));

  return (
    <div
      ref={rootRef}
      data-slot="room-goal"
      data-state={done ? 'done' : 'progress'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', className)}
      {...props}
    >
      <div data-slot="room-goal-header" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span
          id={labelId}
          className={cn('font-heading font-semibold text-balance', stage ? 'text-section' : 'text-lg')}
        >
          {label}
        </span>
        <span className={cn('flex items-baseline gap-3 tabular-nums', stage ? 'text-xl' : 'text-sm')}>
          {streak >= 2 ? (
            <span
              data-slot="room-goal-streak"
              className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 font-medium"
            >
              {(labels?.streak ?? ((n: number, f: string) => `${f} rounds in a row`))(streak, nf.format(streak))}
            </span>
          ) : null}
          <span aria-hidden className="font-semibold">
            {valueText}
          </span>
        </span>
      </div>
      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={t}
        aria-valuenow={Math.min(v, t)}
        aria-valuetext={valueText}
        data-slot="room-goal-meter"
        className={cn('bg-muted relative overflow-hidden rounded-full', stage ? 'h-6' : 'h-3')}
      >
        <span
          data-slot="room-goal-fill"
          className="bg-primary absolute inset-0 block origin-left rounded-full motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:ease-move rtl:origin-right"
          style={{ transform: `scaleX(${share})` }}
        />
        {ticks
          .filter((m) => m.at < t)
          .map((m) => (
            <span
              key={m.at}
              aria-hidden
              className={cn(
                'absolute inset-y-0 w-0.5 -translate-x-1/2 rtl:translate-x-1/2',
                v >= m.at ? 'bg-primary-foreground/70' : 'bg-foreground/25',
              )}
              style={{ insetInlineStart: `${(m.at / t) * 100}%` }}
            />
          ))}
      </div>
      {ticks.length > 0 ? (
        <ol data-slot="room-goal-milestones" className={cn('flex flex-wrap gap-2', stage ? 'text-base' : 'text-xs')}>
          {ticks.map((m) => {
            const hit = v >= m.at;
            return (
              <li
                key={m.at}
                data-milestone={m.at}
                data-reached={hit ? '' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                  hit ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground',
                )}
              >
                {hit ? <Check aria-hidden className="text-primary size-3.5" strokeWidth={3} /> : null}
                <span className="font-medium">{m.label}</span>
                <span className="tabular-nums">{nf.format(m.at)}</span>
                <span className="sr-only">{hit ? ', reached' : ''}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
      <span data-slot="room-goal-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
RoomGoal.displayName = 'RoomGoal';

export { RoomGoal };
export type { RoomGoalProps, RoomGoalLabels };
