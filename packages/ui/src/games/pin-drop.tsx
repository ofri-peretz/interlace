'use client';

/**
 * @interlace/ui — PinDrop and PinMap
 *
 * A pin on a picture (a map, a floor plan, a diagram). On a phone,
 * `PinDrop` lets each person place one pin by tap, drag or arrow keys. With
 * an `answer` it is "Where is it?": once the host reveals, the answer
 * appears, a line joins it to the viewer's pin, and the points say how
 * close it was. Without one it is "Where are you?" and the room's pins are
 * the result. `PinMap` is the shared screen: every pin, and the answer
 * once revealed.
 *
 * A pin is said in words: the named `regions` of the picture when given
 * ("In the harbour"), otherwise how far across and down it sits, so a
 * screen reader user places and hears the same pin. Pictures do not mirror
 * for right-to-left readers, so the pin and its arrow keys do not either.
 *
 * ## Anatomy
 *
 *   PinDrop                        (div — data-slot="pin-drop", data-state=placing|placed|revealed)
 *     ├─ p                         (data-slot="pin-drop-prompt")
 *     ├─ div role="group"          (data-slot="pin-drop-pad": the picture; tap or drag to move the pin)
 *     │   └─ button                (data-slot="pin-drop-pin": named by its place, moved by arrow keys)
 *     ├─ div                       (data-slot="pin-drop-field": after placing; pins, answer, line)
 *     ├─ p aria-hidden             (data-slot="pin-drop-legend": you, the answer, the room)
 *     ├─ Button                    (data-slot="pin-drop-place")
 *     ├─ span sr-only aria-live    (data-slot="pin-drop-announce": the pin's place as it moves)
 *     └─ p tabIndex=-1 aria-live   (data-slot="pin-drop-result")
 *
 *   PinMap                         (figure — data-slot="pin-map")
 *     ├─ div                       (data-slot="pin-drop-field")
 *     └─ figcaption                (data-slot="pin-map-summary": "24 pins. 5 on the spot.")
 *
 * ## Motion
 *
 * A placed pin settles with a short drop (200ms, `ease-enter`). On the
 * reveal the answer scales in and the line to it fades in after (250ms),
 * so the eye goes from the answer to the gap. The room's pins fade in
 * together. Under reduced motion everything is simply there.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `div` / `figure` props                               |
 * | R6   | data-slot per part        | pin-drop / -prompt / -pad / -pin / -field / -place / -announce / -result; pin-map / -summary |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans       | `size`                                               |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onPlace`                 |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | pin named in words and moved by keys; result focused; field hidden, summary in text |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import {
  cleanPins,
  nudgePin,
  pinDistance,
  pinPoints,
  pinSpread,
  regionOf,
  type PinPoint,
  type PinRegion,
  type PinScoring,
} from './pin-drop-model.js';

export const MIN_VIEWPORT = 320 as const;

interface PinDropLabels {
  /** @default 'Place my pin' */
  place?: string;
  /** A pin in words. @default region ? `In ${region}` : `${x}% across, ${y}% down` */
  position?: (p: PinPoint, region: string | null) => string;
  /** @default 'Tap the picture or use the arrow keys to move your pin.' */
  hint?: string;
  /** Placed, with no answer. @default (where, n) => `Placed: ${where}. ${n} pins so far.` */
  placed?: (where: string, count: number, formatted: string) => string;
  /** Placed, waiting for the reveal. @default 'Placed. Waiting for the answer.' */
  waiting?: string;
  /** On the reveal. `answer` is the answer's place in words. @default English: 'It was in {region}. You were on the spot. +{points} points.' */
  revealed?: (r: {
    answer: string;
    region: string | null;
    distance: number;
    onSpot: boolean;
    points: string;
  }) => string;
  /** The screen's summary. @default (n, onSpot) => `${n} pins.` + (onSpot === null ? '' : ` ${onSpot} on the spot.`) */
  summary?: (count: string, onSpot: string | null) => string;
  /** Names the answer marker. @default 'The answer' */
  answer?: string;
  /** The legend for the viewer's pin. @default 'You' */
  you?: string;
  /** The legend for everyone else's pins. @default 'The room' */
  room?: string;
}

const POSITION: NonNullable<PinDropLabels['position']> = (p, region) =>
  region ? `In ${region}` : `${Math.round(p.x)}% across, ${Math.round(p.y)}% down`;

const REVEALED: NonNullable<PinDropLabels['revealed']> = ({ answer, region, distance, onSpot, points }) =>
  (region ? `It was in ${region}. ` : `It was at ${answer}. `) +
  (onSpot ? 'You were on the spot.' : `You were ${Math.round(distance)}% of the picture away.`) +
  ` +${points} points.`;

const SUMMARY: NonNullable<PinDropLabels['summary']> = (count, onSpot) =>
  `${count} ${count === '1' ? 'pin' : 'pins'}.` + (onSpot === null ? '' : ` ${onSpot} on the spot.`);

const at = (p: PinPoint): React.CSSProperties => ({ left: `${p.x}%`, top: `${p.y}%` });
const MARK = 'absolute -translate-x-1/2 -translate-y-1/2';

// --- The picture with pins (shared by the phone, after placing, and the screen) -----

interface FieldProps {
  src: string;
  aspect: number;
  pins: readonly PinPoint[];
  mine?: PinPoint | null;
  answer?: PinPoint | null;
  arrive: boolean;
  stage?: boolean;
  answerLabel: string;
}

function PinField({ src, aspect, pins, mine, answer, arrive, stage, answerLabel }: FieldProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const shownAnswer = React.useRef(answer ?? null);

  // The room's pins fade in together when they first appear: on arrival, or on the reveal.
  const hasPins = pins.length > 0;
  React.useEffect(() => {
    const root = ref.current;
    if (!arrive || !hasPins || !root) return;
    root.querySelectorAll<HTMLElement>('[data-slot="pin-drop-room"]').forEach((el) => {
      if (typeof el.animate === 'function') el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
    });
    // When pins first appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPins]);

  React.useEffect(() => {
    const first = shownAnswer.current;
    shownAnswer.current = answer ?? null;
    const root = ref.current;
    if (!arrive || !answer || first || !root) return;
    const mark = root.querySelector<HTMLElement>('[data-slot="pin-drop-answer"]');
    const line = root.querySelector<SVGElement>('[data-slot="pin-drop-gap"]');
    if (mark && typeof mark.animate === 'function') {
      mark.animate([{ transform: 'translate(-50%, -50%) scale(0)' }, { transform: 'translate(-50%, -50%) scale(1)' }], {
        duration: 200,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });
    }
    if (line && typeof line.animate === 'function') {
      line.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' });
    }
  }, [answer, arrive]);

  return (
    <div
      ref={ref}
      aria-hidden
      data-slot="pin-drop-field"
      className="bg-muted relative w-full overflow-hidden rounded-lg border"
      style={{ aspectRatio: String(aspect) }}
    >
      <img src={src} alt="" draggable={false} className="absolute inset-0 size-full object-cover select-none" />
      {pins.map((p, i) => (
        <span
          // Pins have no identity beyond their place in the list.
          key={`pin-${i}`}
          data-slot="pin-drop-room"
          className={cn(MARK, 'bg-background ring-foreground/70 rounded-full ring-1', stage ? 'size-3' : 'size-2')}
          style={at(p)}
        />
      ))}
      {mine && answer ? (
        <svg
          data-slot="pin-drop-gap"
          className="absolute inset-0 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <line
            x1={mine.x}
            y1={mine.y}
            x2={answer.x}
            y2={answer.y}
            className="stroke-foreground"
            strokeWidth={2}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
      {mine ? (
        <span
          data-slot="pin-drop-mine"
          className={cn(MARK, 'bg-primary ring-background size-5 rounded-full shadow-sm ring-2')}
          style={at(mine)}
        />
      ) : null}
      {answer ? (
        <span
          data-slot="pin-drop-answer"
          title={answerLabel}
          className={cn(
            MARK,
            'bg-success ring-background grid place-items-center rounded-full shadow-sm ring-2',
            stage ? 'size-9' : 'size-7',
          )}
          style={at(answer)}
        >
          <span className="bg-background size-2.5 rounded-full" />
        </span>
      ) : null}
    </div>
  );
}

// --- PinDrop (phone) -----------------------------------------------------------------

type PinDropProps = Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue'> & {
  prompt: React.ReactNode;
  /** The picture. */
  src: string;
  /** The picture in words. It must not give the answer away. */
  alt: string;
  /** The picture's width / height. @default 4 / 3 */
  aspect?: number;
  /** Named parts of the picture, so a pin is said in words. */
  regions?: readonly PinRegion[];
  /** Everyone's pins, shown once the viewer has placed. */
  pins?: readonly PinPoint[];
  /** `pins` already hold this viewer's pin. @default false */
  pinsIncludeOwn?: boolean;
  /** Where it really is, for "Where is it?". Shown only once `revealed`. */
  answer?: PinPoint | null;
  revealed?: boolean;
  /** How close pays what. */
  scoring?: PinScoring;
  /** The viewer's placed pin, controlled. null while placing. */
  value?: PinPoint | null;
  /** The viewer's placed pin, uncontrolled. */
  defaultValue?: PinPoint | null;
  /** Called once, when the viewer places. */
  onPlace?: (pin: PinPoint) => void;
  /** How far an arrow key moves the pin. Shift moves by 1. @default 5 */
  step?: number;
  locale?: string;
  labels?: PinDropLabels;
};

function PinDrop({
  prompt,
  src,
  alt,
  aspect = 4 / 3,
  regions,
  pins = [],
  pinsIncludeOwn = false,
  answer = null,
  revealed = false,
  scoring,
  value: valueProp,
  defaultValue = null,
  onPlace,
  step = 5,
  locale,
  labels,
  className,
  ...props
}: PinDropProps) {
  const reduced = useReducedMotion();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [own, setOwn] = React.useState<PinPoint | null>(defaultValue);
  const placedRaw = valueProp === undefined ? own : valueProp;
  const placed = placedRaw && cleanPins([placedRaw])[0] ? (cleanPins([placedRaw])[0] as PinPoint) : null;
  const [draft, setDraft] = React.useState<PinPoint>({ x: 50, y: 50 });
  const [placedHere, setPlacedHere] = React.useState(false);
  const [announce, setAnnounce] = React.useState('');
  const promptId = React.useId();
  const hintId = React.useId();
  const padRef = React.useRef<HTMLDivElement>(null);
  const pinRef = React.useRef<HTMLButtonElement>(null);
  const resultRef = React.useRef<HTMLParagraphElement>(null);
  const dragging = React.useRef(false);
  const k = Number.isFinite(aspect) && aspect > 0 ? aspect : 4 / 3;

  const target = revealed && answer ? (cleanPins([answer])[0] ?? null) : null;
  const state = placed === null ? 'placing' : target ? 'revealed' : 'placed';
  const room = cleanPins(placed && !pinsIncludeOwn ? [...pins, placed] : pins);
  const words = (p: PinPoint) => (labels?.position ?? POSITION)(p, regionOf(p, regions)?.label ?? null);
  const shownState = React.useRef(state);

  // Focus the sentence when it changes because of this viewer, or a reveal they are waiting on.
  React.useEffect(() => {
    const before = shownState.current;
    shownState.current = state;
    if (before === state || state === 'placing') return;
    if (state === 'placed' && !placedHere) return;
    const active = document.activeElement;
    const root = resultRef.current?.parentElement;
    if (!active || active === document.body || root?.contains(active)) resultRef.current?.focus();
  }, [state, placedHere]);

  // A placed pin settles with a short drop.
  React.useEffect(() => {
    if (!placedHere || reduced) return;
    const mine = resultRef.current?.parentElement?.querySelector<HTMLElement>('[data-slot="pin-drop-mine"]');
    if (mine && typeof mine.animate === 'function') {
      mine.animate(
        [
          { transform: 'translate(-50%, calc(-50% - 12px))', opacity: 0 },
          { transform: 'translate(-50%, -50%)', opacity: 1 },
        ],
        { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
  }, [placedHere, reduced]);

  const move = (next: PinPoint) => {
    setDraft(next);
    const said = words(next);
    setAnnounce((prev) => (prev === said ? prev : said));
  };

  const fromPointer = (e: React.PointerEvent) => {
    const pad = padRef.current;
    if (!pad) return;
    const box = pad.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    const x = Math.round(((e.clientX - box.left) / box.width) * 100);
    const y = Math.round(((e.clientY - box.top) / box.height) * 100);
    move({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  const place = () => {
    if (placed !== null) return;
    setPlacedHere(true);
    if (valueProp === undefined) setOwn(draft);
    onPlace?.(draft);
  };

  let result = '';
  if (state === 'revealed' && placed && target) {
    const distance = pinDistance(placed, target, k);
    const exact = scoring?.exact ?? 3;
    result = (labels?.revealed ?? REVEALED)({
      answer: words(target),
      region: regionOf(target, regions)?.label ?? null,
      distance,
      onSpot: distance <= exact,
      points: nf.format(pinPoints(distance, scoring)),
    });
  } else if (state === 'placed' && placed) {
    result = answer
      ? (labels?.waiting ?? 'Placed. Waiting for the answer.')
      : (
          labels?.placed ??
          ((w: string, n: number, f: string) => `Placed: ${w}. ${f} ${n === 1 ? 'pin' : 'pins'} so far.`)
        )(words(placed), room.length, nf.format(room.length));
  }

  return (
    <div
      data-slot="pin-drop"
      data-state={state}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid max-w-144 gap-4', className)}
      {...props}
    >
      <p id={promptId} data-slot="pin-drop-prompt" className="font-heading text-lg font-semibold text-balance">
        {prompt}
      </p>

      {placed === null ? (
        <div
          ref={padRef}
          role="group"
          aria-labelledby={promptId}
          data-slot="pin-drop-pad"
          className="bg-muted relative w-full cursor-crosshair touch-none overflow-hidden rounded-lg border select-none"
          style={{ aspectRatio: String(k) }}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            fromPointer(e);
            pinRef.current?.focus({ preventScroll: true });
          }}
          onPointerMove={(e) => {
            if (dragging.current) fromPointer(e);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          <img src={src} alt={alt} draggable={false} className="absolute inset-0 size-full object-cover select-none" />
          <button
            ref={pinRef}
            type="button"
            data-slot="pin-drop-pin"
            aria-label={words(draft)}
            aria-describedby={hintId}
            onKeyDown={(e) => {
              const next = nudgePin(draft, e.key, e.shiftKey ? 1 : step);
              if (!next) return;
              e.preventDefault();
              move(next);
            }}
            className={cn(
              MARK,
              'bg-primary ring-background focus-visible:outline-ring size-6 rounded-full shadow-md ring-2 outline-offset-2 focus-visible:outline-2',
            )}
            style={at(draft)}
          />
          <span id={hintId} className="sr-only">
            {labels?.hint ?? 'Tap the picture or use the arrow keys to move your pin.'}
          </span>
        </div>
      ) : (
        <PinField
          src={src}
          aspect={k}
          pins={answer ? (target ? room : []) : room}
          mine={placed}
          answer={target}
          arrive={!reduced}
          answerLabel={labels?.answer ?? 'The answer'}
        />
      )}

      {placed !== null ? (
        <p
          aria-hidden
          data-slot="pin-drop-legend"
          className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
        >
          <span className="flex items-center gap-1.5">
            <span className="bg-primary size-3 rounded-full" />
            {labels?.you ?? 'You'}
          </span>
          {target ? (
            <span className="flex items-center gap-1.5">
              <span className="bg-success grid size-3 place-items-center rounded-full">
                <span className="bg-background size-1 rounded-full" />
              </span>
              {labels?.answer ?? 'The answer'}
            </span>
          ) : null}
          {target || !answer ? (
            <span className="flex items-center gap-1.5">
              <span className="bg-background ring-foreground/70 size-2 rounded-full ring-1" />
              {labels?.room ?? 'The room'}
            </span>
          ) : null}
        </p>
      ) : null}

      {placed === null ? (
        <Button data-slot="pin-drop-place" size="lg" className="justify-self-start" onClick={place}>
          {labels?.place ?? 'Place my pin'}
        </Button>
      ) : null}

      <span data-slot="pin-drop-announce" aria-live="polite" className="sr-only">
        {placed === null ? announce : ''}
      </span>
      <p
        ref={resultRef}
        tabIndex={-1}
        data-slot="pin-drop-result"
        aria-live="polite"
        className={cn(
          'focus-visible:outline-ring rounded-sm outline-offset-4 empty:hidden focus-visible:outline-2',
          state === 'revealed' ? 'text-base font-semibold' : 'text-sm',
        )}
      >
        {result}
      </p>
    </div>
  );
}
PinDrop.displayName = 'PinDrop';

// --- PinMap (screen) ---------------------------------------------------------------

type PinMapProps = Omit<React.ComponentProps<'figure'>, 'children'> & {
  src: string;
  /** The picture's width / height. @default 4 / 3 */
  aspect?: number;
  pins: readonly PinPoint[];
  answer?: PinPoint | null;
  /** Show the answer and how many landed on the spot. */
  revealed?: boolean;
  /** Within this distance a pin counts as on the spot. @default 3 */
  exact?: number;
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
  locale?: string;
  labels?: Pick<PinDropLabels, 'summary' | 'answer'>;
};

function PinMap({
  src,
  aspect = 4 / 3,
  pins,
  answer = null,
  revealed = false,
  exact = 3,
  size = 'default',
  locale,
  labels,
  className,
  ...props
}: PinMapProps) {
  const reduced = useReducedMotion();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const k = Number.isFinite(aspect) && aspect > 0 ? aspect : 4 / 3;
  const target = revealed && answer ? (cleanPins([answer])[0] ?? null) : null;
  const clean = cleanPins(pins);
  const spread = pinSpread(clean, { answer: target, aspect: k, exact });
  const stage = size === 'stage';
  return (
    <figure
      data-slot="pin-map"
      data-state={target ? 'revealed' : 'open'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', className)}
      {...props}
    >
      <PinField
        src={src}
        aspect={k}
        pins={clean}
        answer={target}
        arrive={!reduced}
        stage={stage}
        answerLabel={labels?.answer ?? 'The answer'}
      />
      <figcaption
        data-slot="pin-map-summary"
        aria-live="polite"
        className={cn('text-muted-foreground tabular-nums', stage ? 'text-xl' : 'text-sm')}
      >
        {(labels?.summary ?? SUMMARY)(nf.format(spread.count), target ? nf.format(spread.onSpot) : null)}
      </figcaption>
    </figure>
  );
}
PinMap.displayName = 'PinMap';

export { PinDrop, PinMap };
export type { PinDropProps, PinMapProps, PinDropLabels };
