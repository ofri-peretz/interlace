'use client';

/**
 * @interlace/ui — Agenda and AgendaNow
 *
 * The running order of a session. `Agenda` is the presenter's console: the
 * item that is on, a clock that counts down and then counts over, the
 * presenter's notes, how far the session has drifted from the plan and when
 * it will end at this pace, and the controls. `AgendaNow` is the room's
 * view of the same state: what is on, the time left and what comes next.
 *
 * ## Flow map
 *
 * | Phase    | Presenter (`Agenda`)                  | Room (`AgendaNow`)       |
 * | -------- | ------------------------------------- | ------------------------ |
 * | before   | the plan, Start                       | "Starting soon", first item |
 * | running  | clock, notes, Back, Pause, +1 min, Next | item, time left, next  |
 * | paused   | clock stopped, Resume                 | item, "Paused"           |
 * | over     | clock counts over in the warning tone | item, time left reads 0  |
 * | finished | how each item ran against the plan    | "That's all"             |
 *
 * ## Anatomy
 *
 *   Agenda                       (section — data-slot="agenda", data-phase)
 *     ├─ div                     (data-slot="agenda-now": eyebrow, title, clock role="timer")
 *     ├─ div aria-hidden         (data-slot="agenda-bar": the item's time, emptying)
 *     ├─ p                       (data-slot="agenda-pace": drift and the end time)
 *     ├─ div                     (data-slot="agenda-notes": presenter notes)
 *     ├─ div                     (data-slot="agenda-controls")
 *     ├─ ol                      (data-slot="agenda-list": aria-current="step" on the item that is on)
 *     └─ span sr-only aria-live  (data-slot="agenda-announce")
 *   AgendaNow                    (div — data-slot="agenda-now-screen", data-phase)
 *
 * ## State
 *
 * Controlled. Keep `AgendaState` where the room's state lives, pass it in,
 * and apply every event `onEvent` sends with `applyAgendaEvent`. Because
 * the state is timestamps, a refreshed tab or a late screen shows the right
 * clock at once. The clock ticks on whole seconds with timers, not an
 * animation loop, and stops while paused or finished. `frozenAt` freezes it at
 * one moment, for a recap, a print view or a test.
 *
 * ## Keyboard
 *
 * Every control is a button. With `shortcuts`, a presentation remote works
 * too: Page Down or Right moves on, Page Up or Left goes back, `p` pauses
 * and resumes, unless focus is in a text field.
 *
 * ## Motion
 *
 * The bar empties in one linear animation to the item's end (transform).
 * On moving on, the new item's title rises in (200ms). Under reduced motion
 * the bar steps with the clock and nothing moves.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                 |
 * | ---- | ------------------------- | -------------------------------------------------- |
 * | R4   | Extends native el         | `section` / `div` props                            |
 * | R6   | data-slot per part        | agenda / -now / -bar / -pace / -notes / -controls / -list |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                  |
 * | R8   | Enums, not booleans       | `size`                                             |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const               |
 * | R26  | A11y                      | role="timer", aria-current="step", sparse announcements, words with every tone |
 */

import { Check, ChevronLeft, ChevronRight, Pause, Play, Plus } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { motionEase } from '../lib/motion-token.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import {
  agendaStatus,
  formatClock,
  type AgendaEvent,
  type AgendaItem,
  type AgendaState,
  type AgendaStatus,
} from './agenda-model.js';

export const MIN_VIEWPORT = 320 as const;

interface AgendaLabels {
  /** @default 'Now' */
  now?: string;
  /** @default 'Up next' */
  next?: string;
  /** @default 'Start' */
  start?: string;
  /** @default 'Next' */
  forward?: string;
  /** @default 'Finish' */
  finish?: string;
  /** @default 'Back' */
  back?: string;
  /** @default 'Pause' */
  pause?: string;
  /** @default 'Resume' */
  resume?: string;
  /** @default 'Add a minute' */
  extend?: string;
  /** @default 'Notes' */
  notes?: string;
  /** @default 'Running order' */
  list?: string;
  /** The clock's name. @default 'Time left' */
  clock?: string;
  /** @default (t) => `${t} over` */
  over?: (time: string) => string;
  /** @default 'Paused' */
  paused?: string;
  /** @default 'Starting soon' */
  before?: string;
  /** @default "That's all" */
  finished?: string;
  /** @default (m) => `${m} min` */
  minutes?: (m: number) => string;
  /**
   * The pace line. `drift` is whole minutes, positive when behind.
   * @default English: 'On plan', '3 min behind plan', '2 min ahead of plan', then '. Ends around {time}.'
   */
  pace?: (r: { drift: number; endsAt: string | null }) => string;
  /** Spoken when an item starts. @default (title) => `Now: ${title}` */
  started?: (title: string) => string;
  /** Spoken a minute before the end. @default (title) => `One minute left on ${title}` */
  oneMinute?: (title: string) => string;
  /** Spoken when time is up. @default (title) => `Time is up on ${title}` */
  timeUp?: (title: string) => string;
}

const PACE: NonNullable<AgendaLabels['pace']> = ({ drift, endsAt }) => {
  const where = drift === 0 ? 'On plan' : drift > 0 ? `${drift} min behind plan` : `${-drift} min ahead of plan`;
  return endsAt ? `${where}. Ends around ${endsAt}.` : `${where}.`;
};

/** The clock for a state, re-read on each whole second while it runs. */
function useAgendaClock(items: readonly AgendaItem[], state: AgendaState, frozen?: number): AgendaStatus {
  const [now, setNow] = React.useState(() => Date.now());
  const ticking = frozen === undefined && state.current >= 0 && state.current < items.length && state.pausedAt === null;
  React.useEffect(() => {
    setNow(Date.now());
    if (!ticking || state.startedAt === null) return;
    const startedAt = state.startedAt;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const into = (t - startedAt) % 1000;
      timer = setTimeout(tick, 1000 - into + 5);
    };
    timer = setTimeout(tick, 1000 - ((Date.now() - startedAt) % 1000) + 5);
    return () => clearTimeout(timer);
  }, [ticking, state.startedAt]);
  return agendaStatus(items, state, frozen ?? (ticking ? now : (state.pausedAt ?? now)));
}

function useAnnouncements(status: AgendaStatus, labels: AgendaLabels | undefined): string {
  const [text, setText] = React.useState('');
  const said = React.useRef(new Set<string>());
  const id = status.item?.id;
  const title = status.item?.title ?? '';
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      // A refresh or a late join does not announce what is already on.
      first.current = false;
      return;
    }
    if (id) setText((labels?.started ?? ((t: string) => `Now: ${t}`))(title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const left = status.leftMs;
  const live = status.phase === 'running' || status.phase === 'over';
  React.useEffect(() => {
    if (!id || !live) return;
    const oneMinute = `${id}:1`;
    const up = `${id}:0`;
    if (left <= 0 && !said.current.has(up)) {
      said.current.add(up);
      setText((labels?.timeUp ?? ((t: string) => `Time is up on ${t}`))(title));
    } else if (left > 0 && left <= 60_000 && status.plannedMs > 60_000 && !said.current.has(oneMinute)) {
      said.current.add(oneMinute);
      setText((labels?.oneMinute ?? ((t: string) => `One minute left on ${t}`))(title));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, live, left <= 0, left <= 60_000]);
  return text;
}

function AgendaBar({ status, reduced, frozen }: { status: AgendaStatus; reduced: boolean; frozen: boolean }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const fraction = status.plannedMs > 0 ? Math.min(1, Math.max(0, status.leftMs / status.plannedMs)) : 0;
  const running = status.phase === 'running' && !frozen;
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !running || reduced || typeof el.animate !== 'function') return;
    const anim = el.animate([{ transform: `scaleX(${fraction})` }, { transform: 'scaleX(0)' }], {
      duration: Math.max(0, status.leftMs),
      easing: 'linear',
      fill: 'forwards',
    });
    return () => anim.cancel();
    // Restart only when the item, the pause state or an extension changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.item?.id, running, status.plannedMs, reduced]);
  return (
    <div aria-hidden data-slot="agenda-bar" className="bg-muted h-1.5 overflow-hidden rounded-full">
      <span
        ref={ref}
        className={cn(
          'block h-full origin-left rounded-full rtl:origin-right',
          status.phase === 'over' ? 'bg-destructive' : 'bg-primary',
        )}
        style={{ transform: `scaleX(${fraction})` }}
      />
    </div>
  );
}

function Rise({ id, reduced, children }: { id: string | undefined; reduced: boolean; children: React.ReactNode }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el || reduced || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'translateY(0.5em)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      {
        duration: 200,
        easing: motionEase(el, 'enter'),
      },
    );
  }, [id, reduced]);
  return (
    <span ref={ref} className="block">
      {children}
    </span>
  );
}

// --- Agenda (presenter) ----------------------------------------------------------

type AgendaProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  items: readonly AgendaItem[];
  state: AgendaState;
  /** Every control sends one event. Apply it with `applyAgendaEvent`. */
  onEvent: (event: AgendaEvent) => void;
  /** Show the session at this moment and stop the clock: a recap, a print view, a test. */
  frozenAt?: number;
  /** Presentation-remote keys (Page Up/Down, arrows, p). @default false */
  shortcuts?: boolean;
  locale?: string;
  labels?: AgendaLabels;
};

function Agenda({
  items,
  state,
  onEvent,
  frozenAt,
  shortcuts = false,
  locale,
  labels,
  className,
  ...props
}: AgendaProps) {
  const reduced = useReducedMotion();
  const status = useAgendaClock(items, state, frozenAt);
  const announce = useAnnouncements(status, labels);
  const time = React.useMemo(() => new Intl.DateTimeFormat(locale, { timeStyle: 'short' }), [locale]);
  const minutes = labels?.minutes ?? ((m: number) => `${m} min`);
  const { phase, index } = status;
  const isLast = index === items.length - 1;

  const send = React.useRef(onEvent);
  send.current = onEvent;
  const where = React.useRef({ phase, index });
  where.current = { phase, index };

  React.useEffect(() => {
    if (!shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const { phase: p, index: i } = where.current;
      const at = Date.now();
      if (e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        send.current(p === 'before' ? { type: 'start', at } : { type: 'next', from: i, at });
      } else if (e.key === 'PageUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        send.current({ type: 'back', from: i, at });
      } else if (e.key === 'p' && (p === 'running' || p === 'over' || p === 'paused')) {
        send.current({ type: p === 'paused' ? 'resume' : 'pause', at });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcuts]);

  const drift = Math.round(status.driftMs / 60_000);
  const over = phase === 'over';

  return (
    <section
      data-slot="agenda"
      data-phase={phase}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-5', className)}
      {...props}
    >
      <div data-slot="agenda-now" className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm font-medium">
            {phase === 'before'
              ? (labels?.before ?? 'Starting soon')
              : phase === 'finished'
                ? ''
                : (labels?.now ?? 'Now')}
          </p>
          <p className="font-heading text-2xl font-semibold text-balance">
            <Rise id={status.item?.id} reduced={reduced}>
              {phase === 'finished'
                ? (labels?.finished ?? "That's all")
                : (status.item?.title ?? status.next?.title ?? '')}
            </Rise>
          </p>
        </div>
        {status.item ? (
          <div
            role="timer"
            aria-label={labels?.clock ?? 'Time left'}
            data-slot="agenda-clock"
            className={cn(
              'grid justify-items-end text-4xl leading-none font-semibold tabular-nums',
              over ? 'text-destructive' : 'text-foreground',
            )}
          >
            <span>{over ? `+${formatClock(status.leftMs)}` : formatClock(status.leftMs)}</span>
            <span className="mt-1 text-sm font-medium">
              {phase === 'paused'
                ? (labels?.paused ?? 'Paused')
                : over
                  ? (labels?.over ?? ((t: string) => `${t} over`))(formatClock(status.leftMs))
                  : minutes(Math.round(status.plannedMs / 60_000))}
            </span>
          </div>
        ) : null}
      </div>

      {status.item ? <AgendaBar status={status} reduced={reduced} frozen={frozenAt !== undefined} /> : null}

      {phase !== 'before' ? (
        <p data-slot="agenda-pace" className="text-muted-foreground text-sm">
          {(labels?.pace ?? PACE)({
            drift,
            endsAt: status.endsAt === null ? null : time.format(status.endsAt),
          })}
        </p>
      ) : null}

      {status.item?.notes ? (
        <div data-slot="agenda-notes" className="bg-muted/60 rounded-lg p-4">
          <p className="text-muted-foreground mb-1 text-xs font-medium">{labels?.notes ?? 'Notes'}</p>
          <p className="text-sm whitespace-pre-line">{status.item.notes}</p>
        </div>
      ) : null}

      <div data-slot="agenda-controls" className="flex flex-wrap gap-2">
        {phase === 'before' ? (
          <Button size="lg" disabled={items.length === 0} onClick={() => onEvent({ type: 'start', at: Date.now() })}>
            <Play aria-hidden />
            {labels?.start ?? 'Start'}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              disabled={index < 1}
              onClick={() => onEvent({ type: 'back', from: index, at: Date.now() })}
            >
              <ChevronLeft aria-hidden className="rtl:rotate-180" />
              {labels?.back ?? 'Back'}
            </Button>
            {phase !== 'finished' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => onEvent({ type: phase === 'paused' ? 'resume' : 'pause', at: Date.now() })}
                >
                  {phase === 'paused' ? <Play aria-hidden /> : <Pause aria-hidden />}
                  {phase === 'paused' ? (labels?.resume ?? 'Resume') : (labels?.pause ?? 'Pause')}
                </Button>
                <Button variant="outline" onClick={() => onEvent({ type: 'extend', minutes: 1 })}>
                  <Plus aria-hidden />
                  {labels?.extend ?? 'Add a minute'}
                </Button>
                <Button className="ms-auto" onClick={() => onEvent({ type: 'next', from: index, at: Date.now() })}>
                  {isLast ? (labels?.finish ?? 'Finish') : (labels?.forward ?? 'Next')}
                  <ChevronRight aria-hidden className="rtl:rotate-180" />
                </Button>
              </>
            ) : null}
          </>
        )}
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium">{labels?.list ?? 'Running order'}</p>
        <ol data-slot="agenda-list" className="grid gap-1">
          {items.map((it, i) => {
            const done = i < index;
            const on = i === index;
            const spent = state.spent[it.id];
            return (
              <li
                key={it.id}
                aria-current={on ? 'step' : undefined}
                data-state={done ? 'done' : on ? 'current' : 'upcoming'}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm motion-safe:transition-colors motion-safe:duration-(--duration-base)',
                  on ? 'bg-primary/10 text-foreground font-medium' : done ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                <span aria-hidden className="grid size-5 shrink-0 place-items-center">
                  {done ? (
                    <Check className="size-4" />
                  ) : (
                    <span className={cn('size-2 rounded-full', on ? 'bg-primary' : 'bg-foreground/30')} />
                  )}
                </span>
                <span className="min-w-0 flex-1">{it.title}</span>
                <span className="text-muted-foreground tabular-nums">
                  {done && spent !== undefined ? formatClock(spent) : minutes(it.minutes + (state.extra[it.id] ?? 0))}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <span data-slot="agenda-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </section>
  );
}
Agenda.displayName = 'Agenda';

// --- AgendaNow (room) ------------------------------------------------------------

type AgendaNowProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  items: readonly AgendaItem[];
  state: AgendaState;
  /** Show the session at this moment and stop the clock. */
  frozenAt?: number;
  /** Hide the time left from the room. @default true */
  showTime?: boolean;
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
  labels?: Pick<AgendaLabels, 'now' | 'next' | 'before' | 'finished' | 'paused' | 'clock'>;
};

function AgendaNow({
  items,
  state,
  frozenAt,
  showTime = true,
  size = 'default',
  labels,
  className,
  ...props
}: AgendaNowProps) {
  const reduced = useReducedMotion();
  const status = useAgendaClock(items, state, frozenAt);
  const { phase } = status;
  const stage = size === 'stage';
  const title =
    phase === 'finished' ? (labels?.finished ?? "That's all") : (status.item?.title ?? status.next?.title ?? '');
  const eyebrow =
    phase === 'before' ? (labels?.before ?? 'Starting soon') : phase === 'finished' ? '' : (labels?.now ?? 'Now');
  return (
    <div
      data-slot="agenda-now-screen"
      data-phase={phase}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-2', stage && 'gap-4', className)}
      {...props}
    >
      {eyebrow ? (
        <p className={cn('text-muted-foreground font-medium', stage ? 'text-lg' : 'text-sm')}>{eyebrow}</p>
      ) : null}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className={cn('font-heading font-semibold text-balance', stage ? 'text-h1' : 'text-2xl')}>
          <Rise id={status.item?.id} reduced={reduced}>
            {title}
          </Rise>
        </p>
        {showTime && status.item ? (
          <p
            role="timer"
            aria-label={labels?.clock ?? 'Time left'}
            className={cn('text-muted-foreground font-semibold tabular-nums', stage ? 'text-4xl' : 'text-xl')}
          >
            {phase === 'paused' ? (labels?.paused ?? 'Paused') : formatClock(Math.max(0, status.leftMs))}
          </p>
        ) : null}
      </div>
      {phase !== 'before' && status.next ? (
        <p className={cn('text-muted-foreground', stage ? 'text-lg' : 'text-sm')}>
          {labels?.next ?? 'Up next'}: <span className="text-foreground">{status.next.title}</span>
        </p>
      ) : null}
    </div>
  );
}
AgendaNow.displayName = 'AgendaNow';

export { Agenda, AgendaNow };
export type { AgendaProps, AgendaNowProps, AgendaLabels };
