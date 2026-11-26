/**
 * @interlace/ui — LevelMeter
 *
 * A player's level and how far they are into the next: the level, a bar of
 * XP, the XP still to go, and, right after a round, the XP just earned. The
 * arithmetic is `levelFor` / `gainXp` in `progress-model.ts`, exported so a
 * server shows the same level.
 *
 * ## Anatomy
 *
 *   LevelMeter                     (div — data-slot="level-meter", data-level-up when `gained` finished a level)
 *     ├─ div                       (data-slot="level-meter-head")
 *     │   ├─ span aria-hidden      (data-slot="level-meter-badge": the level number)
 *     │   ├─ p                     (data-slot="level-meter-level": "Level 4")
 *     │   └─ span                  (data-slot="level-meter-gained": "+15 XP", with `gained`)
 *     ├─ div role="meter"          (data-slot="level-meter-bar", labelled; the fill inside)
 *     └─ p                         (data-slot="level-meter-next": "85 XP to level 5")
 *
 * ## Motion
 *
 * With `gained`, the bar fills from where it was before the gain to where
 * it is now (from empty, if the gain finished a level), and the gain chip
 * rises in: CSS `@starting-style`, `--duration-slow`, `ease-move`, all
 * behind `motion-safe:`. Without `gained` nothing moves. Renders on the
 * server.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                     |
 * | ---- | ------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                          |
 * | R6   | data-slot per part        | level-meter / -head / -badge / -level / -gained / -bar / -fill / -next |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                      |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                   |
 * | R19  | Tokens only               | primary, border, muted-foreground                      |
 * | R26  | A11y                      | role="meter" with value text; the gain said in words   |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { gainXp, type LevelCurve } from './progress-model.js';

export const MIN_VIEWPORT = 320 as const;

interface LevelMeterLabels {
  /** @default n => `Level ${n}` */
  level?: (level: string) => string;
  /** @default (xp, next) => `${xp} XP to level ${next}` */
  toNext?: (xp: string, nextLevel: string) => string;
  /** @default n => `+${n} XP` */
  gained?: (xp: string) => string;
  /** Read for the gain chip. @default n => `${n} XP earned` */
  gainedSpoken?: (xp: string) => string;
  /** Names the bar. @default 'Progress to the next level' */
  bar?: string;
  /** The bar's value. @default (into, span) => `${into} of ${span} XP` */
  value?: (into: string, span: string) => string;
}

type LevelMeterProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** All the XP the player has, the latest gain included. */
  xp: number;
  /** XP just earned (included in `xp`). Shows the gain and animates the bar from before it. */
  gained?: number;
  curve?: Partial<LevelCurve>;
  /** BCP 47 locale for the numbers. */
  locale?: string;
  labels?: LevelMeterLabels;
};

function LevelMeter({ xp, gained = 0, curve, locale, labels, className, ...props }: LevelMeterProps) {
  const total = Number.isFinite(xp) && xp > 0 ? xp : 0;
  const g = Math.min(total, Number.isFinite(gained) && gained > 0 ? gained : 0);
  const { before, after, levelsUp } = gainXp(total - g, g, curve);
  const nf = new Intl.NumberFormat(locale);
  const from = g === 0 ? after.progress : levelsUp > 0 ? 0 : before.progress;
  const levelText = (labels?.level ?? ((n: string) => `Level ${n}`))(nf.format(after.level));

  return (
    <div
      data-slot="level-meter"
      data-level-up={levelsUp > 0 ? '' : undefined}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-2', className)}
      {...props}
    >
      <div data-slot="level-meter-head" className="flex items-center gap-2.5">
        <span
          aria-hidden
          data-slot="level-meter-badge"
          className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular-nums"
        >
          {nf.format(after.level)}
        </span>
        <p data-slot="level-meter-level" className="font-heading min-w-0 flex-1 font-semibold">
          {levelText}
        </p>
        {g > 0 ? (
          <span
            data-slot="level-meter-gained"
            className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums motion-safe:transition-[translate,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-enter motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0"
          >
            <span aria-hidden>{(labels?.gained ?? ((n: string) => `+${n} XP`))(nf.format(g))}</span>
            <span className="sr-only">{(labels?.gainedSpoken ?? ((n: string) => `${n} XP earned`))(nf.format(g))}</span>
          </span>
        ) : null}
      </div>
      <div
        role="meter"
        aria-label={labels?.bar ?? 'Progress to the next level'}
        aria-valuemin={0}
        aria-valuemax={after.span}
        aria-valuenow={after.into}
        aria-valuetext={(labels?.value ?? ((a: string, b: string) => `${a} of ${b} XP`))(
          nf.format(after.into),
          nf.format(after.span),
        )}
        data-slot="level-meter-bar"
        className="bg-border h-2.5 overflow-hidden rounded-full"
      >
        <div
          data-slot="level-meter-fill"
          style={{ '--from': String(from), scale: `${after.progress} 1` } as React.CSSProperties}
          className="bg-primary h-full w-full rounded-full ltr:origin-left rtl:origin-right motion-safe:transition-[scale] motion-safe:duration-(--duration-slow) motion-safe:ease-move motion-safe:starting:[scale:var(--from)_1]"
        />
      </div>
      <p data-slot="level-meter-next" dir="auto" className="text-muted-foreground text-sm tabular-nums">
        {(labels?.toNext ?? ((a: string, n: string) => `${a} XP to level ${n}`))(
          nf.format(after.toNext),
          nf.format(after.level + 1),
        )}
      </p>
    </div>
  );
}
LevelMeter.displayName = 'LevelMeter';

export { LevelMeter };
export type { LevelMeterProps, LevelMeterLabels };
