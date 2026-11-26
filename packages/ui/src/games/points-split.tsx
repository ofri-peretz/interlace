'use client';

/**
 * @interlace/ui — PointsSplit and PointsTotals
 *
 * Spend a budget of points across options. `PointsSplit` is a phone: each
 * option has a minus and a plus, a bar shows how much of the budget sits
 * on it, and a counter says what is left; Send unlocks when the budget is
 * spent. `PointsTotals` is the screen: the room's points per option, most
 * first, gliding as the order changes.
 *
 * ## Anatomy
 *
 *   PointsSplit                     (fieldset — data-slot="points-split", data-state=choosing|sent)
 *     ├─ legend                     (data-slot="points-split-question")
 *     ├─ p aria-live                (data-slot="points-split-left": "40 points left")
 *     ├─ ul > li × n                (data-slot="points-split-option": name, bar, −, value, +)
 *     └─ Button                     (data-slot="points-split-send")
 *   PointsTotals                    (FlipGroup ol — data-slot="points-totals")
 *     └─ li × n                     (name, bar, points, share; read as one line each)
 *
 * ## Motion
 *
 * Bars grow and shrink with each tap (transform, 150ms). On the screen, rows
 * glide to their new rank (FlipGroup). Under reduced motion they just change.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `fieldset` / `ol` props                              |
 * | R6   | data-slot per part        | points-split / -question / -left / -option / -send; points-totals |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onChange` / `onSend`     |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | buttons named per option; the left count announced; value as text |
 */

import { Minus, Plus } from 'lucide-react';
import * as React from 'react';

import { FlipGroup } from '../effects/flip-group.js';
import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { checkSplit, nudge, spentOf, type PointsRules, type PointsTotal, type Split } from './points-model.js';

export const MIN_VIEWPORT = 320 as const;

interface PointsOption {
  id: string;
  label: string;
}

interface PointsSplitLabels {
  /** @default (n) => `${n} points left` */
  left?: (left: string) => string;
  /** @default (label, step) => `Add ${step} points to ${label}` */
  add?: (label: string, step: string) => string;
  /** @default (label, step) => `Take ${step} points from ${label}` */
  remove?: (label: string, step: string) => string;
  /** @default 'Send' */
  send?: string;
  /** @default 'Sent. Thank you.' */
  sent?: string;
}

type PointsSplitProps = Omit<React.ComponentProps<'fieldset'>, 'children' | 'defaultValue' | 'onChange'> &
  PointsRules & {
    question: React.ReactNode;
    options: readonly PointsOption[];
    /** The split while choosing, controlled. */
    value?: Split;
    defaultValue?: Split;
    onChange?: (split: Split) => void;
    /** Called once with a valid split. */
    onSend?: (split: Split) => void;
    /** Shown after sending, instead of the controls. */
    sent?: boolean;
    locale?: string;
    labels?: PointsSplitLabels;
  };

function PointsSplit({
  question,
  options,
  budget = 100,
  step = 10,
  partial = false,
  value: valueProp,
  defaultValue = {},
  onChange,
  onSend,
  sent: sentProp,
  locale,
  labels,
  className,
  disabled,
  ...props
}: PointsSplitProps) {
  const [own, setOwn] = React.useState<Split>(defaultValue);
  const split = valueProp ?? own;
  const [sentHere, setSentHere] = React.useState(false);
  const sent = sentProp ?? sentHere;
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const rules = { budget, step, partial };
  const left = budget - spentOf(split);
  const ids = options.map((o) => o.id);
  const valid = checkSplit(split, ids, rules).ok;

  const set = (next: Split) => {
    if (valueProp === undefined) setOwn(next);
    onChange?.(next);
  };
  const send = () => {
    if (!valid || sent) return;
    setSentHere(true);
    onSend?.(split);
  };

  return (
    <fieldset
      data-slot="points-split"
      data-state={sent ? 'sent' : 'choosing'}
      data-min-viewport={String(MIN_VIEWPORT)}
      disabled={disabled || sent}
      className={cn('grid min-w-0 gap-4', className)}
      {...props}
    >
      <legend data-slot="points-split-question" className="font-heading mb-1 text-lg font-semibold text-balance">
        {question}
      </legend>
      <p
        data-slot="points-split-left"
        aria-live="polite"
        className={cn('text-sm font-medium tabular-nums', left === 0 ? 'text-muted-foreground' : 'text-foreground')}
      >
        {sent
          ? (labels?.sent ?? 'Sent. Thank you.')
          : (labels?.left ?? ((n: string) => `${n} points left`))(nf.format(left))}
      </p>
      <ul className="grid gap-3">
        {options.map((o) => {
          const n = split[o.id] ?? 0;
          const stepText = nf.format(step);
          return (
            <li key={o.id} data-slot="points-split-option" className="grid gap-1.5">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-sm font-medium">{o.label}</span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={(labels?.remove ?? ((l: string, s: string) => `Take ${s} points from ${l}`))(
                    o.label,
                    stepText,
                  )}
                  disabled={n === 0}
                  onClick={() => set(nudge(split, o.id, -step, rules))}
                >
                  <Minus aria-hidden />
                </Button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">{nf.format(n)}</span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={(labels?.add ?? ((l: string, s: string) => `Add ${s} points to ${l}`))(o.label, stepText)}
                  disabled={left < step}
                  onClick={() => set(nudge(split, o.id, step, rules))}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
              <span aria-hidden className="bg-muted block h-1.5 overflow-hidden rounded-full">
                <span
                  className="bg-primary block h-full origin-left rounded-full motion-safe:transition-transform motion-safe:duration-(--duration-base) motion-safe:ease-move rtl:origin-right"
                  style={{ transform: `scaleX(${budget > 0 ? n / budget : 0})` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      {!sent ? (
        <Button data-slot="points-split-send" size="lg" className="justify-self-start" disabled={!valid} onClick={send}>
          {labels?.send ?? 'Send'}
        </Button>
      ) : null}
    </fieldset>
  );
}
PointsSplit.displayName = 'PointsSplit';

// --- PointsTotals (screen) -------------------------------------------------------

interface PointsTotalsLabels {
  /** One row, read whole. @default (r) => `${r.label}: ${r.points} points, ${r.share}` */
  row?: (r: { label: string; points: string; share: string }) => string;
}

type PointsTotalsProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** From `totalPoints`. */
  totals: readonly PointsTotal[];
  options: readonly PointsOption[];
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
  locale?: string;
  labels?: PointsTotalsLabels;
};

function PointsTotals({ totals, options, size = 'default', locale, labels, className, ...props }: PointsTotalsProps) {
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pct = React.useMemo(() => new Intl.NumberFormat(locale, { style: 'percent' }), [locale]);
  const names = new Map(options.map((o) => [o.id, o.label]));
  const top = Math.max(...totals.map((t) => t.share), Number.EPSILON);
  const stage = size === 'stage';
  return (
    <FlipGroup
      render={<ol />}
      data-slot="points-totals"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', className)}
      {...props}
    >
      {totals.map((t) => {
        const label = names.get(t.id) ?? t.id;
        const points = nf.format(t.points);
        const share = pct.format(t.share);
        return (
          <li key={t.id} data-flip-id={t.id} className="grid gap-1">
            <span className="sr-only">
              {(labels?.row ?? ((r) => `${r.label}: ${r.points} points, ${r.share}`))({ label, points, share })}
            </span>
            <div aria-hidden className={cn('flex items-baseline gap-3', stage ? 'text-lg' : 'text-sm')}>
              <span className="min-w-0 flex-1 font-medium">{label}</span>
              <span className="font-semibold tabular-nums">{points}</span>
              <span className="text-muted-foreground w-12 text-end tabular-nums">{share}</span>
            </div>
            <span aria-hidden className={cn('bg-muted block overflow-hidden rounded-full', stage ? 'h-3' : 'h-2')}>
              <span
                className="bg-primary block h-full origin-left rounded-full motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:ease-move rtl:origin-right"
                style={{ transform: `scaleX(${t.share / top})` }}
              />
            </span>
          </li>
        );
      })}
    </FlipGroup>
  );
}
PointsTotals.displayName = 'PointsTotals';

export { PointsSplit, PointsTotals };
export type { PointsSplitProps, PointsSplitLabels, PointsTotalsProps, PointsTotalsLabels, PointsOption };
