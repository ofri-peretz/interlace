'use client';

/**
 * @interlace/ui — GettingStarted
 *
 * A short list of things a person should do before an app is useful to them: the steps, how far
 * along they are, what to do next, and a small, honest reward when they finish one. The steps are
 * data the app passes (`ChecklistDef`); nothing here knows what they are about. Progress counts
 * required steps only, a missed day is never framed as a loss, and every celebration has a still
 * form that says the same thing in words.
 * Inspiration: the setup checklists of Intercom and Stripe's dashboard; unlike them there is no
 * overlay, no tour and no coach mark, and the list is JSON an agent can write.
 *
 * ## Flow
 *
 * | Phase     | What shows                                             | Leaves by                                      |
 * | --------- | ------------------------------------------------------ | ---------------------------------------------- |
 * | loading   | the list's shell, titles as skeletons (`aria-busy`)    | the store's `load` settles                     |
 * | active    | steps, progress, pace, the next step open              | the person does the last required step         |
 * | complete  | "All set" in words (and a burst with `celebrate="full"`) | Hide (with `dismissible`), or un-ticking a step |
 * | dismissed | nothing but the live region                            | Show again by the app                          |
 *
 * ## Anatomy
 *
 *   GettingStarted                 (section — data-slot="getting-started", data-state, data-motion)
 *     ├─ GettingStartedHeader      (data-slot="getting-started-header")
 *     │   ├─ h2                    (data-slot="getting-started-title")
 *     │   ├─ Progress              (data-slot="getting-started-progress": "3 of 7 steps done")
 *     │   ├─ p                     (data-slot="getting-started-pace")
 *     │   ├─ p                     (data-slot="getting-started-streak": only with `streak`)
 *     │   └─ p role=status         (data-slot="getting-started-save": empty until a save fails)
 *     ├─ GettingStartedList        (a steps list, or one `GettingStartedGroup` per group; data-slot="getting-started-list")
 *     │   └─ GettingStartedStep    (li — data-slot="getting-started-step", data-state=todo|done|skipped|locked|next)
 *     ├─ GettingStartedCelebration (data-slot="getting-started-celebration", role=status)
 *     │   └─ span aria-hidden      (data-slot="getting-started-burst": `full` only, never under reduced motion)
 *     └─ p aria-live=polite        (data-slot="getting-started-announce", sr-only)
 *
 * With no children the section renders that arrangement from `definition`. Children replace it, and
 * `GettingStartedHeader`, `GettingStartedGroup`, `GettingStartedStep` and `GettingStartedCelebration`
 * read the same context.
 *
 * ## State
 *
 * Controlled (`value` and `onValueChange`) or uncontrolled with a `store` (`load`, `save`, optional
 * `subscribe`; see `getting-started-store`). A change updates the page first; the save follows, 300ms
 * debounced, flushed on `pagehide`. A failed save keeps the state on the page, says so once, and
 * retries at 2s, 8s and 30s. Another tab's snapshot is merged in (never overwritten) and is silent:
 * a celebration is a transition made here, and a reload, a merge and a re-tick never repeat one.
 *
 * ## Keyboard
 *
 * | Input                         | Result                                                              |
 * | ----------------------------- | ------------------------------------------------------------------- |
 * | Tab                           | each step's checkbox, its title, Skip and action, in reading order  |
 * | Space on a checkbox           | toggles the step                                                    |
 * | Space or Enter, step locked   | nothing toggles; the live region says what it waits for; focus stays |
 * | Enter or Space on a title     | opens or closes the step                                            |
 *
 * A locked step is `aria-disabled` and focusable, not `disabled`: a disabled control is skipped by
 * the keyboard and unexplained to a screen reader. Its reason is visible text.
 *
 * ## Motion
 *
 * The tick scales in once (200ms, `motion-safe:`), the bar fills on `--duration-medium`, and with
 * `celebrate="full"` a 1.2s burst plays once. Under reduced motion all of it is still: the burst is
 * not mounted, and the banner says the same in words.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                           |
 * | ---- | ------------------------- | ------------------------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentPropsWithoutRef<'section'>`                  |
 * | R5   | data-testid               | required prop                                                |
 * | R6   | data-slot per part        | getting-started / -header / -title / -progress / -pace / -streak / -save / -list / -step / -reason / -skip / -celebration / -burst / -announce |
 * | R8   | Booleans default false    | `dismissible`                                                |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onValueChange`                   |
 * | R11  | Slots                     | `action`, `children`                                         |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                         |
 * | R24  | Neutral                   | no product nouns in props or defaults                        |
 * | R26  | A11y                      | locked steps explain themselves, one polite region, words with every state |
 */

import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { ArrowRight, Check, ChevronDown, Lock, Minus } from 'lucide-react';
import * as React from 'react';

import { dayKey } from './daily.js';
import { summarizeStreak, type RestRule } from './streak-model.js';
import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Accordion, AccordionContent, AccordionItem } from '../primitives/accordion.js';
import { Button } from '../primitives/button.js';
import { Checkbox } from '../primitives/checkbox.js';
import { Progress, ProgressIndicator, ProgressTrack } from '../primitives/progress.js';
import {
  announcementFor,
  celebrationsFor,
  complete,
  deriveChecklist,
  emptySnapshot,
  markCelebrated,
  mergeSnapshots,
  pace,
  parseSnapshot,
  setDismissed,
  skip,
  topCelebration,
  uncomplete,
  unskip,
  type AnnounceLabels,
  type Celebration,
  type ChecklistDef,
  type ChecklistSnapshot,
  type DerivedChecklist,
  type DerivedStep,
  type Pace,
  type StepDef,
} from './getting-started-model.js';
import type { ChecklistStore } from './getting-started-store.js';

export const MIN_VIEWPORT = 320 as const;

const Burst = React.lazy(() => import('./getting-started-burst.js'));

export type ChecklistChange =
  | { type: 'complete' | 'uncomplete' | 'skip' | 'unskip'; stepId: string }
  | { type: 'dismiss' | 'restore' }
  /** From `subscribe`, not the person. */
  | { type: 'merge' };

export interface GettingStartedLabels extends AnnounceLabels {
  /** @default 'Getting started' */
  title?: string;
  /** Names the progress bar's value. @default (done, total) => `${done} of ${total} steps done` */
  progress?: (done: number, total: number) => string;
  /** The pace line. @default English: '5 steps left, 4 days to go. On track.' */
  pace?: (pace: Pace) => string;
  /** The streak line. @default English: '3 days in a row' */
  streak?: (status: 'played' | 'pending' | 'resting', days: number) => string;
  /** Why a step cannot be done yet. @default (waits) => `Finish ${waits} first` */
  locked?: (waits: string) => string;
  /** Said when a locked step is pressed. @default (waits) => `${waits} first, then this step.` */
  lockedSaid?: (waits: string) => string;
  /** @default 'Done' */
  done?: string;
  /** @default 'Skipped' */
  skippedState?: string;
  /** @default 'Locked' */
  lockedState?: string;
  /** @default 'Next' */
  next?: string;
  /** @default 'Optional' */
  optional?: string;
  /** @default 'Skip' */
  skip?: string;
  /** For a skipped step. @default 'Do this step' */
  unskip?: string;
  /** The finish banner. @default 'All set. You are ready.' */
  allSet?: string;
  /** A milestone line. @default (percent) => `${percent} percent of the way.` */
  milestoneLine?: (percent: number) => string;
  /** A group's count. @default (done, total) => `${done} of ${total}` */
  groupCount?: (done: number, total: number) => string;
  /** @default 'Hide' */
  hide?: string;
  /** @default 'Checklist hidden' */
  hidden?: string;
  /** @default 'Not saved yet. Your progress is kept on this page.' */
  saveFailed?: string;
  /** @default 'Could not load your saved progress.' */
  loadFailed?: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const PACE: NonNullable<GettingStartedLabels['pace']> = ({ state, stepsLeft, daysLeft }) => {
  const left = `${plural(stepsLeft, 'step', 'steps')} left`;
  if (state === 'none' || state === 'done') return '';
  if (state === 'overdue') return `${left}. The date has passed.`;
  return `${left}, ${plural(daysLeft, 'day', 'days')} to go. ${state === 'on-track' ? 'On track.' : 'A little behind.'}`;
};

const STREAK: NonNullable<GettingStartedLabels['streak']> = (status, days) => {
  const d = plural(days, 'day', 'days');
  return status === 'played'
    ? `${d} in a row`
    : status === 'pending'
      ? `Do one step today to keep your ${d} going`
      : `Rest day. Your ${d} are safe`;
};

// --- Context ---------------------------------------------------------------------------

interface Ctx {
  def: ChecklistDef;
  snapshot: ChecklistSnapshot;
  derived: DerivedChecklist;
  labels: GettingStartedLabels;
  titleId: string;
  reduced: boolean;
  celebrate: 'off' | 'quiet' | 'full';
  shown: Celebration | null;
  loading: boolean;
  statusLine: string;
  announce: string;
  paceInfo: Pace;
  streakLine: string;
  dismissible: boolean;
  open: string[];
  setOpen: (open: string[]) => void;
  act: (change: ChecklistChange) => void;
  hide: (root: HTMLElement | null) => void;
}

const GettingStartedContext = React.createContext<Ctx | null>(null);

function useGettingStarted(part: string): Ctx {
  const ctx = React.useContext(GettingStartedContext);
  if (!ctx) throw new Error(`${part} must be used inside <GettingStarted>.`);
  return ctx;
}

const stepOf = (ctx: Ctx, id: string): { def: StepDef; state: DerivedStep } | null => {
  const def = ctx.def.steps.find((s) => s.id === id);
  const state = ctx.derived.steps.find((s) => s.id === id);
  return def && state ? { def, state } : null;
};

// --- Root ------------------------------------------------------------------------------

export interface GettingStartedProps
  extends Omit<React.ComponentPropsWithoutRef<'section'>, 'onChange' | 'defaultValue'> {
  'data-testid': string;
  definition: ChecklistDef;
  value?: ChecklistSnapshot;
  defaultValue?: ChecklistSnapshot;
  onValueChange?: (snapshot: ChecklistSnapshot, change: ChecklistChange) => void;
  /** Persistence. With `value` set, the app persists and `store` is ignored. */
  store?: ChecklistStore;
  /** Fires once per celebration, at the moment it happens, never on load. */
  onCelebrate?: (celebration: Celebration) => void;
  /** @default 'quiet' */
  celebrate?: 'off' | 'quiet' | 'full';
  /** Shows days in a row. Absent: no streak anywhere. */
  streak?: { rest?: RestRule };
  /** The date the list is for, ms. Enables the pace line. */
  dueAt?: number;
  /** Steps the person can finish a day, for the pace. @default 2 */
  capacityPerDay?: number;
  /** Lets the person hide the list once it is complete. @default false */
  dismissible?: boolean;
  /** Which steps start open. @default 'next' */
  defaultOpen?: 'next' | 'none' | 'all';
  labels?: GettingStartedLabels;
  /** The clock. @default Date.now */
  now?: () => number;
  /** For day keys. @default the browser's */
  timeZone?: string;
}

const SAVE_DEBOUNCE_MS = 300;
const SAVE_RETRY_MS = [2000, 8000, 30000] as const;
const ANNOUNCE_COALESCE_MS = 400;

function GettingStarted({
  definition: def,
  value,
  defaultValue,
  onValueChange,
  store,
  onCelebrate,
  celebrate = 'quiet',
  streak,
  dueAt,
  capacityPerDay = 2,
  dismissible = false,
  defaultOpen = 'next',
  labels = {},
  now = Date.now,
  timeZone,
  className,
  children,
  ...props
}: GettingStartedProps) {
  const reduced = useReducedMotion();
  const titleId = React.useId();
  const controlled = value !== undefined;
  const clock = React.useRef(now);
  clock.current = now;
  const latest = React.useRef({ onValueChange, onCelebrate, def, labels, timeZone, celebrate });
  latest.current = { onValueChange, onCelebrate, def, labels, timeZone, celebrate };

  const [internal, setInternal] = React.useState<ChecklistSnapshot>(() => defaultValue ?? emptySnapshot());
  const snapshot = controlled ? value : internal;
  const snapRef = React.useRef(snapshot);
  snapRef.current = snapshot;
  const derived = React.useMemo(() => deriveChecklist(def, snapshot), [def, snapshot]);

  const [loading, setLoading] = React.useState(!!store && !controlled);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [saveFailed, setSaveFailed] = React.useState(false);
  const [shown, setShown] = React.useState<Celebration | null>(null);
  const [announce, setAnnounce] = React.useState({ text: '', n: 0 });
  const [open, setOpen] = React.useState<string[]>(() => {
    const d = deriveChecklist(def, snapshot);
    return defaultOpen === 'all' ? def.steps.map((s) => s.id) : defaultOpen === 'next' && d.next ? [d.next] : [];
  });
  const rootRef = React.useRef<HTMLElement>(null);

  // One polite message at most per change, coalesced; the same text twice still reads twice.
  const said = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = React.useCallback((text: string | null) => {
    if (!text) return;
    if (said.current) clearTimeout(said.current);
    said.current = setTimeout(() => setAnnounce((a) => ({ text, n: a.n + 1 })), ANNOUNCE_COALESCE_MS);
  }, []);

  // --- Saving ----------------------------------------------------------------------
  const saving = React.useRef<{ pending: ChecklistSnapshot | null; debounce: ReturnType<typeof setTimeout> | null; retry: ReturnType<typeof setTimeout> | null }>({
    pending: null,
    debounce: null,
    retry: null,
  });
  const storeRef = React.useRef(store);
  storeRef.current = store;
  const attempt = React.useCallback((next: ChecklistSnapshot, tries: number) => {
    const failed = () => {
      setSaveFailed(true);
      const delay = SAVE_RETRY_MS[tries];
      if (delay === undefined) return;
      saving.current.retry = setTimeout(() => attempt(snapRef.current, tries + 1), delay);
    };
    // Called at once, not on a later tick: on `pagehide` there may not be one.
    try {
      Promise.resolve(storeRef.current?.save(next)).then(() => setSaveFailed(false), failed);
    } catch {
      failed();
    }
  }, []);
  const flush = React.useCallback(() => {
    const s = saving.current;
    if (s.debounce) clearTimeout(s.debounce);
    s.debounce = null;
    const next = s.pending;
    s.pending = null;
    if (next) attempt(next, 0);
  }, [attempt]);
  const scheduleSave = React.useCallback(
    (next: ChecklistSnapshot) => {
      const s = saving.current;
      if (s.retry) clearTimeout(s.retry);
      s.retry = null;
      s.pending = next;
      if (s.debounce) clearTimeout(s.debounce);
      s.debounce = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );
  React.useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush();
      if (saving.current.retry) clearTimeout(saving.current.retry);
      if (said.current) clearTimeout(said.current);
    };
  }, [flush]);

  // --- Loading and other tabs --------------------------------------------------------
  React.useEffect(() => {
    if (!store || controlled) return;
    let alive = true;
    Promise.resolve()
      .then(() => store.load())
      .then(
        (raw) => {
          if (!alive) return;
          const loaded = parseSnapshot(raw, latest.current.def) ?? defaultValue ?? emptySnapshot();
          snapRef.current = loaded;
          setInternal(loaded);
          setLoading(false);
        },
        () => {
          if (!alive) return;
          setLoadFailed(true);
          setLoading(false);
        },
      );
    const off = store.subscribe?.((incoming) => {
      const parsed = parseSnapshot(incoming, latest.current.def);
      if (!parsed || !alive) return;
      const merged = mergeSnapshots(snapRef.current, parsed);
      if (JSON.stringify(merged) === JSON.stringify(snapRef.current)) return;
      snapRef.current = merged;
      setInternal(merged);
      latest.current.onValueChange?.(merged, { type: 'merge' });
    });
    return () => {
      alive = false;
      off?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, controlled]);

  const commit = React.useCallback(
    (next: ChecklistSnapshot, change: ChecklistChange) => {
      snapRef.current = next;
      if (!controlled) setInternal(next);
      latest.current.onValueChange?.(next, change);
      if (!controlled && storeRef.current) scheduleSave(next);
    },
    [controlled, scheduleSave],
  );

  const act = React.useCallback(
    (change: ChecklistChange) => {
      if (change.type === 'merge') return;
      const { def: d, labels: l, timeZone: tz } = latest.current;
      const prev = snapRef.current;
      const t = clock.current();
      let next = prev;
      if (change.type === 'complete') next = complete(d, prev, change.stepId, t, tz);
      else if (change.type === 'uncomplete') next = uncomplete(d, prev, change.stepId, t);
      else if (change.type === 'skip') next = skip(d, prev, change.stepId, t);
      else if (change.type === 'unskip') next = unskip(d, prev, change.stepId, t);
      else next = setDismissed(prev, change.type === 'dismiss', t);
      if (next === prev) {
        if (change.type === 'complete') {
          const step = deriveChecklist(d, prev).steps.find((s) => s.id === change.stepId);
          if (step?.state === 'locked') {
            const waits = step.lockedBy.map((id) => d.steps.find((s) => s.id === id)?.title ?? id).join(', ');
            say((l.lockedSaid ?? ((w) => `${w} first, then this step.`))(waits));
          }
        }
        return;
      }
      const celebrations = celebrationsFor(d, prev, next);
      next = markCelebrated(next, celebrations);
      commit(next, change);
      setShown(latest.current.celebrate === 'off' ? null : topCelebration(celebrations));
      for (const c of celebrations) latest.current.onCelebrate?.(c);
      if (change.type === 'dismiss') say(l.hidden ?? 'Checklist hidden');
      else if (change.type !== 'restore') say(announcementFor(d, prev, next, l));
    },
    [commit, say],
  );

  const hide = React.useCallback(
    (root: HTMLElement | null) => {
      // Focus moves to whatever follows the list, so it is not lost when the list leaves the layout.
      if (root) {
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
        );
        const after = focusable.find((el) => !root.contains(el) && root.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        after?.focus();
      }
      act({ type: 'dismiss' });
    },
    [act],
  );

  // --- Derived view state -------------------------------------------------------------
  const current = clock.current();
  const paceInfo = React.useMemo(
    () => pace(def, snapshot, current, dueAt, capacityPerDay, timeZone),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def, snapshot, dueAt, capacityPerDay, timeZone, Math.floor(current / 60_000)],
  );
  let streakLine = '';
  if (streak) {
    const s = summarizeStreak(snapshot.activeDays, dayKey(current, timeZone), streak.rest);
    if (s.status !== 'none' && s.current > 0) streakLine = (labels.streak ?? STREAK)(s.status, s.current);
  }
  const statusLine = saveFailed
    ? (labels.saveFailed ?? 'Not saved yet. Your progress is kept on this page.')
    : loadFailed
      ? (labels.loadFailed ?? 'Could not load your saved progress.')
      : '';
  const state = loading ? 'loading' : snapshot.dismissed ? 'dismissed' : derived.complete ? 'complete' : 'active';

  const ctx: Ctx = {
    def,
    snapshot,
    derived,
    labels,
    titleId,
    reduced,
    celebrate,
    shown,
    loading,
    statusLine,
    announce: announce.text + (announce.n % 2 ? ' ' : ''),
    paceInfo: { ...paceInfo },
    streakLine,
    dismissible,
    open,
    setOpen,
    act,
    hide,
  };

  return (
    <GettingStartedContext.Provider value={ctx}>
      <section
        ref={rootRef}
        aria-labelledby={titleId}
        aria-busy={loading || undefined}
        data-slot="getting-started"
        data-state={state}
        data-motion={reduced ? 'reduced' : 'full'}
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('@container grid gap-4', state === 'dismissed' && 'hidden', className)}
        {...props}
      >
        {state === 'dismissed' ? null : (
          <Accordion multiple value={open} onValueChange={(v) => setOpen(v as string[])} className="grid gap-4">
            {children ?? (
              <>
                <GettingStartedHeader />
                <GettingStartedList />
                <GettingStartedCelebration />
              </>
            )}
          </Accordion>
        )}
        <p data-slot="getting-started-announce" aria-live="polite" aria-atomic="true" className="sr-only">
          {ctx.announce}
        </p>
      </section>
    </GettingStartedContext.Provider>
  );
}
GettingStarted.displayName = 'GettingStarted';

// --- Header ----------------------------------------------------------------------------

function GettingStartedHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const ctx = useGettingStarted('GettingStartedHeader');
  const { derived, labels } = ctx;
  const words = (labels.progress ?? ((d, t) => `${d} of ${t} steps done`))(derived.doneCount, derived.total);
  const paceText = (labels.pace ?? PACE)(ctx.paceInfo);
  return (
    <div data-slot="getting-started-header" className={cn('grid gap-2', className)} {...props}>
      <h2 id={ctx.titleId} data-slot="getting-started-title" className="font-heading text-lg font-semibold">
        {labels.title ?? 'Getting started'}
      </h2>
      <Progress value={derived.percent} getAriaValueText={() => words} aria-labelledby={ctx.titleId} data-slot="getting-started-progress">
        <ProgressTrack size="md">
          <ProgressIndicator className="motion-safe:transition-[width] motion-safe:duration-(--duration-medium)" />
        </ProgressTrack>
      </Progress>
      <p className="text-muted-foreground text-sm">{words}</p>
      {paceText ? (
        <p data-slot="getting-started-pace" data-pace={ctx.paceInfo.state} className="text-sm">
          {paceText}
        </p>
      ) : null}
      {ctx.streakLine ? (
        <p data-slot="getting-started-streak" className="text-muted-foreground text-sm">
          {ctx.streakLine}
        </p>
      ) : null}
      <p data-slot="getting-started-save" role="status" className="text-warning-foreground text-sm empty:hidden">
        {ctx.statusLine}
      </p>
    </div>
  );
}
GettingStartedHeader.displayName = 'GettingStartedHeader';

// --- List, groups and steps --------------------------------------------------------------

function GettingStartedList() {
  const ctx = useGettingStarted('GettingStartedList');
  const { def, loading } = ctx;
  if (loading) {
    return (
      <div
        data-slot="getting-started-loading"
        aria-hidden
        className="grid gap-2"
        style={{ minHeight: `${def.steps.length * 3.5}rem` }}
      >
        {def.steps.map((s) => (
          <span key={s.id} className="bg-muted block h-12 rounded-lg motion-safe:animate-pulse" />
        ))}
      </div>
    );
  }
  const groups = def.groups ?? [];
  const loose = def.steps.filter((s) => !s.group);
  return (
    <div className="grid gap-4">
      {loose.length ? (
        <ol data-slot="getting-started-list" aria-labelledby={ctx.titleId} className="grid gap-2">
          {loose.map((s) => (
            <GettingStartedStep key={s.id} id={s.id} />
          ))}
        </ol>
      ) : null}
      {groups.map((g) => (
        <GettingStartedGroup key={g.id} id={g.id} />
      ))}
    </div>
  );
}

GettingStartedList.displayName = 'GettingStartedList';

function GettingStartedGroup({ id, children, className, ...props }: { id: string } & Omit<React.ComponentPropsWithoutRef<'div'>, 'id'>) {
  const ctx = useGettingStarted('GettingStartedGroup');
  const group = ctx.def.groups?.find((g) => g.id === id);
  const headId = `${ctx.titleId}-${id}`;
  const members = ctx.def.steps.filter((s) => s.group === id);
  const done = members.filter((s) => ctx.derived.steps.find((d) => d.id === s.id)?.state === 'done').length;
  if (!group) return null;
  return (
    <div data-slot="getting-started-group" className={cn('grid gap-2', className)} {...props}>
      <h3 id={headId} className="text-muted-foreground text-sm font-medium">
        {group.title} <span className="font-normal">· {(ctx.labels.groupCount ?? ((d, t) => `${d} of ${t}`))(done, members.length)}</span>
      </h3>
      <ol data-slot="getting-started-list" aria-labelledby={headId} className="grid gap-2">
        {children ?? members.map((s) => <GettingStartedStep key={s.id} id={s.id} />)}
      </ol>
    </div>
  );
}
GettingStartedGroup.displayName = 'GettingStartedGroup';

/**
 * The step's open/close control. The `Accordion` primitive's trigger is wrapped in a heading, which
 * would put a heading on every step under the group headings; a step is a list item, not a section,
 * so its header is a plain element and the title is the button's name.
 */
function StepTrigger({ children }: { children: React.ReactNode }) {
  return (
    <BaseAccordion.Header render={<div />} data-slot="getting-started-step-header" className="flex">
      <BaseAccordion.Trigger
        data-slot="getting-started-step-trigger"
        className="focus-visible:ring-ring flex min-h-11 flex-1 items-center justify-between gap-3 rounded-lg text-start text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&[data-panel-open]>svg]:rotate-180"
      >
        {children}
        <ChevronDown aria-hidden className="text-muted-foreground size-4 shrink-0 motion-safe:transition-transform" />
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  );
}

interface StepProps extends Omit<React.ComponentPropsWithoutRef<'li'>, 'id' | 'children'> {
  id: string;
  /** The app's own control into the step (a link, a button). Shown when the step is open. */
  action?: React.ReactNode;
  /** The open body; replaces `action`. */
  children?: React.ReactNode;
}

function GettingStartedStep({ id, action, children, className, ...props }: StepProps) {
  const ctx = useGettingStarted('GettingStartedStep');
  const found = stepOf(ctx, id);
  const uid = React.useId();
  if (!found) return null;
  const { def: step, state } = found;
  const { labels } = ctx;
  const done = state.state === 'done';
  const locked = state.state === 'locked';
  const skipped = state.state === 'skipped';
  const waits = state.lockedBy.map((w) => ctx.def.steps.find((s) => s.id === w)?.title ?? w).join(', ');
  const reason = locked ? (labels.locked ?? ((w) => `Finish ${w} first`))(waits) : '';
  const stateWord = done
    ? (labels.done ?? 'Done')
    : skipped
      ? (labels.skippedState ?? 'Skipped')
      : locked
        ? (labels.lockedState ?? 'Locked')
        : state.state === 'next'
          ? (labels.next ?? 'Next')
          : '';
  const describedBy = [step.description ? `${uid}-d` : '', locked ? `${uid}-r` : ''].filter(Boolean).join(' ') || undefined;
  const body = locked ? null : (children ?? action);
  return (
    <li
      data-slot="getting-started-step"
      data-state={state.state}
      data-step={id}
      className={cn('bg-card rounded-lg border px-3', state.state === 'next' && 'border-primary', className)}
      {...props}
    >
      <AccordionItem value={id} className="border-b-0">
        <div className="flex items-start gap-3 pt-3">
          <Checkbox
            checked={done}
            aria-labelledby={`${uid}-t`}
            aria-describedby={describedBy}
            aria-disabled={locked || undefined}
            onCheckedChange={(checked) => {
              if (locked) return ctx.act({ type: 'complete', stepId: id });
              ctx.act({ type: checked ? 'complete' : 'uncomplete', stepId: id });
            }}
            onKeyDown={(e) => {
              if (locked && e.key === 'Enter') ctx.act({ type: 'complete', stepId: id });
            }}
            className="mt-1 size-6 motion-safe:data-[checked]:animate-in motion-safe:data-[checked]:zoom-in-90"
          />
          <div className="grid min-w-0 flex-1">
            {body ? <StepTrigger>
              <span id={`${uid}-t`} className="flex flex-wrap items-center gap-x-2">
                <span className={cn(done && 'text-muted-foreground line-through')}>{step.title}</span>
                {step.optional ? <span className="text-muted-foreground text-xs font-normal">{labels.optional ?? 'Optional'}</span> : null}
                {stateWord ? (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-normal">
                    {done ? <Check aria-hidden className="size-3.5" /> : null}
                    {skipped ? <Minus aria-hidden className="size-3.5" /> : null}
                    {locked ? <Lock aria-hidden className="size-3.5" /> : null}
                    {state.state === 'next' ? <ArrowRight aria-hidden className="size-3.5" /> : null}
                    {stateWord}
                  </span>
                ) : null}
              </span>
            </StepTrigger> : (
              <div className="flex min-h-11 items-center">
              <span id={`${uid}-t`} className="flex flex-wrap items-center gap-x-2">
                <span className={cn(done && 'text-muted-foreground line-through')}>{step.title}</span>
                {step.optional ? <span className="text-muted-foreground text-xs font-normal">{labels.optional ?? 'Optional'}</span> : null}
                {stateWord ? (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-normal">
                    {done ? <Check aria-hidden className="size-3.5" /> : null}
                    {skipped ? <Minus aria-hidden className="size-3.5" /> : null}
                    {locked ? <Lock aria-hidden className="size-3.5" /> : null}
                    {state.state === 'next' ? <ArrowRight aria-hidden className="size-3.5" /> : null}
                    {stateWord}
                  </span>
                ) : null}
              </span>
              </div>
            )}
            {step.description ? (
              <p id={`${uid}-d`} className="text-muted-foreground text-sm">
                {step.description}
              </p>
            ) : null}
            {locked ? (
              <p id={`${uid}-r`} data-slot="getting-started-reason" className="text-muted-foreground text-sm">
                {reason}
              </p>
            ) : null}
          </div>
          {step.optional && !done ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-slot="getting-started-skip"
              onClick={() => ctx.act({ type: skipped ? 'unskip' : 'skip', stepId: id })}
            >
              {skipped ? (labels.unskip ?? 'Do this step') : (labels.skip ?? 'Skip')}
            </Button>
          ) : null}
        </div>
        {body ? <AccordionContent className="ps-9">{body}</AccordionContent> : null}
      </AccordionItem>
    </li>
  );
}
GettingStartedStep.displayName = 'GettingStartedStep';

// --- Celebration ------------------------------------------------------------------------

function GettingStartedCelebration({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const ctx = useGettingStarted('GettingStartedCelebration');
  const { derived, labels, shown } = ctx;
  const finished = derived.complete;
  const milestone = !finished && ctx.celebrate !== 'off' && shown?.type === 'milestone' ? shown.percent : null;
  const burst = ctx.celebrate === 'full' && !ctx.reduced && shown?.type === 'complete';
  return (
    <div
      role="status"
      data-slot="getting-started-celebration"
      data-kind={finished ? 'complete' : milestone !== null ? 'milestone' : 'none'}
      className={cn('relative', (finished || milestone !== null) && 'bg-muted rounded-lg p-3 text-sm font-medium', className)}
      {...props}
    >
      {finished ? (
        <span className="inline-flex items-center gap-2">
          <Check aria-hidden className="size-4" />
          {labels.allSet ?? 'All set. You are ready.'}
        </span>
      ) : milestone !== null ? (
        (labels.milestoneLine ?? ((p) => `${p} percent of the way.`))(milestone)
      ) : null}
      {finished && ctx.dismissible ? (
        <Button type="button" variant="ghost" size="sm" className="ms-3" onClick={(e) => ctx.hide(e.currentTarget.closest('section'))}>
          {labels.hide ?? 'Hide'}
        </Button>
      ) : null}
      {burst ? (
        <React.Suspense fallback={null}>
          <Burst />
        </React.Suspense>
      ) : null}
    </div>
  );
}
GettingStartedCelebration.displayName = 'GettingStartedCelebration';

export {
  GettingStarted,
  GettingStartedCelebration,
  GettingStartedGroup,
  GettingStartedHeader,
  GettingStartedList,
  GettingStartedStep,
};
export type { StepProps as GettingStartedStepProps };
