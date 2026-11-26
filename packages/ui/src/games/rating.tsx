'use client';

/**
 * @interlace/ui — Rating
 *
 * A scale question for a room: how familiar, how likely to recommend, how
 * are you feeling. Each person picks one step and sends it; then they see
 * the room's answers on the same scale, their own step marked, the room's
 * average, and, when the question was asked before, where the room stood
 * then. A 0 to 10 scale also shows the recommend score.
 *
 * ## Anatomy
 *
 *   Rating                         (div — data-slot="rating", data-state=choosing|sent)
 *     ├─ p                         (data-slot="rating-question")
 *     ├─ RadioGroup (choosing)     (data-slot="rating-steps": one radio per step, arrows move)
 *     ├─ div aria-hidden (sent)    (data-slot="rating-chart": a bar per step, a ghost bar for before)
 *     ├─ div                       (data-slot="rating-ends": the words for each end)
 *     ├─ Button (choosing)         (data-slot="rating-send")
 *     └─ p tabIndex=-1 aria-live  (data-slot="rating-result": the picture in one sentence)
 *
 * ## Data
 *
 * `values` are the room's ratings from your store, without this viewer's
 * own unless `valuesIncludeOwn`. `before` is an earlier round. `faces`
 * replaces the numbers with icons (a mood check); each still has a name
 * for screen readers. `minResponses` keeps the room hidden until enough
 * people have answered. The rules live in `games/rating-model`.
 *
 * ## Motion
 *
 * Bars are each round's shares on one scale, so rounds of different sizes
 * compare fairly. On sending, the bars grow from the baseline together (250ms, transform).
 * Under reduced motion the chart is simply there.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                    |
 * | ---- | ------------------------- | ----------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                           |
 * | R6   | data-slot per part        | rating / -question / -steps / -chart / -ends / -send / -result |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                     |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onRate`                   |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                  |
 * | R26  | A11y                      | a radio group with names; chart hidden, result sentence focused |
 */

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { ratingSteps, summarizeRatings } from './rating-model.js';

export const MIN_VIEWPORT = 320 as const;

interface RatingFace {
  icon: React.ReactNode;
  /** What the face means, for screen readers and the result sentence. */
  name: string;
}

interface RatingLabels {
  /** @default 'Send' */
  send?: string;
  /**
   * After sending. `mine` and `average` are step names (the number, or the
   * face's name); `before` is the earlier average, when there is one.
   * @default English: '{count} people answered. Yours: {mine}. The room's average: {average}.'
   */
  result?: (r: {
    count: string;
    mine: string;
    average: string;
    before: string | null;
    recommend: string | null;
  }) => string;
  /** While fewer than `minResponses` are in. @default (min) => `Thanks. The room shows once ${min} people have answered.` */
  pending?: (min: number) => string;
  /** The legend for the earlier round. @default 'Before' */
  before?: string;
}

type RatingProps = Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue'> & {
  question: React.ReactNode;
  /** @default 1 */
  min?: number;
  /** @default 5 */
  max?: number;
  /** Words for the two ends, as `[low, high]`. */
  ends?: readonly [string, string];
  /** Icons instead of numbers, one per step, low to high. */
  faces?: readonly RatingFace[];
  /** The room's ratings. */
  values?: readonly number[];
  /** `values` already hold this viewer's rating. @default false */
  valuesIncludeOwn?: boolean;
  /** An earlier round of the same question. */
  before?: readonly number[];
  /** The viewer's sent rating, controlled. null while choosing. */
  value?: number | null;
  /** The viewer's sent rating, uncontrolled. */
  defaultValue?: number | null;
  /** Called once, when the viewer sends. */
  onRate?: (value: number) => void;
  /** Hide the room until this many have answered. @default 1 */
  minResponses?: number;
  locale?: string;
  labels?: RatingLabels;
};

const RESULT: NonNullable<RatingLabels['result']> = ({ count, mine, average, before, recommend }) =>
  `${count} ${count === '1' ? 'person' : 'people'} answered. Yours: ${mine}. The room's average: ${average}.` +
  (before ? ` Before: ${before}.` : '') +
  (recommend ? ` Recommend score: ${recommend}.` : '');

function Rating({
  question,
  min = 1,
  max = 5,
  ends,
  faces,
  values = [],
  valuesIncludeOwn = false,
  before,
  value: valueProp,
  defaultValue = null,
  onRate,
  minResponses = 1,
  locale,
  labels,
  className,
  ...props
}: RatingProps) {
  const reduced = useReducedMotion();
  const scale = { min, max };
  const steps = ratingSteps(scale);
  const first = steps[0] ?? min;
  const [own, setOwn] = React.useState<number | null>(defaultValue);
  const sent = valueProp === undefined ? own : valueProp;
  const [draft, setDraft] = React.useState<number | null>(null);
  const [sentHere, setSentHere] = React.useState(false);
  const questionId = React.useId();
  const resultRef = React.useRef<HTMLParagraphElement>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const one = React.useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const signed = React.useMemo(() => new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' }), [locale]);

  const all = sent === null || valuesIncludeOwn ? values : [...values, sent];
  const room = summarizeRatings(all, scale);
  const earlier = before && before.length > 0 ? summarizeRatings(before, scale) : null;
  const shown = sent !== null && room.count >= minResponses;
  const nameOf = (v: number) => faces?.[v - first]?.name ?? one.format(v);
  const averageName = (mean: number) => (faces ? nameOf(Math.round(mean)) : one.format(mean));

  React.useEffect(() => {
    if (!shown || !sentHere) return;
    resultRef.current?.focus();
    if (reduced) return;
    chartRef.current?.querySelectorAll<HTMLElement>('[data-slot="rating-bar"]').forEach((bar) => {
      if (typeof bar.animate !== 'function') return;
      bar.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
        duration: 250,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });
    });
    // Once, when this viewer's rating lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, sentHere]);

  const send = () => {
    if (sent !== null || draft === null) return;
    setSentHere(true);
    if (valueProp === undefined) setOwn(draft);
    onRate?.(draft);
  };

  // Bars are shares of each round, on one scale, so two rounds of different sizes compare fairly.
  const share = (n: number, total: number) => (total > 0 ? n / total : 0);
  const top = Math.max(share(room.peak, room.count), earlier ? share(earlier.peak, earlier.count) : 0, Number.EPSILON);

  return (
    <div
      data-slot="rating"
      data-state={sent === null ? 'choosing' : 'sent'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      <p id={questionId} data-slot="rating-question" className="font-heading text-lg font-semibold text-balance">
        {question}
      </p>

      {sent === null ? (
        <RadioGroup
          data-slot="rating-steps"
          aria-labelledby={questionId}
          value={draft}
          onValueChange={(v) => setDraft(v as number)}
          className="flex gap-1.5"
        >
          {steps.map((v) => (
            <Radio.Root
              key={v}
              value={v}
              aria-label={nameOf(v)}
              data-slot="rating-step"
              className={cn(
                'bg-background text-foreground grid min-h-11 min-w-0 flex-1 place-items-center rounded-md border text-base font-semibold tabular-nums',
                'motion-safe:transition-colors motion-safe:duration-(--duration-fast) hover:bg-muted',
                'data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[checked]:border-primary',
                'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
                faces && '[&_svg]:size-6',
              )}
            >
              {faces ? faces[v - first]?.icon : one.format(v)}
            </Radio.Root>
          ))}
        </RadioGroup>
      ) : shown ? (
        <div ref={chartRef} aria-hidden data-slot="rating-chart" className="grid gap-1">
          <div className="flex h-24 items-end gap-1.5 border-b">
            {room.counts.map((n, i) => {
              const v = steps[i] as number;
              const ghost = earlier ? share(earlier.counts[i] as number, earlier.count) / top : 0;
              return (
                <div key={v} className="relative flex h-full flex-1 items-end justify-center">
                  {earlier ? (
                    <span
                      data-slot="rating-before"
                      className="border-muted-foreground/60 absolute inset-x-1 bottom-0 rounded-t-sm border border-b-0 border-dashed"
                      style={{ height: `${ghost * 100}%` }}
                    />
                  ) : null}
                  <span
                    data-slot="rating-bar"
                    data-mine={v === sent ? '' : undefined}
                    className={cn(
                      'relative block w-full origin-bottom rounded-t-sm',
                      v === sent ? 'bg-primary' : 'bg-foreground/25',
                    )}
                    style={{ height: `${(share(n, room.count) / top) * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="text-muted-foreground flex gap-1.5 text-center text-xs tabular-nums [&_svg]:mx-auto [&_svg]:size-4">
            {steps.map((v) => (
              <span key={v} className="flex-1">
                {faces ? faces[v - first]?.icon : one.format(v)}
              </span>
            ))}
          </div>
          {earlier ? (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <span className="border-muted-foreground/60 inline-block size-3 rounded-sm border border-dashed" />
              {labels?.before ?? 'Before'}
            </p>
          ) : null}
        </div>
      ) : null}

      {ends ? (
        <div data-slot="rating-ends" className="text-muted-foreground flex justify-between gap-4 text-sm">
          <span className="max-w-[45%]">{ends[0]}</span>
          <span className="max-w-[45%] text-end">{ends[1]}</span>
        </div>
      ) : null}

      {sent === null ? (
        <Button
          data-slot="rating-send"
          size="lg"
          className="justify-self-start"
          disabled={draft === null}
          onClick={send}
        >
          {labels?.send ?? 'Send'}
        </Button>
      ) : null}

      <p
        ref={resultRef}
        tabIndex={-1}
        data-slot="rating-result"
        aria-live="polite"
        className="focus-visible:outline-ring rounded-sm text-sm outline-offset-4 empty:hidden focus-visible:outline-2"
      >
        {sent === null
          ? ''
          : shown && room.mean !== null
            ? (labels?.result ?? RESULT)({
                count: one.format(room.count),
                mine: nameOf(sent),
                average: averageName(room.mean),
                before: earlier?.mean != null ? averageName(earlier.mean) : null,
                recommend: room.recommend === null ? null : signed.format(room.recommend),
              })
            : (labels?.pending ?? ((n: number) => `Thanks. The room shows once ${n} people have answered.`))(
                minResponses,
              )}
      </p>
    </div>
  );
}
Rating.displayName = 'Rating';

export { Rating };
export type { RatingProps, RatingLabels, RatingFace };
