'use client';

/**
 * @interlace/ui — Quadrant and QuadrantMap
 *
 * A 2 x 2 grid: two questions at once ("how hard / how important"). Each
 * person places one dot on a square pad, by tapping, dragging or the arrow
 * keys, then sees the room on the same grid: where the dots crowd, how many
 * sit in each quarter, the room's middle, and, when asked before, where the
 * middle was then. `QuadrantMap` is the same picture for a shared screen.
 *
 * ## Anatomy
 *
 *   Quadrant                         (div — data-slot="quadrant", data-state=placing|placed)
 *     ├─ p                           (data-slot="quadrant-prompt")
 *     ├─ div role=group              (data-slot="quadrant-pad": tap or drag to move the dot)
 *     │   ├─ axis lines, pole labels, corner names
 *     │   └─ button                  (data-slot="quadrant-dot": arrow keys; its name is the place in words)
 *     ├─ QuadrantChart (placed)      (aria-hidden: everyone's dots, quarter counts, yours, the middle, before; a legend)
 *     ├─ Button (placing)            (data-slot="quadrant-place")
 *     ├─ span sr-only aria-live      (data-slot="quadrant-announce": the place in words, as it changes)
 *     └─ p tabIndex=-1 aria-live     (data-slot="quadrant-result": the picture in one sentence)
 *   QuadrantMap                      (div — data-slot="quadrant-map": the chart and its sentence)
 *
 * ## Data
 *
 * `x` runs 0 (the start pole) to 100 (the end pole); `y` runs 0 (the bottom
 * pole) to 100 (the top pole). In right-to-left the start pole sits on the
 * right, and the arrow keys follow what the eye sees. `points` are the
 * room's dots without this viewer's own unless `pointsIncludeOwn`;
 * `minResponses` hides the room until enough dots are in.
 *
 * ## Motion
 *
 * The room's dots fade in together (250ms) and the room's middle travels from the
 * viewer's dot to where the room is (400ms, `--ease-move`). Under reduced
 * motion the picture is simply there. The dot follows a finger or the keys
 * at once: input never waits on animation.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                  |
 * | ---- | ------------------------- | --------------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                         |
 * | R6   | data-slot per part        | quadrant / -prompt / -pad / -dot / -chart / -place / -announce / -result; quadrant-map |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                   |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onPlace`                |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                |
 * | R26  | A11y                      | dot moved by keys, its place in words; chart hidden, result sentence focused |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { motionEase } from '../lib/motion-token.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import {
  cleanPoints,
  nudgePoint,
  QUARTERS,
  quadrantShift,
  summarizeQuadrant,
  type QuadPoint,
  type Quarter,
} from './quadrant-model.js';

export const MIN_VIEWPORT = 320 as const;

interface QuadrantAxes {
  /** The horizontal axis, [start, end]. */
  x: readonly [string, string];
  /** The vertical axis, [bottom, top]. */
  y: readonly [string, string];
}

interface QuadrantLabels {
  /** @default 'Place my dot' */
  place?: string;
  /** A place in words. @default 'Closer to {end}, closer to {top}', or 'In the middle' */
  position?: (p: QuadPoint, axes: QuadrantAxes) => string;
  /** How to move the dot. @default 'Tap the grid or use the arrow keys to move your dot.' */
  hint?: string;
  /** A quarter's name. @default (q, axes) => `${top or bottom} and ${start or end}` */
  quarter?: (q: Quarter, axes: QuadrantAxes) => string;
  /**
   * The picture in one sentence. `most` is a quarter's name or null when
   * the room is spread; `mine` is null on a screen.
   */
  result?: (r: { count: string; most: string | null; mine: string | null; moved: boolean }) => string;
  /** @default (min) => `Thanks. The room shows once ${min} people have placed a dot.` */
  pending?: (min: number) => string;
  /** Legend: the viewer's dot. @default 'You' */
  you?: string;
  /** Legend: the room's middle. @default 'Room' */
  middle?: string;
  /** A screen with no dots yet. @default 'No dots yet.' */
  empty?: string;
  /** @default 'Before' */
  before?: string;
}

const POSITION: NonNullable<QuadrantLabels['position']> = (p, axes) => {
  const x = p.x < 40 ? `closer to ${axes.x[0]}` : p.x > 60 ? `closer to ${axes.x[1]}` : null;
  const y = p.y < 40 ? `closer to ${axes.y[0]}` : p.y > 60 ? `closer to ${axes.y[1]}` : null;
  const words = [x, y].filter(Boolean).join(', ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'In the middle';
};
const QUARTER: NonNullable<QuadrantLabels['quarter']> = (q, axes) => {
  const [v, h] = q.split('-');
  return `${v === 'top' ? axes.y[1] : axes.y[0]} and ${h === 'end' ? axes.x[1] : axes.x[0]}`;
};
const RESULT: NonNullable<QuadrantLabels['result']> = ({ count, most, mine, moved }) =>
  `${count} ${count === '1' ? 'person' : 'people'} placed a dot. ${most ? `Most are in ${most}.` : 'The room is spread out.'}${mine ? ` Yours: ${mine}.` : ''}${moved ? ' The middle has moved since before.' : ''}`;
const PENDING: NonNullable<QuadrantLabels['pending']> = (min) =>
  `Thanks. The room shows once ${min} people have placed a dot.`;

/** Places a mark at a point: inline-start for x (so it mirrors in RTL), top for y. */
const at = (p: QuadPoint): React.CSSProperties => ({ insetInlineStart: `${p.x}%`, top: `${100 - p.y}%` });
/** The writing direction around an element: the nearest `dir`, else the computed style. */
function directionOf(el: Element): 'ltr' | 'rtl' {
  const dir = el.closest('[dir]')?.getAttribute('dir');
  if (dir === 'rtl' || dir === 'ltr') return dir;
  return getComputedStyle(el).direction === 'rtl' ? 'rtl' : 'ltr';
}

const MARK = 'absolute -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2';

function Poles({ axes, stage }: { axes: QuadrantAxes; stage?: boolean }) {
  const text = cn('text-muted-foreground absolute font-medium', stage ? 'text-sm' : 'text-xs');
  return (
    <>
      <span className={cn(text, 'start-1/2 top-1 -translate-x-1/2 rtl:translate-x-1/2')}>{axes.y[1]}</span>
      <span className={cn(text, 'start-1/2 bottom-1 -translate-x-1/2 rtl:translate-x-1/2')}>{axes.y[0]}</span>
      <span className={cn(text, 'start-1.5 top-1/2 -translate-y-1/2')}>{axes.x[0]}</span>
      <span className={cn(text, 'end-1.5 top-1/2 -translate-y-1/2')}>{axes.x[1]}</span>
    </>
  );
}

function Lines() {
  return (
    <>
      <span aria-hidden className="bg-border absolute inset-y-0 start-1/2 w-px" />
      <span aria-hidden className="bg-border absolute inset-x-0 top-1/2 h-px" />
    </>
  );
}

interface ChartProps {
  points: readonly QuadPoint[];
  axes: QuadrantAxes;
  mine?: QuadPoint | null;
  before?: readonly QuadPoint[];
  stage?: boolean;
  /** Play the arrival: the dots fade in, the middle travels from `mine`. */
  arrive: boolean;
  locale?: string;
  labels?: QuadrantLabels;
}

function QuadrantChart({ points, axes, mine, before, stage, arrive, locale, labels }: ChartProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const room = summarizeQuadrant(points);
  const earlier = before && before.length > 0 ? summarizeQuadrant(before).median : null;

  React.useEffect(() => {
    const chart = ref.current;
    if (!arrive || !chart || typeof chart.animate !== 'function') return;
    chart
      .querySelector<HTMLElement>('[data-slot="quadrant-dots"]')
      ?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: motionEase(chart, 'enter') });
    const marker = chart.querySelector<HTMLElement>('[data-slot="quadrant-middle"]');
    if (!marker || !mine || !room.median) return;
    const box = chart.getBoundingClientRect();
    const flip = directionOf(chart) === 'rtl' ? -1 : 1;
    const dx = ((mine.x - room.median.x) / 100) * box.width * flip;
    const dy = ((room.median.y - mine.y) / 100) * box.height;
    marker.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
      duration: 400,
      easing: motionEase(marker, 'move'),
    });
    // Once, when the picture arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrive]);

  const key = cn('text-muted-foreground flex items-center gap-1.5', stage ? 'text-sm' : 'text-xs');
  return (
    <div ref={ref} aria-hidden data-slot="quadrant-chart" className="grid gap-2">
      <div className="bg-card relative aspect-square w-full overflow-hidden rounded-lg border">
        <div data-slot="quadrant-dots" className="absolute inset-0">
          {cleanPoints(points).map((p, i) => (
            <span
              // Dots carry no identity of their own; their order is the room's.
              key={`dot-${i}`}
              className={cn(MARK, 'bg-foreground/35 rounded-full', stage ? 'size-3' : 'size-2')}
              style={at(p)}
            />
          ))}
        </div>
        <Lines />
        {QUARTERS.map((q) => {
          const [v, h] = q.split('-');
          return (
            <span
              key={q}
              data-slot="quadrant-count"
              data-quarter={q}
              className={cn(
                'text-foreground bg-card/80 absolute rounded-sm px-1 font-semibold tabular-nums',
                v === 'top' ? 'top-2' : 'bottom-2',
                h === 'end' ? 'end-2' : 'start-2',
                stage ? 'text-xl' : 'text-sm',
              )}
            >
              {nf.format(room.quarters[q])}
            </span>
          );
        })}
        <Poles axes={axes} stage={stage} />
        {earlier ? (
          <span
            data-slot="quadrant-before"
            className={cn(MARK, 'border-muted-foreground size-5 rounded-full border-2 border-dashed')}
            style={at(earlier)}
          />
        ) : null}
        {mine ? (
          <span
            data-slot="quadrant-mine"
            className={cn(MARK, 'bg-primary ring-card size-3.5 rounded-full ring-2')}
            style={at(mine)}
          />
        ) : null}
        {room.median ? (
          <span data-slot="quadrant-middle" className={cn(MARK, 'flex flex-col items-center')} style={at(room.median)}>
            <span className="border-foreground bg-card/70 size-6 rounded-full border-2" />
          </span>
        ) : null}
      </div>
      <div data-slot="quadrant-legend" className="flex flex-wrap gap-x-4 gap-y-1">
        {mine ? (
          <span className={key}>
            <span className="bg-primary size-2.5 rounded-full" />
            {labels?.you ?? 'You'}
          </span>
        ) : null}
        <span className={key}>
          <span className="border-foreground size-3 rounded-full border-2" />
          {labels?.middle ?? 'Room'}
        </span>
        {earlier ? (
          <span className={key}>
            <span className="border-muted-foreground size-3 rounded-full border-2 border-dashed" />
            {labels?.before ?? 'Before'}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function sentence(
  points: readonly QuadPoint[],
  axes: QuadrantAxes,
  mine: QuadPoint | null,
  before: readonly QuadPoint[] | undefined,
  nf: Intl.NumberFormat,
  labels: QuadrantLabels | undefined,
): string {
  const room = summarizeQuadrant(points);
  if (room.count === 0) return labels?.empty ?? 'No dots yet.';
  const shift = before && before.length > 0 ? quadrantShift(before, points) : null;
  return (labels?.result ?? RESULT)({
    count: nf.format(room.count),
    most: room.most ? (labels?.quarter ?? QUARTER)(room.most, axes) : null,
    mine: mine ? (labels?.position ?? POSITION)(mine, axes) : null,
    moved: shift !== null && Math.hypot(shift.x, shift.y) >= 10,
  });
}

// --- Quadrant (phone) -------------------------------------------------------------

type QuadrantProps = Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue'> & {
  prompt: React.ReactNode;
  axes: QuadrantAxes;
  /** The room's dots. */
  points?: readonly QuadPoint[];
  /** `points` already hold this viewer's dot. @default false */
  pointsIncludeOwn?: boolean;
  /** An earlier round, drawn as a dashed ring at its middle. */
  before?: readonly QuadPoint[];
  /** The viewer's placed dot, controlled. null while placing. */
  value?: QuadPoint | null;
  defaultValue?: QuadPoint | null;
  /** Called once, when the viewer places their dot. */
  onPlace?: (point: QuadPoint) => void;
  /** Hide the room until this many dots are in. @default 1 */
  minResponses?: number;
  /** How far an arrow key moves the dot. @default 5 */
  step?: number;
  locale?: string;
  labels?: QuadrantLabels;
};

function Quadrant({
  prompt,
  axes,
  points = [],
  pointsIncludeOwn = false,
  before,
  value: valueProp,
  defaultValue = null,
  onPlace,
  minResponses = 1,
  step = 5,
  locale,
  labels,
  className,
  ...props
}: QuadrantProps) {
  const reduced = useReducedMotion();
  const [own, setOwn] = React.useState<QuadPoint | null>(defaultValue);
  const placed = valueProp === undefined ? own : valueProp;
  const [draft, setDraft] = React.useState<QuadPoint>({ x: 50, y: 50 });
  const [placedHere, setPlacedHere] = React.useState(false);
  const [announce, setAnnounce] = React.useState('');
  const promptId = React.useId();
  const hintId = React.useId();
  const padRef = React.useRef<HTMLDivElement>(null);
  const dotRef = React.useRef<HTMLButtonElement>(null);
  const resultRef = React.useRef<HTMLParagraphElement>(null);
  const dragging = React.useRef(false);
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const all = placed === null || pointsIncludeOwn ? points : [...points, placed];
  const count = summarizeQuadrant(all).count;
  const shown = placed !== null && count >= minResponses;
  const words = (p: QuadPoint) => (labels?.position ?? POSITION)(p, axes);

  React.useEffect(() => {
    if (shown && placedHere) resultRef.current?.focus();
  }, [shown, placedHere]);

  const move = (next: QuadPoint) => {
    setDraft(next);
    // Speak only when the words change, so a drag does not chatter.
    const said = words(next);
    setAnnounce((prev) => (prev === said ? prev : said));
  };

  const fromPointer = (e: React.PointerEvent) => {
    const pad = padRef.current;
    if (!pad) return;
    const box = pad.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    const rtl = directionOf(pad) === 'rtl';
    const fx = (e.clientX - box.left) / box.width;
    const x = Math.round((rtl ? 1 - fx : fx) * 100);
    const y = Math.round((1 - (e.clientY - box.top) / box.height) * 100);
    move({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  const place = () => {
    if (placed !== null) return;
    setPlacedHere(true);
    if (valueProp === undefined) setOwn(draft);
    onPlace?.(draft);
  };

  return (
    <div
      data-slot="quadrant"
      data-state={placed === null ? 'placing' : 'placed'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid max-w-112 gap-4', className)}
      {...props}
    >
      <p id={promptId} data-slot="quadrant-prompt" className="font-heading text-lg font-semibold text-balance">
        {prompt}
      </p>

      {placed === null ? (
        <div
          ref={padRef}
          role="group"
          aria-labelledby={promptId}
          data-slot="quadrant-pad"
          className="bg-card relative aspect-square w-full cursor-crosshair touch-none overflow-hidden rounded-lg border select-none"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            fromPointer(e);
            dotRef.current?.focus({ preventScroll: true });
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
          <Lines />
          <span aria-hidden>
            <Poles axes={axes} />
          </span>
          <button
            ref={dotRef}
            type="button"
            data-slot="quadrant-dot"
            aria-label={words(draft)}
            aria-describedby={hintId}
            onKeyDown={(e) => {
              const dir = directionOf(e.currentTarget);
              const next = nudgePoint(draft, e.key, e.shiftKey ? 1 : step, dir);
              if (!next) return;
              e.preventDefault();
              move(next);
            }}
            className={cn(
              MARK,
              'bg-primary ring-card focus-visible:outline-ring size-6 rounded-full shadow-sm ring-2 outline-offset-2 focus-visible:outline-2',
            )}
            style={at(draft)}
          />
          <span id={hintId} className="sr-only">
            {labels?.hint ?? 'Tap the grid or use the arrow keys to move your dot.'}
          </span>
        </div>
      ) : shown ? (
        <QuadrantChart
          points={all}
          axes={axes}
          mine={placed}
          before={before}
          arrive={placedHere && !reduced}
          locale={locale}
          labels={labels}
        />
      ) : null}

      {placed === null ? (
        <Button data-slot="quadrant-place" size="lg" className="justify-self-start" onClick={place}>
          {labels?.place ?? 'Place my dot'}
        </Button>
      ) : null}

      <span data-slot="quadrant-announce" aria-live="polite" className="sr-only">
        {placed === null ? announce : ''}
      </span>
      <p
        ref={resultRef}
        tabIndex={-1}
        data-slot="quadrant-result"
        aria-live="polite"
        className="focus-visible:outline-ring rounded-sm text-sm outline-offset-4 empty:hidden focus-visible:outline-2"
      >
        {placed === null
          ? ''
          : shown
            ? sentence(all, axes, placed, before, nf, labels)
            : (labels?.pending ?? PENDING)(minResponses)}
      </p>
    </div>
  );
}
Quadrant.displayName = 'Quadrant';

// --- QuadrantMap (screen) ---------------------------------------------------------

type QuadrantMapProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  axes: QuadrantAxes;
  points: readonly QuadPoint[];
  before?: readonly QuadPoint[];
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
  locale?: string;
  labels?: QuadrantLabels;
};

function QuadrantMap({
  axes,
  points,
  before,
  size = 'default',
  locale,
  labels,
  className,
  ...props
}: QuadrantMapProps) {
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const stage = size === 'stage';
  return (
    <div
      data-slot="quadrant-map"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', stage ? 'max-w-168' : 'max-w-112', className)}
      {...props}
    >
      <QuadrantChart
        points={points}
        axes={axes}
        before={before}
        stage={stage}
        arrive={false}
        locale={locale}
        labels={labels}
      />
      <p className={cn('text-muted-foreground', stage ? 'text-lg' : 'text-sm')}>
        {sentence(points, axes, null, before, nf, labels)}
      </p>
    </div>
  );
}
QuadrantMap.displayName = 'QuadrantMap';

export { Quadrant, QuadrantMap };
export type { QuadrantProps, QuadrantMapProps, QuadrantLabels, QuadrantAxes };
