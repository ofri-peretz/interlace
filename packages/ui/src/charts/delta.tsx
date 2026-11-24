/**
 * @interlace/ui — Delta
 *
 * "It moved, this much, this way." The smallest complete unit of analysis and
 * the most-repeated element in a dense view, so it is worth getting exactly
 * right once.
 *
 * ## Three signals, not one
 *
 * Direction is carried by a **glyph** (▲ ▼ –), a **sign** (+ / −), and a
 * **colour** — in that order of reliability. Colour is last on purpose: it is
 * the one that disappears in greyscale, in bright sun, and for the ~8% of men
 * with red-green colour vision deficiency. Any of the three alone is enough to
 * read the value, which is the actual requirement behind WCAG 1.4.1.
 *
 * ## "Good" is not a property of a number
 *
 * A rising error rate is bad; a rising follower count is good. `polarity`
 * decides which direction gets `--viz-positive`. It defaults to `normal`
 * (up = good) because that is the common case, but a chart of latency,
 * bounce rate, or cost must pass `polarity="inverse"` — otherwise the
 * dashboard cheerfully paints a regression green.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Inline text; wraps with its line.
 *
 * | Rule | Concept                    | Where in this file                                     |
 * | ---- | -------------------------- | ------------------------------------------------------ |
 * | R6   | data-slot                  | `data-slot="delta"`                                    |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                               |
 * | R8   | Enums for >2 states        | `polarity` (normal/inverse); `direction` from the data |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`             |
 * | R18  | Tailwind only              | zero inline `style`                                    |
 * | R19  | Tokens only                | `text-viz-positive/-negative/-neutral`                 |
 * | R20  | AA contrast                | aliases `--success` / `--destructive` (≥7:1 both themes)|
 * | R26  | A11y                       | glyph is `aria-hidden`; the sentence is in the label   |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { delta as computeDelta, type Direction, type Point } from './scale.js';

export const MIN_VIEWPORT = 320 as const;

/** Which direction counts as good. Latency and cost are `inverse`. */
export type Polarity = 'normal' | 'inverse';

const GLYPH: Record<Direction, string> = { up: '▲', down: '▼', flat: '–' };

const TONE: Record<'good' | 'bad' | 'flat', string> = {
  good: 'text-viz-positive',
  bad: 'text-viz-negative',
  flat: 'text-viz-neutral',
};

/** Exported so tests and callers agree on the mapping rather than re-deriving it. */
export function toneFor(direction: Direction, polarity: Polarity): 'good' | 'bad' | 'flat' {
  if (direction === 'flat') return 'flat';
  const isGood = polarity === 'normal' ? direction === 'up' : direction === 'down';
  return isGood ? 'good' : 'bad';
}

/** What Delta's spoken sentence is built from. Numbers come formatted. */
export interface DeltaSpoken {
  direction: Direction;
  /** The size of the change, without a sign. */
  magnitude: string;
  /** The percentage change, without a sign, or null when the start was 0. */
  pct: string | null;
  from: string;
  to: string;
  unit?: string;
}

/** Every fixed word in Delta. Pass only the ones to change. */
export interface DeltaLabels {
  /** Read when there are fewer than two points. */
  empty: string;
  /** The sentence a screen reader hears for the change. */
  spoken: (change: DeltaSpoken) => string;
}

const LABELS: DeltaLabels = {
  empty: 'Not enough data to compare',
  spoken: ({ direction, magnitude, pct, from, to, unit }) =>
    direction === 'flat'
      ? `unchanged${unit ? ` ${unit}` : ''}`
      : `${direction} ${magnitude}${unit ? ` ${unit}` : ''}${pct ? `, ${pct}` : ''}, from ${from} to ${to}`,
};

export interface DeltaProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  points: readonly Point[];
  polarity?: Polarity;
  /** Show the percentage alongside the absolute change. */
  percent?: boolean;
  /** Noun for the accessible sentence — "views", "downloads". */
  unit?: string;
  /** The locale for numbers. @default the reader's */
  locale?: string;
  /** Replace the spoken words: the empty note and the change sentence. */
  labels?: Partial<DeltaLabels>;
}

export const Delta = React.forwardRef<HTMLSpanElement, DeltaProps>(function Delta(
  { points, polarity = 'normal', percent = true, unit, locale, labels: labelsProp, className, ...props },
  ref,
) {
  const change = React.useMemo(() => computeDelta(points), [points]);
  const labels = { ...LABELS, ...labelsProp };
  const format = new Intl.NumberFormat(locale);

  if (!change) {
    return (
      <span
        ref={ref}
        data-slot="delta-empty"
        className={cn('whitespace-nowrap text-viz-neutral tabular-nums', className)}
        {...props}
      >
        <span aria-hidden>–</span>
        <span className="sr-only">{labels.empty}</span>
      </span>
    );
  }

  const tone = toneFor(change.direction, polarity);
  const sign = change.direction === 'up' ? '+' : change.direction === 'down' ? '−' : '';
  const magnitude = format.format(Math.abs(change.abs));
  const pct =
    change.pct === null
      ? null
      : new Intl.NumberFormat(locale, {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(Math.abs(change.pct) / 100);

  const spoken = labels.spoken({
    direction: change.direction,
    magnitude,
    pct,
    from: format.format(change.from),
    to: format.format(change.to),
    unit,
  });

  return (
    <span
      ref={ref}
      data-slot="delta"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-direction={change.direction}
      data-tone={tone}
      // Plain inline — NOT inline-flex, NOT inline-block. Both are
      // shrink-to-fit boxes, and inside a `<td>` both resolved their width
      // against the cell's in-progress width and collapsed to
      // `offsetWidth: 0` while the text measured 113px: the digits rendered
      // outside their own box and overlapped the neighbouring column. An
      // inline box has no width of its own to get wrong — it is just text in
      // the line box, which is what this always was. Flex for two adjacent
      // spans was over-engineering that bought a layout bug.
      className={cn('whitespace-nowrap tabular-nums', TONE[tone], className)}
      {...props}
    >
      {/* Glyph and digits are decorative duplicates of the sentence below —
          announcing "▲ + 1 2 4" before the sentence is worse than silence. */}
      <span aria-hidden className="mr-1 text-[0.75em] leading-none">
        {GLYPH[change.direction]}
      </span>
      <span aria-hidden>
        {sign}
        {magnitude}
        {percent && pct ? ` (${sign}${pct})` : ''}
      </span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
});
