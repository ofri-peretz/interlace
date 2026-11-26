/**
 * @interlace/ui — games/agenda-model
 *
 * A presenter's agenda: sections with notes and a planned time, a clock that runs on the section
 * being presented, and how the session is doing against its plan. Pure; times are timestamps in
 * ms from one clock (the controlling window's), so a second screen shows the same numbers.
 *
 * ## Time
 *
 * A section's elapsed time is what it has banked (`spent`) plus the stretch since `since` while
 * it runs. Pausing, moving on and coming back all bank first, so no second is lost or counted
 * twice, and a restored agenda that was running goes on counting through the refresh.
 *
 * ## Over time, gently
 *
 * `paceTier` is `ok` below 80% of the plan, `near` from 80% to the plan, `over` past it. Nothing
 * here stops or alarms: it is a signal a screen can show in words and a calm colour.
 *
 * ## Two screens
 *
 * One window controls (it holds the agenda and applies events with its own clock) and any number
 * show it. A window sends `AgendaMessage`s over a `RoomTransport<AgendaMessage>`: the state, the
 * second screen's intents, and a hello from a screen that just opened. An intent names the state
 * it was made against (`seq`) and carries a unique `id`, so a repeated message is applied once and
 * one made against an older screen is dropped (see `acceptIntent`), not applied twice.
 */

import { cleanName } from './room-model.js';
import { clampCount, isRecord } from './group-model.js';

export const MAX_SECTIONS = 60;
const MAX_TITLE = 80;
const MAX_NOTES = 4_000;
/** The longest a section may be planned for: 12 hours, in seconds. */
export const MAX_PLANNED = 12 * 3600;

export interface AgendaSection {
  id: string;
  title: string;
  /** Plain text. Shown as written, line breaks kept; never read as HTML. */
  notes: string;
  /** How long it should take, in seconds. 0 for a section without a time. */
  plannedSeconds: number;
}

export type AgendaStatus = 'idle' | 'running' | 'paused' | 'done';

export interface AgendaState {
  sections: AgendaSection[];
  /** Index of the section being presented (or the one to start with). */
  current: number;
  status: AgendaStatus;
  /** Banked time per section id, in ms, not counting the stretch since `since`. */
  spent: Record<string, number>;
  /** When the current section last started counting, in ms. null unless running. */
  since: number | null;
  /** Bumped on every change, so a screen keeps only the newest state. */
  seq: number;
}

export interface AgendaInput {
  id?: string;
  title: string;
  notes?: string;
  plannedSeconds?: number;
}

/** A new agenda from sections (at most `MAX_SECTIONS`; ids made up as `s1`, `s2` where missing or repeated). */
export function createAgenda(sections: readonly AgendaInput[]): AgendaState {
  const list: AgendaSection[] = [];
  sections.slice(0, MAX_SECTIONS).forEach((s, i) => {
    const id = s.id && !list.some((x) => x.id === s.id) && /^[\w-]{1,40}$/.test(s.id) ? s.id : `s${i + 1}`;
    list.push({
      id: list.some((x) => x.id === id) ? `s${i + 1}-${list.length}` : id,
      title: cleanName(s.title, MAX_TITLE) || `Section ${i + 1}`,
      notes: (s.notes ?? '').slice(0, MAX_NOTES),
      plannedSeconds: clampCount(s.plannedSeconds ?? 0, 0, MAX_PLANNED),
    });
  });
  return { sections: list, current: 0, status: 'idle', spent: {}, since: null, seq: 0 };
}

export type AgendaEvent =
  /** Starts the clock on the first section. Next does the same from idle. */
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  /** To the next section; from the last, the agenda is done. */
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'goto'; index: number }
  /** More (or, negative, less) planned time on the current section, in seconds. */
  | { type: 'add-time'; seconds: number }
  /** Back to the start with every clock at zero. */
  | { type: 'reset' };

/** Banks the stretch since `since` into the current section. */
function bank(state: AgendaState, now: number): Record<string, number> {
  const section = state.sections[state.current];
  if (!section || state.since === null) return state.spent;
  return { ...state.spent, [section.id]: (state.spent[section.id] ?? 0) + Math.max(0, now - state.since) };
}

/**
 * The agenda after `event`, at `now`. The same object when the event does nothing (pausing what is
 * not running, going back from the first section, a `goto` out of range), so `next === state`
 * means no change and no `seq` bump.
 */
export function applyAgendaEvent(state: AgendaState, event: AgendaEvent, now: number): AgendaState {
  const last = state.sections.length - 1;
  const bump = (patch: Partial<AgendaState>): AgendaState => ({ ...state, ...patch, seq: state.seq + 1 });
  const moving = state.status === 'running' || state.status === 'paused';
  // The same step with the clock still running if it was.
  const moveTo = (index: number): AgendaState =>
    bump({ spent: bank(state, now), current: index, since: state.status === 'paused' ? null : now, status: state.status === 'paused' ? 'paused' : 'running' });

  switch (event.type) {
    case 'start':
      return state.status === 'idle' && last >= 0 ? bump({ status: 'running', since: now }) : state;
    case 'pause':
      return state.status === 'running' ? bump({ status: 'paused', spent: bank(state, now), since: null }) : state;
    case 'resume':
      return state.status === 'paused' ? bump({ status: 'running', since: now }) : state;
    case 'next':
      if (state.status === 'idle') return applyAgendaEvent(state, { type: 'start' }, now);
      if (!moving) return state;
      return state.current >= last
        ? bump({ status: 'done', spent: bank(state, now), since: null })
        : moveTo(state.current + 1);
    case 'previous':
      if (state.status === 'done') return bump({ status: 'running', current: last, since: now });
      return moving && state.current > 0 ? moveTo(state.current - 1) : state;
    case 'goto': {
      const { index } = event;
      if (!Number.isInteger(index) || index < 0 || index > last) return state;
      if (state.status === 'idle') return index === state.current ? state : bump({ current: index });
      if (state.status === 'done') return bump({ status: 'running', current: index, since: now });
      return index === state.current ? state : moveTo(index);
    }
    case 'add-time': {
      const section = state.sections[state.current];
      if (!section || !Number.isFinite(event.seconds) || event.seconds === 0) return state;
      const planned = clampCount(section.plannedSeconds + event.seconds, 0, MAX_PLANNED);
      if (planned === section.plannedSeconds) return state;
      return bump({ sections: state.sections.map((s, i) => (i === state.current ? { ...s, plannedSeconds: planned } : s)) });
    }
    case 'reset':
      return { ...state, current: 0, status: 'idle', spent: {}, since: null, seq: state.seq + 1 };
  }
}

/** What a section has been presented for, in ms, at `now`. */
export function elapsedMs(state: AgendaState, index: number, now: number): number {
  const section = state.sections[index];
  if (!section) return 0;
  const running = state.status === 'running' && index === state.current && state.since !== null;
  return (state.spent[section.id] ?? 0) + (running ? Math.max(0, now - (state.since as number)) : 0);
}

/** What a section is planned for, in ms. */
export function plannedMs(state: AgendaState, index: number): number {
  return (state.sections[index]?.plannedSeconds ?? 0) * 1000;
}

export type PaceTier = 'ok' | 'near' | 'over';

/** How a section is doing against its plan. A section with no planned time is always `ok`. */
export function paceTier(elapsed: number, planned: number): PaceTier {
  if (planned <= 0) return 'ok';
  if (elapsed > planned) return 'over';
  return elapsed >= planned * 0.8 ? 'near' : 'ok';
}

export type SectionStatus = 'done' | 'current' | 'upcoming';

export interface SectionProgress {
  id: string;
  title: string;
  index: number;
  status: SectionStatus;
  elapsed: number;
  planned: number;
  /** elapsed minus planned, in ms: positive is over. 0 for an upcoming section. */
  delta: number;
  tier: PaceTier;
}

export interface AgendaProgress {
  sections: SectionProgress[];
  /** The section being presented, or null when the agenda is empty. */
  current: SectionProgress | null;
  /** Everything planned, and everything presented so far, in ms. */
  plannedTotal: number;
  elapsedTotal: number;
  /**
   * How far the session is from its plan, in ms: positive is behind. Sections finished count what
   * they ran over or under; the section in progress counts only what it has run over, so a
   * section half done is never read as being ahead.
   */
  drift: number;
}

/** Every section's progress, and the session's, at `now`. */
export function agendaProgress(state: AgendaState, now: number): AgendaProgress {
  const sections = state.sections.map((s, index): SectionProgress => {
    const status: SectionStatus =
      state.status === 'done' || index < state.current ? 'done' : index === state.current ? 'current' : 'upcoming';
    const elapsed = elapsedMs(state, index, now);
    const planned = plannedMs(state, index);
    // An upcoming section has nothing presented yet, unless it was visited and then gone back from.
    const delta = status === 'upcoming' && elapsed === 0 ? 0 : elapsed - planned;
    return { id: s.id, title: s.title, index, status, elapsed, planned, delta, tier: paceTier(elapsed, planned) };
  });
  const drift = sections.reduce((sum, s) => sum + (s.status === 'current' ? Math.max(0, s.delta) : s.delta), 0);
  return {
    sections,
    current: sections[state.current] ?? null,
    plannedTotal: sections.reduce((n, s) => n + s.planned, 0),
    elapsedTotal: sections.reduce((n, s) => n + s.elapsed, 0),
    drift,
  };
}

/** `m:ss`, or `h:mm:ss` from an hour. A negative or non-finite value reads as 0:00. */
export function formatClock(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// --- Two screens -----------------------------------------------------------------

/** What travels between the controlling window and a second screen. */
export type AgendaMessage =
  /**
   * The controlling window's agenda after every change; `at` is its clock when it sent it. `session`
   * names the run of the controlling window: a screen follows a new session whatever its `seq`, so a
   * controller that restarts without a saved agenda is not ignored.
   */
  | { kind: 'agenda-state'; state: AgendaState; at: number; session: string }
  /** A second screen asks the controlling window to apply an event. */
  | { kind: 'agenda-intent'; id: string; seq: number; event: AgendaEvent }
  /** A screen that just opened asks for the state. */
  | { kind: 'agenda-hello' };

/**
 * Whether the controlling window applies a second screen's intent: not when it has already
 * applied one with this `id` (a repeated message), and not when it was made against a different
 * state (`seq`), such as a tap on a screen that has since been overtaken, so a double tap or a
 * late message never moves the agenda twice.
 */
export function acceptIntent(state: AgendaState, intent: { id: string; seq: number }, applied: ReadonlySet<string>): boolean {
  return intent.seq === state.seq && !applied.has(intent.id);
}

// --- Keeping an agenda across a refresh ----------------------------------------------

/** How far `restoreAgenda` moves `seq` ahead, so a screen takes the restored agenda as the newest. */
export const AGENDA_SEQ_JUMP = 1_000;

const STATUSES: readonly AgendaStatus[] = ['idle', 'running', 'paused', 'done'];
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The agenda as text, to keep in `localStorage`, so a presenter who refreshes goes on where they were. */
export function serializeAgenda(state: AgendaState): string {
  return JSON.stringify(state);
}

/**
 * The agenda from text written by `serializeAgenda`, or null when it is not one. Rebuilt and
 * checked, never trusted. A running agenda keeps its `since`, so the section goes on counting
 * through the refresh: the minutes the page was away are minutes the section ran.
 */
export function restoreAgenda(text: string | null | undefined): AgendaState | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || !Array.isArray(raw.sections) || !STATUSES.includes(raw.status as AgendaStatus)) return null;
  if (!finite(raw.seq) || raw.seq < 0 || !Number.isInteger(raw.current)) return null;
  const base = createAgenda(
    raw.sections.filter(isRecord).map((s) => ({
      id: typeof s.id === 'string' ? s.id : undefined,
      title: typeof s.title === 'string' ? s.title : '',
      notes: typeof s.notes === 'string' ? s.notes : '',
      plannedSeconds: finite(s.plannedSeconds) ? s.plannedSeconds : 0,
    })),
  );
  const spent = isRecord(raw.spent) ? raw.spent : {};
  const current = raw.current as number;
  if (!base.sections.length || current < 0 || current >= base.sections.length) return null;
  const status = raw.status as AgendaStatus;
  if (status === 'running' && !finite(raw.since)) return null;
  return {
    ...base,
    current,
    status,
    spent: Object.fromEntries(
      base.sections.map((s) => {
        const ms = Object.hasOwn(spent, s.id) ? spent[s.id] : 0;
        return [s.id, finite(ms) && ms > 0 ? ms : 0];
      }),
    ),
    since: status === 'running' ? (raw.since as number) : null,
    seq: raw.seq + AGENDA_SEQ_JUMP,
  };
}

/** Where a presenter keeps the agenda between page loads. `Storage` fits. */
export interface AgendaStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * An agenda kept in `storage` under `key`. Storage that is missing, full or blocked never throws:
 * `load` finds nothing and `save` does nothing.
 */
export function createAgendaStore(
  storage: AgendaStorage | null | undefined,
  key: string,
): { load(): AgendaState | null; save(state: AgendaState): void; clear(): void } {
  return {
    load() {
      try {
        return restoreAgenda(storage?.getItem(key));
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        storage?.setItem(key, serializeAgenda(state));
      } catch {
        /* a full or blocked store must not stop the session */
      }
    },
    clear() {
      try {
        storage?.removeItem(key);
      } catch {
        /* nothing to clear */
      }
    },
  };
}
