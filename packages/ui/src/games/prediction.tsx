'use client';

/**
 * @interlace/ui — Prediction
 *
 * "Who will win?" on a phone: the room calls an outcome before it happens,
 * locks it in, and waits. Nobody sees how the room called it until the
 * host settles it, so a call is the person's own read. Then the room's
 * spread appears with the outcome marked, and the viewer learns whether
 * they called it, with the points `predictionPoints` gives (a rare right
 * call can pay more, with `reward="bold"`).
 *
 * ## Anatomy
 *
 *   Prediction                     (div — data-slot="prediction", data-state=choosing|locked|closed|settled)
 *     ├─ p                         (data-slot="prediction-question": names the choices)
 *     ├─ RadioGroup                (data-slot="prediction-options": while choosing)
 *     │   └─ Radio × n             (data-slot="prediction-option")
 *     ├─ Button                    (data-slot="prediction-lock": "Lock it in")
 *     ├─ p tabIndex=-1 aria-live   (data-slot="prediction-result": locked, closed, called it or not)
 *     └─ TallyBars                 (data-slot="prediction-spread": once settled, outcome marked)
 *
 * ## Motion
 *
 * Locking in presses the chosen option once (150ms). When the outcome
 * arrives the result rises into place (200ms, `ease-enter`) and the spread's
 * bars grow; a right call lifts a little further, so a win feels like one.
 * An outcome already set on mount (a reload) is drawn in place and takes
 * no focus. Under reduced motion everything is simply there.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                          |
 * | R6   | data-slot per part        | prediction / -question / -options / -option / -lock / -result / -spread |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans       | `reward`                                             |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onLock`                  |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | a named radio group; outcome in words; result focused when it was ours to move |
 */

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { predictionPoints, type PredictionReward } from './prediction-model.js';
import { TallyBars, type TallyBarsLabels } from './tally-bars.js';
import { tally } from './tally-model.js';

export const MIN_VIEWPORT = 320 as const;

interface PredictionChoice {
  id: string;
  label: string;
}

interface PredictionLabels {
  /** @default 'Lock it in' */
  lock?: string;
  /** After locking in. @default (pick) => `Locked in: ${pick}. Waiting for the result.` */
  locked?: (pick: string) => string;
  /** Calls are closed and this viewer made none. @default 'Calls are closed.' */
  closed?: string;
  /** A right call. @default (points) => `You called it. +${points} points.` */
  called?: (points: string, outcome: string) => string;
  /** A wrong call. @default (outcome) => `Not this time. It was ${outcome}.` */
  missed?: (outcome: string, pick: string) => string;
  /** The outcome, for a viewer who made no call. @default (outcome) => `It was ${outcome}.` */
  outcome?: (outcome: string) => string;
  /** Names the room's spread. @default 'How the room called it' */
  spread?: string;
  tally?: TallyBarsLabels;
}

type PredictionProps = Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue'> & {
  question: React.ReactNode;
  options: readonly PredictionChoice[];
  /** The viewer's locked call, controlled. null while choosing. */
  value?: string | null;
  /** The viewer's locked call, uncontrolled. */
  defaultValue?: string | null;
  /** Called once, when the viewer locks in. */
  onLock?: (id: string) => void;
  /** No more calls; the viewer can no longer lock in. */
  closed?: boolean;
  /** The outcome, once the host settles it. Settling also closes calls. */
  outcome?: string | null;
  /** The room's calls per option id, shown once settled. */
  counts?: Readonly<Record<string, number>>;
  /** `counts` already hold this viewer's call. @default false */
  countsIncludeOwn?: boolean;
  /** Points for a right call. @default 500 */
  points?: number;
  /** `bold` pays a call few people made more. @default 'flat' */
  reward?: PredictionReward;
  locale?: string;
  labels?: PredictionLabels;
};

function Prediction({
  question,
  options,
  value: valueProp,
  defaultValue = null,
  onLock,
  closed = false,
  outcome = null,
  counts,
  countsIncludeOwn = false,
  points = 500,
  reward = 'flat',
  locale,
  labels,
  className,
  ...props
}: PredictionProps) {
  const reduced = useReducedMotion();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const ids = options.map((o) => o.id);
  const nameOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;
  const [own, setOwn] = React.useState<string | null>(defaultValue);
  const raw = valueProp === undefined ? own : valueProp;
  const locked = raw !== null && ids.includes(raw) ? raw : null;
  const [draft, setDraft] = React.useState<string | null>(null);
  const settled = outcome !== null && ids.includes(outcome) ? outcome : null;
  const state = settled !== null ? 'settled' : locked !== null ? 'locked' : closed ? 'closed' : 'choosing';
  const questionId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const resultRef = React.useRef<HTMLParagraphElement>(null);

  const room = tally(ids, counts, { vote: locked, countsIncludeVote: countsIncludeOwn });
  const outcomeRow = room.rows.find((r) => r.id === settled);
  const right = settled !== null && locked === settled;
  const award = predictionPoints(outcomeRow?.share ?? 1, { points, reward });

  // When the outcome lands: rise into place, and focus the sentence if focus was ours to move.
  // An outcome already there on mount (a reload) is shown as it is: no motion, no focus move.
  const shownOutcome = React.useRef(settled);
  React.useEffect(() => {
    if (settled === shownOutcome.current) return;
    shownOutcome.current = settled;
    if (settled === null) return;
    const root = rootRef.current;
    const active = document.activeElement;
    if (!active || active === document.body || root?.contains(active)) resultRef.current?.focus();
    const el = resultRef.current;
    if (reduced || !el || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: `translateY(${right ? 12 : 8}px)`, opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
    // Once per outcome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  const lock = () => {
    if (locked !== null || draft === null || closed || settled !== null) return;
    const chosen = rootRef.current?.querySelector<HTMLElement>(`[data-slot="prediction-option"][data-checked]`);
    if (!reduced && chosen && typeof chosen.animate === 'function') {
      chosen.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], {
        duration: 150,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      });
    }
    if (valueProp === undefined) setOwn(draft);
    onLock?.(draft);
  };

  const result =
    state === 'settled'
      ? right
        ? (labels?.called ?? ((p: string) => `You called it. +${p} points.`))(
            nf.format(award),
            nameOf(settled as string),
          )
        : locked !== null
          ? (labels?.missed ?? ((o: string) => `Not this time. It was ${o}.`))(
              nameOf(settled as string),
              nameOf(locked),
            )
          : (labels?.outcome ?? ((o: string) => `It was ${o}.`))(nameOf(settled as string))
      : state === 'locked'
        ? (labels?.locked ?? ((p: string) => `Locked in: ${p}. Waiting for the result.`))(nameOf(locked as string))
        : state === 'closed'
          ? (labels?.closed ?? 'Calls are closed.')
          : '';

  const optionLabels = Object.fromEntries(options.map((o) => [o.id, o.label]));

  return (
    <div
      ref={rootRef}
      data-slot="prediction"
      data-state={state}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4', className)}
      {...props}
    >
      <p id={questionId} data-slot="prediction-question" className="font-heading text-lg font-semibold text-balance">
        {question}
      </p>

      {state === 'choosing' ? (
        <>
          <RadioGroup
            data-slot="prediction-options"
            aria-labelledby={questionId}
            value={draft}
            onValueChange={(v) => setDraft(v as string)}
            className="grid gap-2"
          >
            {options.map((o) => (
              <Radio.Root
                key={o.id}
                value={o.id}
                data-slot="prediction-option"
                className={cn(
                  'bg-background text-foreground group flex min-h-12 items-center gap-3 rounded-lg border px-4 py-3 text-start text-base font-medium',
                  'motion-safe:transition-colors motion-safe:duration-(--duration-fast) hover:bg-muted',
                  'data-[checked]:border-primary data-[checked]:bg-primary/10',
                  'focus-visible:outline-ring outline-offset-2 focus-visible:outline-2',
                )}
              >
                <span
                  aria-hidden
                  className="border-input grid size-5 shrink-0 place-items-center rounded-full border-2 group-data-[checked]:border-primary"
                >
                  <Radio.Indicator className="bg-primary size-2.5 rounded-full" />
                </span>
                <span className="min-w-0">{o.label}</span>
              </Radio.Root>
            ))}
          </RadioGroup>
          <Button
            data-slot="prediction-lock"
            size="lg"
            className="justify-self-start"
            disabled={draft === null}
            onClick={lock}
          >
            {labels?.lock ?? 'Lock it in'}
          </Button>
        </>
      ) : null}

      <p
        ref={resultRef}
        tabIndex={-1}
        data-slot="prediction-result"
        data-right={right ? '' : undefined}
        aria-live="polite"
        className={cn(
          'focus-visible:outline-ring rounded-sm outline-offset-4 empty:hidden focus-visible:outline-2',
          state === 'settled' ? 'text-base font-semibold' : 'text-muted-foreground text-sm',
          right && 'text-primary',
        )}
      >
        {result}
      </p>

      {state === 'settled' ? (
        <section
          data-slot="prediction-spread"
          aria-label={labels?.spread ?? 'How the room called it'}
          className="grid gap-2"
        >
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {labels?.spread ?? 'How the room called it'}
          </p>
          <TallyBars
            rows={room.rows}
            optionLabels={optionLabels}
            marks={{ [settled as string]: 'correct' }}
            animate={!reduced}
            locale={locale}
            labels={{ correct: 'Outcome', ...labels?.tally }}
          />
        </section>
      ) : null}
    </div>
  );
}
Prediction.displayName = 'Prediction';

export { Prediction };
export type { PredictionProps, PredictionLabels, PredictionChoice };
