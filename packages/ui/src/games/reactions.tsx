'use client';

/**
 * @interlace/ui — ReactionBar, ReactionStream, RaiseHand and HandQueue
 *
 * The room's pulse while someone talks. Phones tap a reaction
 * (`ReactionBar`) and the shared screen lets it float up
 * (`ReactionStream`); someone who wants to speak raises a hand
 * (`RaiseHand`) and the host calls on people in the order they asked
 * (`HandQueue`).
 *
 * ## Flow
 *
 * | Phase           | Who       | Part             |
 * | --------------- | --------- | ---------------- |
 * | Reacting        | Everyone  | `ReactionBar`    |
 * | Seeing the room | Screen    | `ReactionStream` |
 * | Asking to speak | Everyone  | `RaiseHand`      |
 * | Giving the word | Host      | `HandQueue`      |
 *
 * Budgets and the hand queue are pure, in `reactions-model`: run
 * `allowReaction` and `applyHandEvent` where the room's state lives.
 *
 * ## Anatomy
 *
 *   ReactionBar        (div role="group" — data-slot="reaction-bar": one Button per kind)
 *   ReactionStream     (div — data-slot="reaction-stream": aria-hidden floats + the tally)
 *   RaiseHand          (div — data-slot="raise-hand": a toggle Button and the place in line)
 *   HandQueue          (section — data-slot="hand-queue": who is speaking, the line, Call next)
 *
 * ## Motion
 *
 * A tap pops its button (transform, 250ms). On the shared screen each
 * allowed reaction rises from the bottom edge with a slight drift and fades
 * out (1.6s, transform and opacity, Web Animations), at most `maxFloating`
 * at once. Floats are decoration and hidden from assistive tech; the tally
 * carries the same information. Under reduced motion nothing floats and
 * the tally counts up in place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept               | Where in this file                                    |
 * | ---- | --------------------- | ----------------------------------------------------- |
 * | R4   | Extends native el     | `div` / `section` props                               |
 * | R6   | data-slot per part    | reaction-bar / reaction-stream / raise-hand / hand-queue |
 * | R7   | cn + ...rest          | `cn(…, className)` + `{...props}`                     |
 * | R9   | Controlled            | RaiseHand `raised` / `onChange`                       |
 * | R14  | Declares min viewport | `data-min-viewport` + exported const                  |
 * | R26  | A11y                  | labelled buttons; floats hidden, tally readable; place in line announced |
 */

import { Hand, Heart, Laugh, Lightbulb, CircleHelp, Mic, ThumbsUp } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { tallyReactions, type RaisedHand } from './reactions-model.js';

export const MIN_VIEWPORT = 320 as const;

export interface ReactionKind {
  id: string;
  /** The button's name and the tally's word. */
  label: string;
  icon: React.ReactNode;
}

/** A neutral starter set; pass your own `kinds` to change it. */
export const DEFAULT_REACTIONS: readonly ReactionKind[] = [
  { id: 'love', label: 'Love it', icon: <Heart /> },
  { id: 'agree', label: 'Agree', icon: <ThumbsUp /> },
  { id: 'funny', label: 'Funny', icon: <Laugh /> },
  { id: 'new', label: 'New to me', icon: <Lightbulb /> },
  { id: 'confused', label: 'Lost me', icon: <CircleHelp /> },
];

// --- ReactionBar ------------------------------------------------------------------

type ReactionBarProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  kinds?: readonly ReactionKind[];
  /** Called on every tap, with the kind id. */
  onReact?: (kind: string) => void;
  /** Taps are paused (for example while over budget). */
  disabled?: boolean;
  /** The group's name. @default 'React' */
  label?: string;
};

function ReactionBar({
  kinds = DEFAULT_REACTIONS,
  onReact,
  disabled = false,
  label = 'React',
  className,
  ...props
}: ReactionBarProps) {
  const reduced = useReducedMotion();
  const pop = (el: HTMLElement) => {
    if (reduced || typeof el.animate !== 'function') return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], {
      duration: 250,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    });
  };
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="reaction-bar"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex flex-wrap justify-center gap-2', className)}
      {...props}
    >
      {kinds.map((k) => (
        <Button
          key={k.id}
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label={k.label}
          title={k.label}
          disabled={disabled}
          data-kind={k.id}
          onClick={(e) => {
            const icon = e.currentTarget.querySelector<HTMLElement>('[data-slot="reaction-icon"]');
            if (icon) pop(icon);
            onReact?.(k.id);
          }}
          className="rounded-full"
        >
          <span data-slot="reaction-icon" aria-hidden className="inline-flex [&_svg]:size-5">
            {k.icon}
          </span>
        </Button>
      ))}
    </div>
  );
}
ReactionBar.displayName = 'ReactionBar';

// --- ReactionStream ---------------------------------------------------------------

interface Float {
  key: string;
  kind: string;
  /** 0 to 1 across the width. */
  x: number;
}

type ReactionStreamProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  kinds?: readonly ReactionKind[];
  /** Every allowed reaction so far (or a recent window); new ids float up once. */
  reactions: readonly { id: string; kind: string }[];
  /** The most floating at once; the rest only count. @default 24 */
  maxFloating?: number;
  /** Show the per-kind tally. Always on under reduced motion. @default true */
  showTally?: boolean;
  locale?: string;
};

// A low-discrepancy sequence spreads floats evenly without randomness.
const GOLDEN = 0.618_033_988_75;

function FloatIcon({ float, icon, onDone }: { float: Float; icon: React.ReactNode; onDone: (key: string) => void }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') {
      onDone(float.key);
      return;
    }
    const drift = (float.x - 0.5) * 40;
    const anim = el.animate(
      [
        { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
        { transform: `translate(${drift * 0.3}px, -20%) scale(1.1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${drift}px, -420%) scale(1)`, opacity: 0 },
      ],
      { duration: 1600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
    );
    let live = true;
    anim.finished.then(
      () => live && onDone(float.key),
      () => undefined,
    );
    return () => {
      live = false;
      anim.cancel();
    };
  }, [float, onDone]);
  return (
    <span
      ref={ref}
      data-slot="reaction-float"
      data-kind={float.kind}
      className="text-primary absolute bottom-0 inline-flex opacity-0 [&_svg]:size-8"
      style={{ insetInlineStart: `calc(${(float.x * 90 + 5).toFixed(2)}% - 1rem)` }}
    >
      {icon}
    </span>
  );
}

function ReactionStream({
  kinds = DEFAULT_REACTIONS,
  reactions,
  maxFloating = 24,
  showTally = true,
  locale,
  className,
  ...props
}: ReactionStreamProps) {
  const reduced = useReducedMotion();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const seen = React.useRef<Set<string> | null>(null);
  const count = React.useRef(0);
  const [floats, setFloats] = React.useState<Float[]>([]);
  const icons = React.useMemo(() => new Map(kinds.map((k) => [k.id, k.icon])), [kinds]);

  React.useEffect(() => {
    // The first render only remembers what was already there: no burst on load.
    if (seen.current === null) {
      seen.current = new Set(reactions.map((r) => r.id));
      return;
    }
    const fresh = reactions.filter((r) => !seen.current?.has(r.id) && icons.has(r.kind));
    for (const r of reactions) seen.current.add(r.id);
    if (reduced || fresh.length === 0) return;
    setFloats((prev) => {
      const room = Math.max(0, maxFloating - prev.length);
      // The newest win when the screen is full.
      const added = (room === 0 ? [] : fresh.slice(-room)).map((r) => {
        count.current += 1;
        return { key: r.id, kind: r.kind, x: (count.current * GOLDEN) % 1 };
      });
      return [...prev, ...added];
    });
  }, [reactions, reduced, maxFloating, icons]);

  const done = React.useCallback((key: string) => setFloats((prev) => prev.filter((f) => f.key !== key)), []);
  const tally = tallyReactions(
    kinds.map((k) => k.id),
    reactions,
  );

  return (
    <div
      data-slot="reaction-stream"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('relative grid min-h-24 content-end gap-3', className)}
      {...props}
    >
      <div
        aria-hidden
        data-slot="reaction-stream-floats"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {floats.map((f) => (
          <FloatIcon key={f.key} float={f} icon={icons.get(f.kind)} onDone={done} />
        ))}
      </div>
      {showTally || reduced ? (
        <ul data-slot="reaction-stream-tally" className="relative flex flex-wrap justify-center gap-2">
          {tally.map(({ kind, count: n }) => {
            const k = kinds.find((x) => x.id === kind) as ReactionKind;
            return (
              <li
                key={kind}
                data-kind={kind}
                className="bg-card text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium tabular-nums [&_svg]:size-4"
              >
                <span aria-hidden className="text-primary inline-flex">
                  {k.icon}
                </span>
                <span className="sr-only">{k.label}: </span>
                {nf.format(n)}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
ReactionStream.displayName = 'ReactionStream';

// --- RaiseHand --------------------------------------------------------------------

interface RaiseHandLabels {
  /** @default 'Raise your hand' */
  raise?: string;
  /** @default 'Lower your hand' */
  lower?: string;
  /** @default (n) => n === 1 ? 'You are next.' : `You are number ${n} in line.` */
  place?: (place: number) => string;
  /** When the host calls on this person. @default 'It is your turn to speak.' */
  speaking?: string;
}

type RaiseHandProps = Omit<React.ComponentProps<'div'>, 'children' | 'onChange'> & {
  raised: boolean;
  onChange?: (raised: boolean) => void;
  /** 1 for first in line (`placeInLine`). */
  place?: number | null;
  /** This person has the word. */
  speaking?: boolean;
  labels?: RaiseHandLabels;
};

function RaiseHand({ raised, onChange, place, speaking = false, labels, className, ...props }: RaiseHandProps) {
  const message = speaking
    ? (labels?.speaking ?? 'It is your turn to speak.')
    : raised && place
      ? (labels?.place ?? ((n: number) => (n === 1 ? 'You are next.' : `You are number ${n} in line.`)))(place)
      : '';
  return (
    <div
      data-slot="raise-hand"
      data-state={speaking ? 'speaking' : raised ? 'raised' : 'down'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid justify-items-center gap-2', className)}
      {...props}
    >
      <Button
        type="button"
        size="lg"
        variant={raised || speaking ? 'default' : 'outline'}
        aria-pressed={raised}
        disabled={speaking}
        onClick={() => onChange?.(!raised)}
      >
        {speaking ? (
          <Mic aria-hidden />
        ) : (
          <Hand
            aria-hidden
            className={cn(
              'transition-transform duration-(--duration-base) ease-enter',
              raised && 'motion-safe:-translate-y-0.5 motion-safe:-rotate-12',
            )}
          />
        )}
        {raised ? (labels?.lower ?? 'Lower your hand') : (labels?.raise ?? 'Raise your hand')}
      </Button>
      <p
        data-slot="raise-hand-message"
        aria-live="polite"
        className={cn('min-h-5 text-sm', speaking ? 'text-primary font-semibold' : 'text-muted-foreground')}
      >
        {message}
      </p>
    </div>
  );
}
RaiseHand.displayName = 'RaiseHand';

// --- HandQueue --------------------------------------------------------------------

interface HandQueueLabels {
  /** @default 'Raised hands' */
  title?: string;
  /** @default 'Speaking' */
  speaking?: string;
  /** @default 'Call next' */
  callNext?: string;
  /** @default (name) => `Call on ${name}` */
  callOn?: (name: string) => string;
  /** @default 'Done' */
  done?: string;
  /** @default 'No hands up.' */
  empty?: string;
  /** @default (name) => `Lower ${name}'s hand` */
  lower?: (name: string) => string;
}

type HandQueueProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  hands: readonly RaisedHand[];
  speaking?: RaisedHand | null;
  /** Call on the first in line, or on `by`. */
  onCall?: (by?: string) => void;
  onLower?: (by: string) => void;
  onDone?: () => void;
  labels?: HandQueueLabels;
};

function HandQueue({ hands, speaking = null, onCall, onLower, onDone, labels, className, ...props }: HandQueueProps) {
  const titleId = React.useId();
  return (
    <section
      aria-labelledby={titleId}
      data-slot="hand-queue"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={titleId} className="flex items-baseline gap-2 text-sm font-semibold">
          {labels?.title ?? 'Raised hands'}
          <span className="text-muted-foreground text-xs font-normal tabular-nums">{hands.length}</span>
        </h3>
        <Button size="sm" disabled={hands.length === 0} onClick={() => onCall?.()}>
          <Mic aria-hidden />
          {labels?.callNext ?? 'Call next'}
        </Button>
      </div>
      {speaking ? (
        <div
          data-slot="hand-queue-speaking"
          className="border-primary motion-safe:animate-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-(--duration-base) motion-safe:ease-enter flex items-center justify-between gap-3 rounded-md border p-3"
        >
          <p className="text-sm">
            <span className="text-primary me-2 text-xs font-semibold">{labels?.speaking ?? 'Speaking'}</span>
            {speaking.name}
          </p>
          <Button size="sm" variant="outline" onClick={() => onDone?.()}>
            {labels?.done ?? 'Done'}
          </Button>
        </div>
      ) : null}
      {hands.length === 0 ? (
        <p className="text-muted-foreground text-sm">{labels?.empty ?? 'No hands up.'}</p>
      ) : (
        <ol data-slot="hand-queue-list" className="grid gap-1.5">
          {hands.map((h, i) => (
            <li
              key={h.by}
              className="motion-safe:animate-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-(--duration-base) motion-safe:ease-enter flex items-center gap-2 rounded-md border px-3 py-1.5"
            >
              <span className="text-muted-foreground w-5 text-xs tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{h.name}</span>
              <Button size="sm" variant="ghost" onClick={() => onCall?.(h.by)}>
                {(labels?.callOn ?? ((n: string) => `Call on ${n}`))(h.name)}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={(labels?.lower ?? ((n: string) => `Lower ${n}'s hand`))(h.name)}
                onClick={() => onLower?.(h.by)}
              >
                <Hand aria-hidden className="rotate-180" />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
HandQueue.displayName = 'HandQueue';

export { ReactionBar, ReactionStream, RaiseHand, HandQueue };
export type { ReactionBarProps, ReactionStreamProps, RaiseHandProps, RaiseHandLabels, HandQueueProps, HandQueueLabels };
