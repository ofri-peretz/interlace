'use client';

/**
 * @interlace/ui — PresenterNotes, useAgenda
 *
 * The presenter's own view of a session: the notes for the section being presented, an agenda with
 * the time planned and the time used for each section, a clock for the section and a gentle signal
 * when it runs over. It is made for a second screen (a laptop beside the projector, a tablet on
 * the lectern) and works on the same screen too. Nothing here reaches the audience: the notes
 * travel only between the presenter's own windows.
 *
 * The rules are `games/agenda-model`. `useAgenda` keeps one window in control and any number
 * showing the same agenda over a `RoomTransport<AgendaMessage>` (a `BroadcastChannel` for two
 * windows on one device: `createBroadcastRoomTransport<AgendaMessage>('agenda')`).
 *
 * ## States
 *
 * | Status  | What the screen shows                                   | Leaves by                                  |
 * | ------- | ------------------------------------------------------- | ------------------------------------------ |
 * | idle    | the first section's notes, "Start"                      | Start (or Next) → running                  |
 * | running | the clock counting, Pause, Next, Previous, +1 min       | Pause → paused; Next on the last → done    |
 * | paused  | the clock stopped, "Resume"                             | Resume → running                           |
 * | done    | the session total against its plan, "Start again"      | Start again → idle                         |
 *
 * ## Anatomy
 *
 *   PresenterNotes                 (section — data-slot="presenter-notes", data-status, data-tier)
 *     ├─ header                    (p "Section 2 of 5", h2 the title: data-slot="presenter-notes-title")
 *     ├─ div role="timer"          (data-slot="presenter-notes-clock": used of planned)
 *     │   ├─ span                  (data-slot="presenter-notes-pace": "On time", "Nearly out of time", "1:05 over")
 *     │   └─ span aria-hidden      (data-slot="presenter-notes-bar": how much of the plan is used)
 *     ├─ div role="region"         (data-slot="presenter-notes-body": the notes, scrolls, focusable)
 *     ├─ div role="group"          (data-slot="presenter-notes-controls": Previous, Start/Pause, Next, +1 min)
 *     ├─ ol                        (data-slot="presenter-notes-agenda": a button per section)
 *     ├─ p                         (data-slot="presenter-notes-total": total used against plan)
 *     ├─ details                   (data-slot="presenter-notes-keys": shortcuts, and a switch to turn them off)
 *     └─ span aria-live            (data-slot="presenter-notes-announce")
 *
 * ## Keyboard
 *
 * | Key                | Does                                        |
 * | ------------------ | ------------------------------------------- |
 * | Space              | start, pause or resume                      |
 * | → or N             | next section                                |
 * | ← or P             | previous section                            |
 * | + or =             | add a minute to this section                |
 *
 * Shortcuts ignore keys typed in a field and Space on a button, and a key held down does one
 * step. Single-letter shortcuts can be switched off in the panel (WCAG 2.1.4). Every action is
 * also a button.
 *
 * ## Over time, gently
 *
 * `ok` below 80% of the plan, `near` to the plan, `over` after it. It is shown in words ("1:05
 * over") and a calm border colour, never a flash or a sound, and spoken once on each crossing.
 *
 * ## Motion
 *
 * The bar moves with a linear transition; the preflight and `useReducedMotion` remove it under
 * reduced motion, and the numbers tell everything the bar does.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `section` props                                      |
 * | R6   | data-slot per part        | presenter-notes-*                                    |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans       | `size`                                               |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R25  | Client component          | the clock and the keys                               |
 * | R26  | A11y                      | landmark, labelled controls, one sparse live region  |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { Kbd } from '../primitives/kbd.js';
import {
  acceptIntent,
  agendaProgress,
  applyAgendaEvent,
  formatClock,
  type AgendaEvent,
  type AgendaMessage,
  type AgendaState,
  type PaceTier,
} from './agenda-model.js';
import { clockOffset, type RoomTransport } from './room-model.js';

export const MIN_VIEWPORT = 320 as const;

// --- useAgenda ------------------------------------------------------------------

export interface UseAgendaOptions {
  /** How the windows talk. null while connecting, or for one window alone. */
  transport: RoomTransport<AgendaMessage> | null;
  /** The agenda to control from. Present: this window controls. Absent: it shows what the controlling window sends. */
  initial?: AgendaState;
  /** This window's clock. The controlling window's clock times everything. @default Date.now */
  now?: () => number;
  /** The controlling window's agenda changed: keep it (see `createAgendaStore`). */
  onChange?: (agenda: AgendaState) => void;
}

export interface UseAgendaResult {
  /** The agenda as this window knows it. null on a second screen until the controlling window answers. */
  agenda: AgendaState | null;
  /** True in the controlling window. */
  controls: boolean;
  /** Apply (controlling window) or ask the controlling window to apply (second screen). */
  send: (event: AgendaEvent) => void;
  /** This window's clock, corrected to the controlling window's: pass it as `now` to `PresenterNotes`. */
  now: () => number;
}

const OFFSET_WINDOW_MS = 60_000;
const REMEMBER_INTENTS = 200;
let counter = 0;
/** A unique id for a window's run or a tap: a UUID where the browser has one, else the time and a count. */
const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function useAgenda({ transport, initial, now = Date.now, onChange }: UseAgendaOptions): UseAgendaResult {
  const controls = initial !== undefined;
  const [agenda, setAgenda] = React.useState<AgendaState | null>(initial ?? null);
  const ref = React.useRef<AgendaState | null>(initial ?? null);
  const latest = React.useRef({ now, onChange });
  latest.current = { now, onChange };
  const session = React.useRef(uid());
  const heldSession = React.useRef<string | null>(null);
  const applied = React.useRef<Set<string>>(new Set());
  const samples = React.useRef<{ at: number; local: number }[]>([]);
  const offset = React.useRef(0);

  const publish = React.useCallback(
    (next: AgendaState) => {
      ref.current = next;
      setAgenda(next);
      latest.current.onChange?.(next);
      transport?.send({ kind: 'agenda-state', state: next, at: latest.current.now(), session: session.current });
    },
    [transport],
  );

  const apply = React.useCallback(
    (event: AgendaEvent) => {
      const current = ref.current;
      if (!current) return;
      const next = applyAgendaEvent(current, event, latest.current.now());
      if (next !== current) publish(next);
    },
    [publish],
  );

  React.useEffect(() => {
    if (!transport) return;
    const tell = () => {
      if (ref.current) transport.send({ kind: 'agenda-state', state: ref.current, at: latest.current.now(), session: session.current });
    };
    const off = transport.subscribe((message) => {
      if (controls) {
        if (message.kind === 'agenda-hello') tell();
        else if (message.kind === 'agenda-intent') {
          const current = ref.current;
          if (!current) return;
          if (acceptIntent(current, message, applied.current)) {
            applied.current.add(message.id);
            if (applied.current.size > REMEMBER_INTENTS) applied.current.delete(applied.current.values().next().value as string);
            apply(message.event);
          } else if (!applied.current.has(message.id)) tell(); // made against an older screen: bring it up to date
        }
        return;
      }
      if (message.kind !== 'agenda-state') return;
      const local = Date.now();
      samples.current = [...samples.current.filter((s) => local - s.local < OFFSET_WINDOW_MS), { at: message.at, local }];
      offset.current = clockOffset(samples.current);
      const current = ref.current;
      // A new run of the controlling window is followed whatever its seq; within one run only a newer state counts.
      if (current && heldSession.current === message.session && message.state.seq <= current.seq) return;
      heldSession.current = message.session;
      ref.current = message.state;
      setAgenda(message.state);
    });
    if (controls) tell();
    else transport.send({ kind: 'agenda-hello' });
    return off;
  }, [transport, controls, apply]);

  const send = React.useCallback(
    (event: AgendaEvent) => {
      if (controls) return apply(event);
      const current = ref.current;
      if (current && transport) transport.send({ kind: 'agenda-intent', id: uid(), seq: current.seq, event });
    },
    [controls, apply, transport],
  );

  const corrected = React.useCallback(() => (controls ? latest.current.now() : Date.now() + offset.current), [controls]);
  return { agenda, controls, send, now: corrected };
}

// --- PresenterNotes -------------------------------------------------------------

export interface PresenterNotesLabels {
  /** Names the landmark. @default 'Presenter notes' */
  name?: string;
  /** @default (n, total) => `Section ${n} of ${total}` */
  position?: (n: number, total: number) => string;
  /** Names the clock. @default 'Time in this section' */
  clock?: string;
  /** @default (planned) => `of ${planned} planned` */
  planned?: (planned: string) => string;
  /** When a section has no planned time. @default 'no time planned' */
  unplanned?: string;
  /** @default 'Not started' */
  idle?: string;
  /** @default 'On time' */
  ok?: string;
  /** @default 'Paused' */
  paused?: string;
  /** @default 'Nearly out of time' */
  near?: string;
  /** @default (over) => `${over} over` */
  over?: (over: string) => string;
  /** @default 'Notes' */
  notes?: string;
  /** Shown when a section has no notes. @default 'No notes for this section.' */
  noNotes?: string;
  /** @default 'Agenda controls' */
  controls?: string;
  /** @default 'Previous' */
  previous?: string;
  /** @default 'Start' */
  start?: string;
  /** @default 'Pause' */
  pause?: string;
  /** @default 'Resume' */
  resume?: string;
  /** @default 'Start again' */
  again?: string;
  /** @default 'Next' */
  next?: string;
  /** On the last section. @default 'Finish' */
  finish?: string;
  /** @default 'Add a minute' */
  addMinute?: string;
  /** Names the agenda list. @default 'Agenda' */
  agenda?: string;
  /** @default 'Done' */
  done?: string;
  /** @default 'Now' */
  now?: string;
  /** @default 'Later' */
  later?: string;
  /** @default (used, planned) => `${used} used of ${planned}` */
  used?: (used: string, planned: string) => string;
  /** The session line. @default (used, planned, drift, behind) => `Total ${used} of ${planned} planned. ${behind} behind plan.` (or "On plan.") */
  total?: (used: string, planned: string, drift: number, behind: string) => string;
  /** @default 'Keyboard shortcuts' */
  keys?: string;
  /** @default 'Use keyboard shortcuts' */
  keysSwitch?: string;
  /** @default 'Start, pause or resume' */
  keyToggle?: string;
  /** @default 'Next section' */
  keyNext?: string;
  /** @default 'Previous section' */
  keyPrevious?: string;
  /** @default 'Add a minute' */
  keyMinute?: string;
  /** @default (title, n, total) => `Now: ${title}. Section ${n} of ${total}.` */
  moved?: (title: string, n: number, total: number) => string;
  /** @default (title) => `${title}: nearly out of time` */
  nearSaid?: (title: string) => string;
  /** @default (title, over) => `${title}: ${over} over time` */
  overSaid?: (title: string, over: string) => string;
  /** @default 'The agenda is complete.' */
  doneSaid?: string;
}

type PresenterNotesProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  agenda: AgendaState;
  /** `send` from `useAgenda`. */
  send: (event: AgendaEvent) => void;
  /** This window's clock, corrected to the controlling window's (`useAgenda`'s `now`). @default Date.now */
  now?: () => number;
  /** Keys work (until the presenter switches them off in the panel). @default true */
  shortcuts?: boolean;
  /** `stage` sets the notes large, for a second screen read at a distance. @default 'default' */
  size?: 'default' | 'stage';
  labels?: PresenterNotesLabels;
};

const TIER_BORDER: Record<PaceTier, string> = {
  ok: 'border-border',
  near: 'border-caution',
  over: 'border-warning',
};

/** True for a field where typing is typing, not a command. */
function isTyping(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || typeof node.tagName !== 'string') return false;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName) || node.isContentEditable) return true;
  return ['textbox', 'combobox', 'searchbox', 'spinbutton', 'slider', 'listbox'].includes(node.getAttribute('role') ?? '');
}

/** True for a control that Space presses. */
function isPressable(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || typeof node.tagName !== 'string') return false;
  return ['BUTTON', 'A', 'SUMMARY'].includes(node.tagName) || ['button', 'link', 'tab', 'menuitem'].includes(node.getAttribute('role') ?? '');
}

function PresenterNotes({
  agenda,
  send,
  now = Date.now,
  shortcuts = true,
  size = 'default',
  labels,
  className,
  ...props
}: PresenterNotesProps) {
  const L = labels ?? {};
  const reduced = useReducedMotion();
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  const [keysOn, setKeysOn] = React.useState(shortcuts);
  const [announce, setAnnounce] = React.useState('');
  const keysId = React.useId();
  const t = now();
  const progress = agendaProgress(agenda, t);
  const current = progress.current;
  const total = agenda.sections.length;
  const section = agenda.sections[agenda.current];
  const running = agenda.status === 'running';
  const latest = React.useRef({ agenda, send });
  latest.current = { agenda, send };

  // Re-render on each whole second while the clock runs.
  React.useEffect(() => {
    if (!running) return;
    const id = setTimeout(tick, 1000 - (now() % 1000) + 5);
    return () => clearTimeout(id);
  });

  // Keys: space, arrows, N, P and the plus key; never while typing, never repeated.
  React.useEffect(() => {
    if (!shortcuts || !keysOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const { agenda: a, send: go } = latest.current;
      let event: AgendaEvent | null = null;
      if (e.key === ' ') {
        if (isPressable(e.target)) return;
        event = { type: a.status === 'idle' ? 'start' : a.status === 'running' ? 'pause' : 'resume' };
        if (a.status === 'done') event = null;
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n') event = { type: 'next' };
      else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'p') event = { type: 'previous' };
      else if (e.key === '+' || e.key === '=') event = { type: 'add-time', seconds: 60 };
      if (!event) return;
      e.preventDefault();
      go(event);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcuts, keysOn]);

  // Speak a move to another section, a crossing into near or over, and the end: never the first look.
  const index = agenda.current;
  const tier = current?.tier ?? 'ok';
  const status = agenda.status;
  const before = React.useRef<{ index: number; tier: PaceTier; status: string } | null>(null);
  React.useEffect(() => {
    const was = before.current;
    before.current = { index, tier, status };
    if (!was || !section) return;
    if (status === 'done' && was.status !== 'done') setAnnounce(L.doneSaid ?? 'The agenda is complete.');
    else if (index !== was.index) setAnnounce((L.moved ?? ((ti: string, n: number, tot: number) => `Now: ${ti}. Section ${n} of ${tot}.`))(section.title, index + 1, total));
    else if (tier !== was.tier && tier === 'near') setAnnounce((L.nearSaid ?? ((ti: string) => `${ti}: nearly out of time`))(section.title));
    else if (tier !== was.tier && tier === 'over')
      setAnnounce((L.overSaid ?? ((ti: string, over: string) => `${ti}: ${over} over time`))(section.title, formatClock(Math.max(0, (current?.delta ?? 0)))));
    // Words are read when the state changes, not when the labels object is rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, tier, status]);

  if (!section || !current) return null;

  const planned = formatClock(current.planned);
  const overBy = formatClock(Math.max(0, current.delta));
  const ratio = current.planned > 0 ? Math.min(1, current.elapsed / current.planned) : 0;
  const pace =
    agenda.status === 'idle'
      ? (L.idle ?? 'Not started')
      : agenda.status === 'paused'
        ? (L.paused ?? 'Paused')
        : current.tier === 'over'
          ? (L.over ?? ((o: string) => `${o} over`))(overBy)
          : current.tier === 'near'
            ? (L.near ?? 'Nearly out of time')
            : (L.ok ?? 'On time');
  const behind = formatClock(Math.abs(progress.drift));
  const primary =
    agenda.status === 'idle'
      ? { label: L.start ?? 'Start', event: { type: 'start' } as AgendaEvent }
      : agenda.status === 'running'
        ? { label: L.pause ?? 'Pause', event: { type: 'pause' } as AgendaEvent }
        : agenda.status === 'paused'
          ? { label: L.resume ?? 'Resume', event: { type: 'resume' } as AgendaEvent }
          : { label: L.again ?? 'Start again', event: { type: 'reset' } as AgendaEvent };
  const done = agenda.status === 'done';

  return (
    <section
      aria-label={L.name ?? 'Presenter notes'}
      data-slot="presenter-notes"
      data-status={agenda.status}
      data-tier={current.tier}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container flex flex-col gap-5', className)}
      {...props}
    >
      <header className="flex flex-col gap-1">
        <p data-slot="presenter-notes-position" className="text-muted-foreground text-sm font-semibold tabular-nums">
          {(L.position ?? ((n: number, tot: number) => `Section ${n} of ${tot}`))(index + 1, total)}
        </p>
        <h2 data-slot="presenter-notes-title" className="text-2xl font-semibold break-words">
          {section.title}
        </h2>
      </header>

      <div className="grid gap-5 @3xl:grid-cols-[3fr_2fr] @3xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <div
            role="timer"
            aria-label={L.clock ?? 'Time in this section'}
            data-slot="presenter-notes-clock"
            data-tier={current.tier}
            className={cn('bg-card text-card-foreground flex flex-col gap-2 rounded-xl border-2 p-4', TIER_BORDER[current.tier])}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span data-slot="presenter-notes-elapsed" className="text-4xl font-semibold tabular-nums">
                {formatClock(current.elapsed)}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {current.planned > 0 ? (L.planned ?? ((p: string) => `of ${p} planned`))(planned) : (L.unplanned ?? 'no time planned')}
              </span>
              <span data-slot="presenter-notes-pace" className="ms-auto text-sm font-semibold">
                {pace}
              </span>
            </div>
            <span aria-hidden data-slot="presenter-notes-bar" className="bg-muted block h-2 overflow-hidden rounded-full">
              <span
                className={cn(
                  'block h-full w-full origin-left rounded-full rtl:origin-right',
                  current.tier === 'over' ? 'bg-warning' : 'bg-primary',
                  reduced ? '' : 'transition-transform duration-1000 ease-linear',
                )}
                style={{ transform: `scaleX(${ratio})` }}
              />
            </span>
          </div>

          {/* A scrolling region must be reachable by keyboard so its notes can be read. */}
          <div
            role="region"
            aria-label={L.notes ?? 'Notes'}
            tabIndex={0}
            data-slot="presenter-notes-body"
            className={cn(
              'border-border bg-background max-h-[60vh] overflow-y-auto rounded-xl border p-4 leading-relaxed break-words whitespace-pre-line',
              'focus-visible:border-ring focus-visible:ring-ring outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              size === 'stage' ? 'text-2xl' : 'text-base',
            )}
          >
            {section.notes ? (
              section.notes
            ) : (
              <span className="text-muted-foreground">{L.noNotes ?? 'No notes for this section.'}</span>
            )}
          </div>

          <div role="group" aria-label={L.controls ?? 'Agenda controls'} data-slot="presenter-notes-controls" className="flex flex-wrap gap-2">
            <Button
              data-slot="presenter-notes-previous"
              type="button"
              variant="outline"
              aria-keyshortcuts="ArrowLeft P"
              disabled={agenda.status === 'idle' || (index === 0 && !done)}
              onClick={() => send({ type: 'previous' })}
            >
              {L.previous ?? 'Previous'}
            </Button>
            <Button
              data-slot="presenter-notes-primary"
              type="button"
              aria-keyshortcuts={done ? undefined : 'Space'}
              onClick={() => send(primary.event)}
            >
              {primary.label}
            </Button>
            <Button
              data-slot="presenter-notes-next"
              type="button"
              variant="outline"
              aria-keyshortcuts="ArrowRight N"
              disabled={done}
              onClick={() => send({ type: 'next' })}
            >
              {index === total - 1 && (running || agenda.status === 'paused') ? (L.finish ?? 'Finish') : (L.next ?? 'Next')}
            </Button>
            <Button
              data-slot="presenter-notes-minute"
              type="button"
              variant="ghost"
              aria-keyshortcuts="+"
              onClick={() => send({ type: 'add-time', seconds: 60 })}
            >
              {L.addMinute ?? 'Add a minute'}
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <ol aria-label={L.agenda ?? 'Agenda'} data-slot="presenter-notes-agenda" className="flex list-none flex-col gap-1.5 p-0">
            {progress.sections.map((s) => (
              <li key={s.id} data-slot="presenter-notes-section" data-status={s.status} data-tier={s.tier}>
                <button
                  type="button"
                  aria-current={s.status === 'current' ? 'step' : undefined}
                  onClick={() => send({ type: 'goto', index: s.index })}
                  className={cn(
                    'flex w-full min-w-0 flex-col gap-0.5 rounded-lg border p-3 text-start outline-none',
                    'focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    s.status === 'current' ? cn('bg-card border-2', TIER_BORDER[s.tier]) : 'border-border hover:bg-muted',
                    s.status === 'done' && 'text-muted-foreground',
                  )}
                >
                  <span className="flex min-w-0 items-baseline justify-between gap-2">
                    <span className={cn('truncate text-sm', s.status === 'current' && 'font-semibold')}>{s.title}</span>
                    <span className="shrink-0 text-xs font-semibold">
                      {s.status === 'done' ? (L.done ?? 'Done') : s.status === 'current' ? (L.now ?? 'Now') : (L.later ?? 'Later')}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {(L.used ?? ((u: string, p: string) => `${u} used of ${p}`))(formatClock(s.elapsed), formatClock(s.planned))}
                    {s.status !== 'upcoming' && s.delta > 0 ? ` · +${formatClock(s.delta)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p data-slot="presenter-notes-total" className="text-muted-foreground text-sm tabular-nums">
            {(L.total ??
              ((used: string, plan: string, drift: number, by: string) =>
                `Total ${used} of ${plan} planned. ${drift > 0 ? `${by} behind plan.` : 'On plan.'}`))(
              formatClock(progress.elapsedTotal),
              formatClock(progress.plannedTotal),
              progress.drift,
              behind,
            )}
          </p>
        </div>
      </div>

      {shortcuts ? (
        <details data-slot="presenter-notes-keys" className="text-sm">
          <summary className="cursor-pointer font-medium">{L.keys ?? 'Keyboard shortcuts'}</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5">
            <dt>
              <Kbd>Space</Kbd>
            </dt>
            <dd>{L.keyToggle ?? 'Start, pause or resume'}</dd>
            <dt className="flex gap-1">
              <Kbd aria-label="Right arrow">→</Kbd>
              <Kbd>N</Kbd>
            </dt>
            <dd>{L.keyNext ?? 'Next section'}</dd>
            <dt className="flex gap-1">
              <Kbd aria-label="Left arrow">←</Kbd>
              <Kbd>P</Kbd>
            </dt>
            <dd>{L.keyPrevious ?? 'Previous section'}</dd>
            <dt>
              <Kbd>+</Kbd>
            </dt>
            <dd>{L.keyMinute ?? 'Add a minute'}</dd>
          </dl>
          <label htmlFor={keysId} className="mt-3 flex items-center gap-2">
            <input id={keysId} type="checkbox" checked={keysOn} onChange={(e) => setKeysOn(e.target.checked)} />
            {L.keysSwitch ?? 'Use keyboard shortcuts'}
          </label>
        </details>
      ) : null}

      <span data-slot="presenter-notes-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </section>
  );
}
PresenterNotes.displayName = 'PresenterNotes';

export { PresenterNotes };
export type { PresenterNotesProps };
