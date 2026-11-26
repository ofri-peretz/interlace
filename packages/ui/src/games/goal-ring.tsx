/**
 * @interlace/ui — GoalRing
 *
 * How far today is toward a daily goal: a ring that fills as points come
 * in, the count in its middle, and a check once the goal is met. It is a
 * `meter`, so assistive tech reads "15 of 20 XP" without the ring.
 *
 * ## Anatomy
 *
 *   GoalRing                       (div role="meter" — data-slot="goal-ring", data-state=progress|met)
 *     ├─ svg aria-hidden           (data-slot="goal-ring-track" and "goal-ring-fill" circles)
 *     └─ span                      (data-slot="goal-ring-label": the count, or a check when met)
 *
 * ## Motion
 *
 * The fill draws from empty on first paint and moves to each new value
 * (`stroke-dashoffset`, `--duration-slow`, `ease-move`); a met goal's check
 * scales in once. All of it sits behind `motion-safe:`, so under reduced
 * motion the ring is simply drawn at its value. CSS only, so it renders on
 * the server.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                            |
 * | ---- | ------------------------- | --------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                 |
 * | R6   | data-slot per part        | goal-ring / -track / -fill / -label           |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`             |
 * | R8   | Enums, not booleans       | `size`                                        |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const          |
 * | R19  | Tokens only               | primary, border, foreground                   |
 * | R26  | A11y                      | role="meter" with a value text                |
 */

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

export type GoalRingSize = 'sm' | 'default' | 'lg';

const SIZE: Record<GoalRingSize, { box: string; count: string; unit: string; icon: string; stroke: number }> = {
  sm: { box: 'size-12', count: 'text-sm', unit: 'hidden', icon: 'size-5', stroke: 5 },
  default: { box: 'size-20', count: 'text-lg', unit: 'text-xs', icon: 'size-7', stroke: 4.5 },
  lg: { box: 'size-28', count: 'text-h3', unit: 'text-sm', icon: 'size-10', stroke: 4 },
};

interface GoalRingLabels {
  /** Names the meter. @default 'Daily goal' */
  name?: string;
  /** The value read aloud. @default (v, g, unit) => `${v} of ${g} ${unit}` */
  value?: (value: string, goal: string, unit: string) => string;
  /** Said once the goal is met, after the value. @default 'Goal met.' */
  met?: string;
}

type GoalRingProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** Earned so far today. */
  value: number;
  /** The day's goal. */
  goal: number;
  /** The unit after the numbers. @default 'XP' */
  unit?: string;
  /** @default 'default' */
  size?: GoalRingSize;
  /** BCP 47 locale for the numbers. */
  locale?: string;
  labels?: GoalRingLabels;
};

function GoalRing({
  value,
  goal,
  unit = 'XP',
  size = 'default',
  locale,
  labels,
  className,
  ...props
}: GoalRingProps) {
  const v = Number.isFinite(value) && value > 0 ? value : 0;
  const g = Number.isFinite(goal) && goal > 0 ? goal : 0;
  const met = g === 0 || v >= g;
  const pct = g === 0 ? 100 : Math.min(100, (v / g) * 100);
  const nf = new Intl.NumberFormat(locale);
  const s = SIZE[size];
  const valueText = (labels?.value ?? ((a: string, b: string, u: string) => `${a} of ${b} ${u}`))(
    nf.format(v),
    nf.format(g),
    unit,
  );
  const r = 18 - s.stroke / 2;

  return (
    <div
      role="meter"
      aria-label={labels?.name ?? 'Daily goal'}
      aria-valuemin={0}
      aria-valuemax={g}
      aria-valuenow={Math.min(v, g)}
      aria-valuetext={met ? `${valueText}. ${labels?.met ?? 'Goal met.'}` : valueText}
      data-slot="goal-ring"
      data-state={met ? 'met' : 'progress'}
      data-size={size}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('relative inline-grid shrink-0 place-items-center', s.box, className)}
      {...props}
    >
      <svg aria-hidden viewBox="0 0 36 36" className="col-start-1 row-start-1 size-full -rotate-90 rtl:scale-y-[-1]">
        <circle
          data-slot="goal-ring-track"
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth={s.stroke}
          className="stroke-border"
        />
        <circle
          data-slot="goal-ring-fill"
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth={s.stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100 100"
          style={{ strokeDashoffset: 100 - pct }}
          className={cn(
            'stroke-primary',
            pct === 0 && 'opacity-0',
            'motion-safe:transition-[stroke-dashoffset] motion-safe:duration-(--duration-slow) motion-safe:ease-move motion-safe:starting:[stroke-dashoffset:100]',
          )}
        />
      </svg>
      <span
        aria-hidden
        data-slot="goal-ring-label"
        className="col-start-1 row-start-1 grid place-items-center leading-none tabular-nums"
      >
        {met ? (
          <Check
            strokeWidth={3}
            className={cn(
              'text-primary',
              s.icon,
              'motion-safe:transition-[scale,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-enter motion-safe:starting:scale-50 motion-safe:starting:opacity-0',
            )}
          />
        ) : (
          <>
            <span className={cn('font-semibold', s.count)}>{nf.format(v)}</span>
            <span className={cn('text-muted-foreground', s.unit)}>/{nf.format(g)}</span>
          </>
        )}
      </span>
    </div>
  );
}
GoalRing.displayName = 'GoalRing';

export { GoalRing };
export type { GoalRingProps, GoalRingLabels };
