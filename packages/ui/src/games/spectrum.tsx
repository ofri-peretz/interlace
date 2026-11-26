'use client';

/**
 * @interlace/ui — Spectrum
 *
 * Where do you stand? A statement, two poles, and a line between them.
 * Each person places one dot, then sees the whole room spread along the
 * same line, their own bin marked, the room's middle drawn, and, when the
 * statement was asked before, where the middle was then. It shows a room as
 * it is: rarely two camps, usually a spread.
 *
 * ## Anatomy
 *
 *   Spectrum                          (div — data-slot="spectrum", data-state=placing|placed)
 *     ├─ p                            (data-slot="spectrum-statement")
 *     ├─ Slider (placing)             (Base UI: arrows, Page keys, Home/End, drag; value in words)
 *     ├─ div aria-hidden (placed)     (data-slot="spectrum-chart": bins as bars, the middle, before)
 *     ├─ div                          (data-slot="spectrum-poles": the two pole labels under the line)
 *     ├─ Button (placing)             (data-slot="spectrum-place")
 *     └─ p tabIndex=-1 aria-live     (data-slot="spectrum-result": the picture in one sentence)
 *
 * ## Data
 *
 * Values run 0 (the first pole) to 100 (the second). `values` are the
 * room's dots from your store, without this viewer's own unless
 * `valuesIncludeOwn`. `before` draws an earlier round of the same
 * statement as a dashed marker. `minResponses` keeps the picture hidden
 * until enough people have placed a dot, so nobody's answer is guessable.
 *
 * ## Motion
 *
 * On placing, the bars grow up from the line together (400ms, transform)
 * and the middle marker slides from the viewer's dot to the room's (400ms,
 * `--ease-move`): the viewer sees where they are, then where the room is.
 * Under reduced motion the picture is simply there.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                  |
 * | ---- | ------------------------- | --------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                         |
 * | R6   | data-slot per part        | spectrum / -statement / -chart / -poles / -place / -result |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                   |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onPlace`                |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                |
 * | R26  | A11y                      | slider with words for its value; chart hidden, result sentence focused |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from '../primitives/slider.js';
import { binOf, summarizeSpectrum } from './spectrum-model.js';

export const MIN_VIEWPORT = 320 as const;

interface SpectrumLabels {
  /** @default 'Place my dot' */
  place?: string;
  /** The slider's value in words. @default by position: 'Closer to {start}', 'In the middle', 'Closer to {end}' */
  position?: (value: number, start: string, end: string) => string;
  /**
   * After placing. `mine` and `middle` are `position` words; `shift` is the
   * signed move of the middle since `before`, on the 0 to 100 line.
   * @default ({ mine, middle, count }) => `${count} people placed a dot. Yours: ${mine}. The room's middle: ${middle}.`
   */
  result?: (r: { mine: string; middle: string; count: string; shift: string | null }) => string;
  /** While fewer than `minResponses` are in. @default (min) => `Thanks. The room shows once ${min} people have placed a dot.` */
  pending?: (min: number) => string;
  /** The marker for the room's middle. @default 'Room' */
  middle?: string;
  /** The marker for the earlier round. @default 'Before' */
  before?: string;
}

type SpectrumProps = Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue'> & {
  statement: React.ReactNode;
  /** The two ends of the line, as plain words. */
  poles: readonly [string, string];
  /** The room's dots, 0 to 100. */
  values?: readonly number[];
  /** `values` already hold this viewer's dot. @default false */
  valuesIncludeOwn?: boolean;
  /** An earlier round of the same statement, drawn as a dashed marker. */
  before?: readonly number[];
  /** The viewer's placed dot, controlled. null while placing. */
  value?: number | null;
  /** The viewer's placed dot, uncontrolled. */
  defaultValue?: number | null;
  /** Called once, when the viewer places their dot. */
  onPlace?: (value: number) => void;
  /** Hide the room until this many dots are in. @default 1 */
  minResponses?: number;
  /** Bars along the line. @default 10 */
  bins?: number;
  locale?: string;
  labels?: SpectrumLabels;
};

const POSITION: NonNullable<SpectrumLabels['position']> = (v, start, end) =>
  v < 40 ? `Closer to ${start}` : v > 60 ? `Closer to ${end}` : 'In the middle';
const RESULT: NonNullable<SpectrumLabels['result']> = ({ mine, middle, count, shift }) =>
  `${count} ${count === '1' ? 'person' : 'people'} placed a dot. Yours: ${mine}. The room's middle: ${middle}.${shift ? ` It moved ${shift} points since before.` : ''}`;
const PENDING: NonNullable<SpectrumLabels['pending']> = (min) =>
  `Thanks. The room shows once ${min} people have placed a dot.`;

function Spectrum({
  statement,
  poles,
  values = [],
  valuesIncludeOwn = false,
  before,
  value: valueProp,
  defaultValue = null,
  onPlace,
  minResponses = 1,
  bins = 10,
  locale,
  labels,
  className,
  ...props
}: SpectrumProps) {
  const reduced = useReducedMotion();
  const [own, setOwn] = React.useState<number | null>(defaultValue);
  const placed = valueProp === undefined ? own : valueProp;
  const [draft, setDraft] = React.useState(50);
  const [placedHere, setPlacedHere] = React.useState(false);
  const statementId = React.useId();
  const resultRef = React.useRef<HTMLParagraphElement>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const nf = React.useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const signed = React.useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0, signDisplay: 'exceptZero' }),
    [locale],
  );

  const all = placed === null || valuesIncludeOwn ? values : [...values, placed];
  const room = summarizeSpectrum(all, { bins });
  const earlier = before && before.length > 0 ? summarizeSpectrum(before, { bins }) : null;
  const shown = placed !== null && room.count >= minResponses;
  const mineBin = placed === null ? -1 : binOf(placed, { bins });

  React.useEffect(() => {
    if (!shown || !placedHere) return;
    resultRef.current?.focus();
    if (reduced) return;
    const chart = chartRef.current;
    chart?.querySelectorAll<HTMLElement>('[data-slot="spectrum-bar"]').forEach((bar) => {
      if (typeof bar.animate !== 'function') return;
      bar.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
        duration: 400,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });
    });
    const marker = chart?.querySelector<HTMLElement>('[data-slot="spectrum-middle"]');
    if (marker && typeof marker.animate === 'function' && placed !== null && room.median !== null) {
      const width = chart?.getBoundingClientRect().width ?? 0;
      const from = ((placed - room.median) / 100) * width;
      marker.animate([{ transform: `translateX(${from}px)` }, { transform: 'translateX(0)' }], {
        duration: 400,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      });
    }
    // Once, when this viewer's dot lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, placedHere]);

  const place = () => {
    if (placed !== null) return;
    setPlacedHere(true);
    if (valueProp === undefined) setOwn(draft);
    onPlace?.(draft);
  };

  const shift =
    earlier && earlier.median !== null && room.median !== null ? signed.format(room.median - earlier.median) : null;

  return (
    <div
      data-slot="spectrum"
      data-state={placed === null ? 'placing' : 'placed'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      <p id={statementId} data-slot="spectrum-statement" className="font-heading text-lg font-semibold text-balance">
        {statement}
      </p>

      {placed === null ? (
        <div className="py-3">
          <Slider
            value={draft}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => setDraft(Array.isArray(v) ? (v[0] as number) : (v as number))}
            aria-labelledby={statementId}
          >
            <SliderControl>
              <SliderTrack>
                <SliderIndicator className="bg-transparent" />
              </SliderTrack>
              <SliderThumb
                getAriaLabel={() => `${poles[0]} to ${poles[1]}`}
                getAriaValueText={() => (labels?.position ?? POSITION)(draft, poles[0], poles[1])}
              />
            </SliderControl>
          </Slider>
        </div>
      ) : shown ? (
        <div ref={chartRef} aria-hidden data-slot="spectrum-chart" className="relative h-28 pt-5">
          <div className="flex h-full items-end gap-1 border-b">
            {room.bins.map((n, i) => (
              <span
                // Bins are fixed positions on the line: the index is their identity.
                key={`bin-${i}`}
                data-slot="spectrum-bar"
                data-mine={i === mineBin ? '' : undefined}
                className={cn(
                  'block flex-1 origin-bottom rounded-t-sm',
                  i === mineBin ? 'bg-primary' : 'bg-foreground/25',
                )}
                style={{ height: room.peak > 0 ? `${(n / room.peak) * 100}%` : '0%' }}
              />
            ))}
          </div>
          {earlier?.median != null ? (
            <span
              data-slot="spectrum-before"
              className="text-muted-foreground absolute top-0 bottom-0 flex -translate-x-1/2 flex-col items-center rtl:translate-x-1/2"
              style={{ insetInlineStart: `${earlier.median}%` }}
            >
              <span className="text-xs leading-none whitespace-nowrap">{labels?.before ?? 'Before'}</span>
              <span className="mt-1 w-0 flex-1 border-s border-dashed border-current" />
            </span>
          ) : null}
          {room.median !== null ? (
            <span
              data-slot="spectrum-middle"
              className="text-foreground absolute top-0 bottom-0 flex -translate-x-1/2 flex-col items-center rtl:translate-x-1/2"
              style={{ insetInlineStart: `${room.median}%` }}
            >
              <span className="text-xs leading-none font-semibold whitespace-nowrap">{labels?.middle ?? 'Room'}</span>
              <span className="mt-1 w-0.5 flex-1 rounded-full bg-current" />
            </span>
          ) : null}
        </div>
      ) : null}

      <div data-slot="spectrum-poles" className="text-muted-foreground flex justify-between gap-4 text-sm">
        <span className="max-w-[45%]">{poles[0]}</span>
        <span className="max-w-[45%] text-end">{poles[1]}</span>
      </div>

      {placed === null ? (
        <Button data-slot="spectrum-place" size="lg" className="justify-self-start" onClick={place}>
          {labels?.place ?? 'Place my dot'}
        </Button>
      ) : null}

      <p
        ref={resultRef}
        tabIndex={-1}
        data-slot="spectrum-result"
        aria-live="polite"
        className="focus-visible:outline-ring rounded-sm text-sm outline-offset-4 empty:hidden focus-visible:outline-2"
      >
        {placed === null
          ? ''
          : shown && room.median !== null
            ? (labels?.result ?? RESULT)({
                mine: (labels?.position ?? POSITION)(placed, poles[0], poles[1]),
                middle: (labels?.position ?? POSITION)(room.median, poles[0], poles[1]),
                count: nf.format(room.count),
                shift,
              })
            : (labels?.pending ?? PENDING)(minResponses)}
      </p>
    </div>
  );
}
Spectrum.displayName = 'Spectrum';

export { Spectrum };
export type { SpectrumProps, SpectrumLabels };
