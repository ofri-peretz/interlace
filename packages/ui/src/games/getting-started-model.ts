/**
 * @interlace/ui — games/getting-started-model
 *
 * The rules of a getting-started checklist, with no DOM and no clock of its own: every function
 * that needs a moment takes it, so a test, an agent or a server replays any day. A checklist is
 * data (`ChecklistDef`, validated by `parseChecklist`), what a person has done is a plain JSON
 * snapshot (`ChecklistSnapshot`), and everything the view shows is derived from the two.
 *
 * ## Reused, not rebuilt
 *
 * Day keys and day arithmetic are `games/daily`, the streak is `games/streak-model`'s
 * `summarizeStreak`, and "which milestone did this cross, once" is `games/progress-model`'s
 * `milestonesCrossed`. This file adds only what a checklist needs: dependencies between steps,
 * weights, a pace against a due date, celebrations that happen once, and a merge.
 *
 * ## Progress is honest
 *
 * Only required steps count. An optional step never moves the bar, and skipping one unlocks what
 * waited for it. Nothing here rewards a self-rating, and nothing frames a missed day as a loss.
 *
 * ## Merging two copies
 *
 * Two tabs or two devices converge without a server deciding. `done`, `skipped` and `cleared` are
 * maps of step id to a time, merged by the larger time per id (a grow-only map: commutative,
 * associative, idempotent). A step is done when its `done` time is later than its `cleared` time,
 * so un-ticking is a newer fact, not a deletion, and "unticked on the tablet" survives "never seen
 * on the phone". `celebrated` and `activeDays` are unions. This replaces last-writer-wins on `at`,
 * which is not associative when one side changes something else later.
 *
 * ## Untrusted input
 *
 * A stored snapshot is untrusted: `parseSnapshot` drops what it cannot read and never throws.
 */

import { dayKey, daysBetween, isDayKey, type DayKey } from './daily.js';
import { milestonesCrossed } from './progress-model.js';

// --- Definition ------------------------------------------------------------------------

export interface StepDef {
  /** Stable, `[a-z0-9-]`, unique. */
  id: string;
  title: string;
  description?: string;
  /** Does not count toward progress or completion. @default false */
  optional?: boolean;
  /** Locked until every id here is done (or skipped, if that step is optional). */
  after?: readonly string[];
  /** Counts toward progress. @default 1 */
  weight?: number;
  /** A group id from `groups`. */
  group?: string;
}

export interface GroupDef {
  id: string;
  title: string;
}

export interface ChecklistDef {
  steps: readonly StepDef[];
  groups?: readonly GroupDef[];
  /** Percent marks worth a line of their own. @default [25, 50, 75] */
  milestones?: readonly number[];
}

export const DEFAULT_MILESTONES: readonly number[] = [25, 50, 75];

const ID = /^[a-z0-9-]{1,64}$/;

export type ParsedChecklist = { ok: true; def: ChecklistDef } | { ok: false; errors: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A checklist from data (a JSON file, an agent's output), or every reason it is not one. Checked:
 * ids are unique and `[a-z0-9-]`, every `after` and `group` resolves, nothing depends on itself
 * through any chain, weights are positive and finite, milestones are whole percents from 1 to 99
 * in order, and at least one step is required. Each error names its step.
 */
export function parseChecklist(raw: unknown): ParsedChecklist {
  const errors: string[] = [];
  if (!isRecord(raw) || !Array.isArray(raw.steps)) return { ok: false, errors: ['The checklist needs a list of steps.'] };
  const groupIds = new Set<string>();
  const groups: GroupDef[] = [];
  if (raw.groups !== undefined) {
    if (!Array.isArray(raw.groups)) errors.push('`groups` must be a list.');
    else {
      for (const g of raw.groups) {
        if (!isRecord(g) || typeof g.id !== 'string' || !ID.test(g.id) || typeof g.title !== 'string') {
          errors.push('A group needs an id ([a-z0-9-]) and a title.');
        } else if (groupIds.has(g.id)) errors.push(`Group "${g.id}" is repeated.`);
        else {
          groupIds.add(g.id);
          groups.push({ id: g.id, title: g.title });
        }
      }
    }
  }
  const steps: StepDef[] = [];
  const ids = new Set<string>();
  for (const s of raw.steps) {
    if (!isRecord(s) || typeof s.id !== 'string' || !ID.test(s.id)) {
      errors.push('A step needs an id of letters a-z, digits and dashes.');
      continue;
    }
    if (ids.has(s.id)) {
      errors.push(`Step "${s.id}" is repeated.`);
      continue;
    }
    ids.add(s.id);
    if (typeof s.title !== 'string' || !s.title.trim()) {
      errors.push(`Step "${s.id}" needs a title.`);
      continue;
    }
    if (s.weight !== undefined && (!finite(s.weight) || s.weight <= 0)) errors.push(`Step "${s.id}" has a weight that is not above zero.`);
    if (s.after !== undefined && (!Array.isArray(s.after) || s.after.some((a) => typeof a !== 'string'))) {
      errors.push(`Step "${s.id}" has an \`after\` that is not a list of ids.`);
    }
    if (s.group !== undefined && (typeof s.group !== 'string' || !groupIds.has(s.group))) {
      errors.push(`Step "${s.id}" is in a group that does not exist.`);
    }
    steps.push({
      id: s.id,
      title: s.title,
      ...(typeof s.description === 'string' ? { description: s.description } : {}),
      ...(s.optional === true ? { optional: true } : {}),
      ...(Array.isArray(s.after) ? { after: s.after.filter((a): a is string => typeof a === 'string') } : {}),
      ...(finite(s.weight) ? { weight: s.weight } : {}),
      ...(typeof s.group === 'string' ? { group: s.group } : {}),
    });
  }
  for (const s of steps) {
    for (const a of s.after ?? []) if (!ids.has(a)) errors.push(`Step "${s.id}" waits for "${a}", which does not exist.`);
  }
  // Kahn: whatever cannot be taken off the list is in, or behind, a cycle.
  const left = new Map(steps.map((s) => [s.id, new Set((s.after ?? []).filter((a) => ids.has(a)))]));
  for (let progress = true; progress; ) {
    progress = false;
    for (const [id, deps] of left) {
      if (deps.size === 0) {
        left.delete(id);
        for (const d of left.values()) d.delete(id);
        progress = true;
      }
    }
  }
  for (const id of left.keys()) errors.push(`Step "${id}" is part of a cycle of steps waiting for each other.`);
  if (!steps.some((s) => !s.optional)) errors.push('At least one step must be required.');
  let milestones: number[] | undefined;
  if (raw.milestones !== undefined) {
    const m = raw.milestones;
    if (!Array.isArray(m) || m.some((n, i) => !Number.isInteger(n) || n < 1 || n > 99 || (i > 0 && n <= (m[i - 1] as number)))) {
      errors.push('Milestones must be whole percents from 1 to 99, rising.');
    } else milestones = m as number[];
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, def: { steps, ...(groups.length ? { groups } : {}), ...(milestones ? { milestones } : {}) } };
}

// --- Snapshot --------------------------------------------------------------------------

/** What is stored and merged. Plain JSON, versioned. */
export interface ChecklistSnapshot {
  v: 1;
  /** Step id → ms it was done. */
  done: Record<string, number>;
  /** Optional step id → ms it was skipped. */
  skipped: Record<string, number>;
  /** Step id → ms it was last un-ticked or un-skipped. A step is done when `done` is later. */
  cleared: Record<string, number>;
  /** `step:<id>`, `milestone:<percent>` or `complete`: what has been celebrated, never twice. */
  celebrated: readonly string[];
  /** Day keys the person did something on the list, append-only, sorted. */
  activeDays: readonly DayKey[];
  dismissed: boolean;
  /** ms of the last change. */
  at: number;
}

export function emptySnapshot(at = 0): ChecklistSnapshot {
  return { v: 1, done: {}, skipped: {}, cleared: {}, celebrated: [], activeDays: [], dismissed: false, at };
}

const MAX_ACTIVE_DAYS = 400;
const MAX_CELEBRATED = 200;
const MAX_KEY = 64;

const safeKey = (k: string) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && k.length <= MAX_KEY;

function readTimes(raw: unknown, known: ReadonlySet<string> | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (safeKey(k) && finite(v) && v >= 0 && (!known || known.has(k))) out[k] = v;
  }
  return out;
}

function readStrings(raw: unknown, ok: (s: string) => boolean, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const s of raw) if (typeof s === 'string' && s.length <= MAX_KEY && ok(s)) out.add(s);
  return [...out].sort().slice(-max);
}

/**
 * A snapshot from stored data, or null when it is not one (not an object, or not version 1).
 * Everything is rebuilt, never trusted: ids that are not in `def` are dropped (the list may have
 * changed), times that are not finite and non-negative are dropped, `__proto__`-like keys and long
 * strings are dropped, and the lists are capped. It never throws.
 */
export function parseSnapshot(raw: unknown, def?: ChecklistDef): ChecklistSnapshot | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const known = def ? new Set(def.steps.map((s) => s.id)) : null;
  const stepKey = (s: string) => (known ? known.has(s.slice(5)) : true);
  return {
    v: 1,
    done: readTimes(raw.done, known),
    skipped: readTimes(raw.skipped, known),
    cleared: readTimes(raw.cleared, known),
    celebrated: readStrings(
      raw.celebrated,
      (s) => (s.startsWith('step:') ? stepKey(s) : /^milestone:\d{1,2}$/.test(s) || s === 'complete'),
      MAX_CELEBRATED,
    ),
    activeDays: readStrings(raw.activeDays, (s) => isDayKey(s), MAX_ACTIVE_DAYS),
    dismissed: raw.dismissed === true,
    at: finite(raw.at) && raw.at >= 0 ? raw.at : 0,
  };
}

const union = (a: readonly string[], b: readonly string[], max: number): string[] => [...new Set([...a, ...b])].sort().slice(-max);

function maxTimes(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? -Infinity, v);
  return out;
}

/**
 * Two copies of one checklist as one. Commutative, associative and idempotent (property-tested),
 * and it never loses a celebrated key or an active day.
 */
export function mergeSnapshots(a: ChecklistSnapshot, b: ChecklistSnapshot): ChecklistSnapshot {
  return {
    v: 1,
    done: maxTimes(a.done, b.done),
    skipped: maxTimes(a.skipped, b.skipped),
    cleared: maxTimes(a.cleared, b.cleared),
    celebrated: union(a.celebrated, b.celebrated, MAX_CELEBRATED),
    activeDays: union(a.activeDays, b.activeDays, MAX_ACTIVE_DAYS),
    // The newer change decides; at the same moment, hidden wins, so the order of merging never matters.
    dismissed: a.at === b.at ? a.dismissed || b.dismissed : a.at > b.at ? a.dismissed : b.dismissed,
    at: Math.max(a.at, b.at),
  };
}

// --- Derived state ---------------------------------------------------------------------

export type StepState = 'done' | 'skipped' | 'locked' | 'next' | 'todo';

export interface DerivedStep {
  id: string;
  state: StepState;
  /** The ids this step waits for, still not done. Empty unless locked. */
  lockedBy: string[];
}

export interface DerivedChecklist {
  steps: DerivedStep[];
  /** Required steps done, and how many there are. */
  doneCount: number;
  total: number;
  /** Whole percent of required weight done, 0 to 100. */
  percent: number;
  complete: boolean;
  /** The first required step, in order, that is not done and not locked. */
  next: string | null;
}

const isDone = (s: ChecklistSnapshot, id: string) => Object.hasOwn(s.done, id) && (s.done[id] as number) > (s.cleared[id] ?? -Infinity);
const isSkipped = (s: ChecklistSnapshot, id: string) =>
  Object.hasOwn(s.skipped, id) && (s.skipped[id] as number) > (s.cleared[id] ?? -Infinity);

/** What each step is, how far along the list is, and what to do next. */
export function deriveChecklist(def: ChecklistDef, snapshot: ChecklistSnapshot): DerivedChecklist {
  const byId = new Map(def.steps.map((s) => [s.id, s]));
  const satisfied = (id: string) => isDone(snapshot, id) || (!!byId.get(id)?.optional && isSkipped(snapshot, id));
  let next: string | null = null;
  let doneWeight = 0;
  let totalWeight = 0;
  let doneCount = 0;
  let total = 0;
  const steps = def.steps.map((s): DerivedStep => {
    const weight = s.weight ?? 1;
    if (!s.optional) {
      total += 1;
      totalWeight += weight;
    }
    if (isDone(snapshot, s.id)) {
      if (!s.optional) {
        doneCount += 1;
        doneWeight += weight;
      }
      return { id: s.id, state: 'done', lockedBy: [] };
    }
    if (s.optional && isSkipped(snapshot, s.id)) return { id: s.id, state: 'skipped', lockedBy: [] };
    const lockedBy = (s.after ?? []).filter((a) => !satisfied(a));
    if (lockedBy.length) return { id: s.id, state: 'locked', lockedBy };
    if (!s.optional && next === null) {
      next = s.id;
      return { id: s.id, state: 'next', lockedBy: [] };
    }
    return { id: s.id, state: 'todo', lockedBy: [] };
  });
  return {
    steps,
    doneCount,
    total,
    percent: totalWeight > 0 ? Math.floor((100 * doneWeight) / totalWeight) : 0,
    complete: total > 0 && doneCount === total,
    next,
  };
}

// --- Changes ---------------------------------------------------------------------------

const stateOf = (def: ChecklistDef, snapshot: ChecklistSnapshot, id: string): DerivedStep | undefined =>
  deriveChecklist(def, snapshot).steps.find((s) => s.id === id);

function withDay(days: readonly DayKey[], key: DayKey): DayKey[] {
  return days.includes(key) ? [...days] : [...days, key].sort().slice(-MAX_ACTIVE_DAYS);
}

/** A time later than `after`, so a re-tick at the same millisecond as an un-tick still wins. */
const later = (now: number, after: number | undefined) => (after === undefined ? now : Math.max(now, after + 1));

/**
 * The step done at `now`. A step that is locked, unknown or already done is no change: the same
 * object comes back (the view says why). Doing a step adds today to `activeDays`; nothing removes it.
 */
export function complete(def: ChecklistDef, snapshot: ChecklistSnapshot, id: string, now: number, timeZone?: string): ChecklistSnapshot {
  const step = stateOf(def, snapshot, id);
  if (!step || step.state === 'done' || step.state === 'locked') return snapshot;
  return {
    ...snapshot,
    done: { ...snapshot.done, [id]: later(now, snapshot.cleared[id]) },
    activeDays: withDay(snapshot.activeDays, dayKey(now, timeZone)),
    at: Math.max(snapshot.at, now),
  };
}

/** The step open again. Never removes a day from `activeDays` or a key from `celebrated`. */
export function uncomplete(def: ChecklistDef, snapshot: ChecklistSnapshot, id: string, now: number): ChecklistSnapshot {
  if (stateOf(def, snapshot, id)?.state !== 'done') return snapshot;
  return { ...snapshot, cleared: { ...snapshot.cleared, [id]: Math.max(now, snapshot.done[id] as number) }, at: Math.max(snapshot.at, now) };
}

/** An optional step skipped; it then satisfies the steps that wait for it. Anything else is no change. */
export function skip(def: ChecklistDef, snapshot: ChecklistSnapshot, id: string, now: number): ChecklistSnapshot {
  const step = def.steps.find((s) => s.id === id);
  const state = stateOf(def, snapshot, id)?.state;
  if (!step?.optional || state === 'done' || state === 'skipped') return snapshot;
  return { ...snapshot, skipped: { ...snapshot.skipped, [id]: later(now, snapshot.cleared[id]) }, at: Math.max(snapshot.at, now) };
}

/** A skipped step open again ("Do this step"). */
export function unskip(def: ChecklistDef, snapshot: ChecklistSnapshot, id: string, now: number): ChecklistSnapshot {
  if (stateOf(def, snapshot, id)?.state !== 'skipped') return snapshot;
  return { ...snapshot, cleared: { ...snapshot.cleared, [id]: Math.max(now, snapshot.skipped[id] as number) }, at: Math.max(snapshot.at, now) };
}

/** The list hidden (or shown again). */
export function setDismissed(snapshot: ChecklistSnapshot, dismissed: boolean, now: number): ChecklistSnapshot {
  return snapshot.dismissed === dismissed ? snapshot : { ...snapshot, dismissed, at: Math.max(snapshot.at + 1, now) };
}

// --- Celebrations ----------------------------------------------------------------------

export type Celebration =
  | { type: 'step'; stepId: string }
  | { type: 'milestone'; percent: number }
  | { type: 'complete' };

export const celebrationKey = (c: Celebration): string =>
  c.type === 'step' ? `step:${c.stepId}` : c.type === 'milestone' ? `milestone:${c.percent}` : 'complete';

/**
 * What a change from `before` to `after` is worth a moment for, each only if it is not in
 * `after.celebrated`: a step newly done, each milestone the progress crossed, and the finish. So
 * un-ticking and ticking again, a reload and a merge from another tab are all silent.
 */
export function celebrationsFor(def: ChecklistDef, before: ChecklistSnapshot, after: ChecklistSnapshot): Celebration[] {
  const a = deriveChecklist(def, before);
  const b = deriveChecklist(def, after);
  const out: Celebration[] = [];
  b.steps.forEach((s, i) => {
    if (s.state === 'done' && (a.steps[i] as DerivedStep).state !== 'done') out.push({ type: 'step', stepId: s.id });
  });
  for (const percent of milestonesCrossed(a.percent, b.percent, def.milestones ?? DEFAULT_MILESTONES)) {
    out.push({ type: 'milestone', percent });
  }
  if (b.complete && !a.complete) out.push({ type: 'complete' });
  return out.filter((c) => !after.celebrated.includes(celebrationKey(c)));
}

/** The one celebration to show: finishing, then the highest milestone, then the last step. */
export function topCelebration(celebrations: readonly Celebration[]): Celebration | null {
  return (
    celebrations.find((c) => c.type === 'complete') ??
    [...celebrations].reverse().find((c) => c.type === 'milestone') ??
    [...celebrations].reverse().find((c) => c.type === 'step') ??
    null
  );
}

/** The snapshot with these celebrations written into its ledger, so none is shown again. */
export function markCelebrated(snapshot: ChecklistSnapshot, celebrations: readonly Celebration[]): ChecklistSnapshot {
  if (celebrations.length === 0) return snapshot;
  return { ...snapshot, celebrated: union(snapshot.celebrated, celebrations.map(celebrationKey), MAX_CELEBRATED) };
}

// --- Pace ------------------------------------------------------------------------------

export type PaceState = 'none' | 'done' | 'on-track' | 'behind' | 'overdue';

export interface Pace {
  state: PaceState;
  /** Required steps not done. */
  stepsLeft: number;
  /** Whole days from today to the due day, 0 on or after it. */
  daysLeft: number;
}

/**
 * Whether the list will be finished by `dueAt`: on track when the steps left fit in the days left
 * at `capacityPerDay` (the due day itself counts as a day), overdue once the due day has passed.
 * No `dueAt` is no pace. Days are whole days in `timeZone`.
 */
export function pace(
  def: ChecklistDef,
  snapshot: ChecklistSnapshot,
  now: number,
  dueAt: number | undefined,
  capacityPerDay = 2,
  timeZone?: string,
): Pace {
  const d = deriveChecklist(def, snapshot);
  const stepsLeft = d.total - d.doneCount;
  if (dueAt === undefined || !Number.isFinite(dueAt)) return { state: 'none', stepsLeft, daysLeft: 0 };
  const gap = daysBetween(dayKey(now, timeZone), dayKey(dueAt, timeZone));
  const daysLeft = Math.max(0, gap);
  if (d.complete) return { state: 'done', stepsLeft, daysLeft };
  if (gap < 0) return { state: 'overdue', stepsLeft, daysLeft };
  const capacity = Number.isFinite(capacityPerDay) && capacityPerDay > 0 ? capacityPerDay : 1;
  return { state: stepsLeft <= Math.max(1, daysLeft) * capacity ? 'on-track' : 'behind', stepsLeft, daysLeft };
}

// --- Announcements ---------------------------------------------------------------------

export interface AnnounceLabels {
  /** @default (title, done, total) => `${title} done. ${done} of ${total} steps done.` */
  stepDone?: (title: string, done: number, total: number) => string;
  /** For an optional step, which does not move the count. @default (title) => `${title} done.` */
  optionalDone?: (title: string) => string;
  /** @default (done, total) => `Halfway: ${done} of ${total} steps done.` */
  halfway?: (done: number, total: number) => string;
  /** @default (percent, done, total) => `${percent} percent: ${done} of ${total} steps done.` */
  milestone?: (percent: number, done: number, total: number) => string;
  /** @default (total) => `All ${total} steps done. You are ready.` */
  complete?: (total: number) => string;
  /** @default (title) => `${title} is open again.` */
  reopened?: (title: string) => string;
  /** @default (title) => `${title} skipped.` */
  skipped?: (title: string) => string;
}

/**
 * The one sentence for a change from `before` to `after`, or null when nothing a person did
 * changed (a merge, a first render). At most one per change: finishing, then a milestone, then
 * the step.
 */
export function announcementFor(
  def: ChecklistDef,
  before: ChecklistSnapshot,
  after: ChecklistSnapshot,
  labels: AnnounceLabels = {},
): string | null {
  const a = deriveChecklist(def, before);
  const b = deriveChecklist(def, after);
  const titles = new Map(def.steps.map((s) => [s.id, s.title]));
  const title = (id: string) => titles.get(id) as string;
  const changed = b.steps.filter((s, i) => s.state !== (a.steps[i] as DerivedStep).state);
  const before_ = (s: DerivedStep) => (a.steps[b.steps.indexOf(s)] as DerivedStep).state;
  const nowDone = changed.filter((s) => s.state === 'done');
  const reopened = changed.filter((s) => before_(s) === 'done' && s.state !== 'done');
  const nowSkipped = changed.filter((s) => s.state === 'skipped');
  if (nowDone.length === 1 && reopened.length === 0) {
    const step = nowDone[0] as DerivedStep;
    const optional = !!def.steps.find((s) => s.id === step.id)?.optional;
    if (b.complete && !a.complete) return (labels.complete ?? ((n) => `All ${n} steps done. You are ready.`))(b.total);
    const crossed = milestonesCrossed(a.percent, b.percent, def.milestones ?? DEFAULT_MILESTONES);
    const last = crossed[crossed.length - 1];
    if (last !== undefined) {
      return last === 50
        ? (labels.halfway ?? ((d, t) => `Halfway: ${d} of ${t} steps done.`))(b.doneCount, b.total)
        : (labels.milestone ?? ((p, d, t) => `${p} percent: ${d} of ${t} steps done.`))(last, b.doneCount, b.total);
    }
    if (optional) return (labels.optionalDone ?? ((t) => `${t} done.`))(title(step.id));
    return (labels.stepDone ?? ((t, d, n) => `${t} done. ${d} of ${n} steps done.`))(title(step.id), b.doneCount, b.total);
  }
  const back = changed.find((s) => (before_(s) === 'done' || before_(s) === 'skipped') && s.state !== 'done' && s.state !== 'skipped');
  if (back && nowDone.length === 0) return (labels.reopened ?? ((t) => `${t} is open again.`))(title(back.id));
  if (nowSkipped.length === 1) return (labels.skipped ?? ((t) => `${t} skipped.`))(title((nowSkipped[0] as DerivedStep).id));
  return null;
}
