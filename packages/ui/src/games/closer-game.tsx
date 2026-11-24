'use client';

/**
 * @interlace/ui — CloserGame
 *
 * Guess a number by sliding to it. The player sets a value on a slider (or
 * types it), locks it in, and the answer slides out from their guess to
 * where it really is, with the gap between them shaded and said in words:
 * "900 off. Close." Scoring lives in `closer-model.ts` and is exported, so a
 * server can score the same guess and a share card can draw the band
 * without the number.
 *
 * ## Anatomy
 *
 *   CloserGame                       (div — data-slot="closer-game", data-state=guessing|revealed, data-band)
 *     ├─ p                           (data-slot="closer-game-question", id ← slider + input label)
 *     ├─ output                      (data-slot="closer-game-value": the guess, formatted)
 *     ├─ div                         (data-slot="closer-game-scale")
 *     │   ├─ Slider                  (Base UI: arrows, PageUp/PageDown, Home/End, drag)
 *     │   ├─ span                    (data-slot="closer-game-gap": guess to answer, after the reveal)
 *     │   └─ span                    (data-slot="closer-game-answer": the answer's mark, after the reveal)
 *     ├─ div                         (data-slot="closer-game-ends": min and max)
 *     ├─ form                        (data-slot="closer-game-form": typed value + Lock in)
 *     ├─ p aria-live="polite"        (data-slot="closer-game-result")
 *     └─ div                         (data-slot="closer-game-explanation": opens on reveal)
 *
 * ## Controlled or not
 *
 * `guess` / `defaultGuess` hold the locked-in value (null for none yet), so
 * a page that stored today's guess restores the revealed state on reload.
 * `onGuess` fires once, with the scored result.
 *
 * ## Motion
 *
 * The answer's mark travels from the guess to the answer (400ms,
 * `--ease-move`) and the gap fills behind it. Under reduced motion both are
 * simply in place. Nothing moves before the reveal.
 *
 * ## Log scales
 *
 * `range.scale = 'log'` lays the slider out in orders of magnitude, so
 * 1,000 and 1,000,000 are both easy to reach. The slider then moves in
 * 1/1000ths of the track and the typed field takes any value.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                    |
 * | ---- | ------------------------- | ----------------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                         |
 * | R6   | data-slot per part        | closer-game / -question / -value / -scale / -gap / -answer / -ends / -form / -result / -explanation |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                     |
 * | R9   | Controlled + uncontrolled | `guess` / `defaultGuess` / `onGuess`                  |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                  |
 * | R19  | Tokens only               | primary, success, input, muted                        |
 * | R26  | A11y                      | labelled slider with value text; live result; band in words, not colour |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { Input } from '../primitives/input.js';
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from '../primitives/slider.js';
import {
  fromPosition,
  scoreGuess,
  snap,
  toPosition,
  type CloserBand,
  type CloserRange,
  type CloserResult,
  type CloserScoreOptions,
} from './closer-model.js';

export const MIN_VIEWPORT = 320 as const;

const LOG_STEPS = 1000;

interface CloserGameLabels {
  /** Names the slider and the typed field. @default 'Your guess' */
  guess?: string;
  /** The lock-in button. @default 'Lock in' */
  submit?: string;
  /** The typed field's visible label. @default 'Or type it' */
  type?: string;
  /** Band words. */
  band?: Partial<Record<CloserBand, string>>;
  /** The result sentence. Receives formatted numbers. */
  result?: (r: { guess: string; answer: string; distance: string; band: string; points: number }) => string;
  /** The answer mark's visible caption. @default 'Answer' */
  answer?: string;
}

type CloserGameProps = Omit<React.ComponentProps<'div'>, 'children' | 'onChange'> & {
  question: React.ReactNode;
  /** The answer. Keep it off the client until the reveal if the game is competitive. */
  answer: number;
  range: CloserRange;
  /** Locked-in guess, controlled. null for none yet. */
  guess?: number | null;
  /** Locked-in guess, uncontrolled. */
  defaultGuess?: number | null;
  /** Where the slider starts. @default the middle of the range */
  defaultValue?: number;
  /** Called once when the player locks in. */
  onGuess?: (result: CloserResult) => void;
  /** Shown after the reveal: what the number is and where it comes from. */
  explanation?: React.ReactNode;
  /** `Intl.NumberFormat` options for every number shown (a unit, a currency, compact notation). */
  format?: Intl.NumberFormatOptions;
  /** BCP 47 locale for numbers. */
  locale?: string;
  score?: CloserScoreOptions;
  labels?: CloserGameLabels;
};

const BAND: Record<CloserBand, string> = {
  exact: 'Spot on.',
  close: 'Close.',
  near: 'Not far.',
  far: 'Far off.',
};

const RESULT: NonNullable<CloserGameLabels['result']> = ({ guess, answer, distance, band, points }) =>
  distance === '0' || guess === answer
    ? `You said ${guess}. The answer is ${answer}. ${band} ${points} points.`
    : `You said ${guess}. The answer is ${answer}, ${distance} off. ${band} ${points} points.`;

function CloserGame({
  question,
  answer,
  range,
  guess: guessProp,
  defaultGuess = null,
  defaultValue,
  onGuess,
  explanation,
  format,
  locale,
  score,
  labels,
  className,
  ...props
}: CloserGameProps) {
  const isLog = range.scale === 'log';
  const middle = fromPosition(0.5, range);
  const [draft, setDraft] = React.useState(() => snap(defaultValue ?? middle, range));
  const [typed, setTyped] = React.useState<string | null>(null);
  const [uncontrolled, setUncontrolled] = React.useState<number | null>(defaultGuess);
  const locked = guessProp === undefined ? uncontrolled : guessProp;
  const revealed = locked !== null && locked !== undefined;
  const reduced = useReducedMotion();
  const questionId = React.useId();
  const inputId = React.useId();
  const explanationId = React.useId();
  const answerRef = React.useRef<HTMLSpanElement>(null);
  const gapRef = React.useRef<HTMLSpanElement>(null);
  const animate = React.useRef(false);
  const sentRef = React.useRef(revealed);

  const nf = React.useMemo(() => new Intl.NumberFormat(locale, format), [locale, format]);
  const result = revealed ? scoreGuess(locked, answer, range, score) : null;
  const shown = revealed ? locked : draft;
  const words = { ...BAND, ...labels?.band };

  React.useEffect(() => {
    if (!revealed) sentRef.current = false;
  }, [revealed]);

  const lockIn = (value: number) => {
    if (revealed || sentRef.current) return;
    sentRef.current = true;
    animate.current = true;
    const v = snap(value, range);
    if (guessProp === undefined) setUncontrolled(v);
    onGuess?.(scoreGuess(v, answer, range, score));
  };

  const guessPos = toPosition(shown, range) * 100;
  const answerPos = toPosition(answer, range) * 100;

  // The answer travels from the guess to where it is; the gap fills behind it.
  React.useEffect(() => {
    if (!revealed || !animate.current) return;
    animate.current = false;
    const mark = answerRef.current;
    const gap = gapRef.current;
    if (reduced || !mark || typeof mark.animate !== 'function') return;
    const rtl = getComputedStyle(mark).direction === 'rtl';
    const track = mark.parentElement?.getBoundingClientRect().width ?? 0;
    const dx = ((guessPos - answerPos) / 100) * track * (rtl ? -1 : 1);
    const timing = { duration: 400, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' };
    mark.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], timing);
    gap?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], timing);
  }, [revealed, reduced, guessPos, answerPos]);

  const setFromSlider = (v: number) => {
    setTyped(null);
    setDraft(isLog ? fromPosition(v / LOG_STEPS, range) : snap(v, range));
  };

  const commitTyped = () => {
    if (typed === null) return draft;
    const n = Number(typed);
    const v = Number.isFinite(n) && typed.trim() !== '' ? snap(n, range) : draft;
    setDraft(v);
    setTyped(null);
    return v;
  };

  const gapStart = Math.min(guessPos, answerPos);
  const gapWidth = Math.abs(guessPos - answerPos);

  return (
    <div
      data-slot="closer-game"
      data-state={revealed ? 'revealed' : 'guessing'}
      data-band={result?.band}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      <p id={questionId} data-slot="closer-game-question" className="font-heading text-lg font-semibold text-balance">
        {question}
      </p>

      <output
        data-slot="closer-game-value"
        htmlFor={inputId}
        aria-hidden
        className="font-heading text-h2 leading-none font-semibold tabular-nums"
      >
        {nf.format(shown)}
      </output>

      <div data-slot="closer-game-scale" className="relative py-3">
        <Slider
          value={isLog ? Math.round(toPosition(shown, range) * LOG_STEPS) : shown}
          min={isLog ? 0 : range.min}
          max={isLog ? LOG_STEPS : range.max}
          step={isLog ? 1 : (range.step ?? 1)}
          disabled={revealed}
          onValueChange={(v) => setFromSlider(Array.isArray(v) ? (v[0] as number) : (v as number))}
          aria-labelledby={questionId}
        >
          <SliderControl>
            <SliderTrack>
              <SliderIndicator />
            </SliderTrack>
            <SliderThumb
              getAriaLabel={() => labels?.guess ?? 'Your guess'}
              getAriaValueText={() => nf.format(revealed ? locked : draft)}
              className={cn(revealed && 'disabled:opacity-100')}
            />
          </SliderControl>
        </Slider>
        {result ? (
          <>
            <span
              ref={gapRef}
              aria-hidden
              data-slot="closer-game-gap"
              className={cn(
                'pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full',
                'bg-[repeating-linear-gradient(135deg,var(--foreground)_0_2px,transparent_2px_6px)] opacity-60',
                answerPos >= guessPos ? 'origin-left rtl:origin-right' : 'origin-right rtl:origin-left',
              )}
              // Stops short of the guess's thumb (10px each side) so the hatching never
              // runs under it.
              style={{
                insetInlineStart: `calc(${gapStart}% + ${answerPos < guessPos ? 0 : 10}px)`,
                width: `max(0px, calc(${gapWidth}% - 10px))`,
              }}
            />
            <span
              ref={answerRef}
              data-slot="closer-game-answer"
              className="pointer-events-none absolute top-1/2 grid -translate-y-1/2 justify-items-center rtl:translate-x-1/2 ltr:-translate-x-1/2"
              style={{ insetInlineStart: `${answerPos}%` }}
            >
              <span aria-hidden className="bg-success border-background block size-5 rotate-45 rounded-[3px] border-2" />
              <span className="text-success absolute top-full mt-1 text-xs font-semibold whitespace-nowrap">
                {labels?.answer ?? 'Answer'}
              </span>
            </span>
          </>
        ) : null}
      </div>

      <div
        data-slot="closer-game-ends"
        aria-hidden
        className="text-muted-foreground -mt-2 flex justify-between text-xs tabular-nums"
      >
        <span>{nf.format(range.min)}</span>
        <span>{nf.format(range.max)}</span>
      </div>

      {!revealed ? (
        <form
          data-slot="closer-game-form"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            lockIn(commitTyped());
          }}
        >
          <div className="grid min-w-0 flex-1 basis-36 gap-1.5">
            <label htmlFor={inputId} className="text-muted-foreground text-sm">
              {labels?.type ?? 'Or type it'}
            </label>
            <Input
              id={inputId}
              type="number"
              inputMode="decimal"
              min={range.min}
              max={range.max}
              step={range.step ?? 'any'}
              value={typed ?? String(draft)}
              onChange={(e) => setTyped(e.target.value)}
              onBlur={commitTyped}
            />
          </div>
          <Button type="submit" className="flex-none">
            {labels?.submit ?? 'Lock in'}
          </Button>
        </form>
      ) : null}

      <p
        data-slot="closer-game-result"
        aria-live="polite"
        aria-describedby={result && explanation ? explanationId : undefined}
        className="text-sm font-semibold empty:hidden"
      >
        {result
          ? (labels?.result ?? RESULT)({
              guess: nf.format(result.guess),
              answer: nf.format(result.answer),
              distance: nf.format(result.distance),
              band: words[result.band],
              points: result.points,
            })
          : ''}
      </p>

      {explanation ? (
        <div
          data-slot="closer-game-explanation"
          className={cn(
            'grid',
            'motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-enter',
            revealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
          inert={revealed ? undefined : true}
        >
          <div id={explanationId} className="text-muted-foreground -m-1 min-h-0 overflow-hidden p-1 text-sm leading-relaxed">
            {explanation}
          </div>
        </div>
      ) : null}
    </div>
  );
}
CloserGame.displayName = 'CloserGame';

export { CloserGame };
export type { CloserGameProps, CloserGameLabels };
