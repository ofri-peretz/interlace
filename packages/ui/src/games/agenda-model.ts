/**
 * @interlace/ui — agenda-model
 *
 * The running order of a session, and where the presenter is in it. Each
 * item has planned minutes; the state records when the current item began,
 * pauses, extensions and how long finished items really took. Everything is
 * a timestamp, so a refreshed presenter tab, a second device, or a shared
 * screen that joins late all read the same clock from the same state.
 *
 * ## Events
 *
 * `next` and `back` name the item they move from (`from`), so an event that
 * arrives twice after a reconnect moves once, not twice. `pause` while
 * paused, `resume` while running and `start` once started change nothing.
 *
 * ## Status
 *
 * `agendaStatus(items, state, now)` says which item is on, how long is left
 * (negative once it runs over), how far the whole session has drifted from
 * the plan, and when it will end at this pace.
 */

export interface AgendaItem {
  id: string;
  title: string;
  /** Planned length, in minutes. */
  minutes: number;
  /** Presenter notes for this item. Never shown to the room. */
  notes?: string;
}

export interface AgendaState {
  /** -1 before the start; `items.length` once finished. */
  current: number;
  /** When the current item began, ms, moved forward by any pause. */
  startedAt: number | null;
  /** Set while paused. */
  pausedAt: number | null;
  /** Minutes added to an item, by id. */
  extra: Readonly<Record<string, number>>;
  /** How long each finished item really ran, ms, by id. */
  spent: Readonly<Record<string, number>>;
}

export type AgendaEvent =
  | { type: 'start'; at: number }
  | { type: 'next'; from: number; at: number }
  | { type: 'back'; from: number; at: number }
  | { type: 'pause'; at: number }
  | { type: 'resume'; at: number }
  /** Adds minutes (or takes them away, down to zero extra) to the current item. */
  | { type: 'extend'; minutes: number }
  | { type: 'reset' };

export type AgendaPhase = 'before' | 'running' | 'paused' | 'over' | 'finished';

export interface AgendaStatus {
  phase: AgendaPhase;
  index: number;
  item: AgendaItem | null;
  next: AgendaItem | null;
  /** The current item's length with any extension, ms. */
  plannedMs: number;
  elapsedMs: number;
  /** Negative once the item runs over. */
  leftMs: number;
  /** Positive when behind the plan, negative when ahead, ms. */
  driftMs: number;
  /** When the session will end at this pace, ms; null before the start. */
  endsAt: number | null;
  /** Planned length of the whole session, ms, with extensions. */
  totalMs: number;
}

const MIN = 60_000;

export function createAgenda(): AgendaState {
  return { current: -1, startedAt: null, pausedAt: null, extra: {}, spent: {} };
}

function plannedOf(item: AgendaItem, state: AgendaState): number {
  return Math.max(0, item.minutes + (state.extra[item.id] ?? 0)) * MIN;
}

function elapsedOf(state: AgendaState, now: number): number {
  if (state.startedAt === null) return 0;
  return Math.max(0, (state.pausedAt ?? now) - state.startedAt);
}

/** Applies one event. Events that change nothing return the same state. */
export function applyAgendaEvent(items: readonly AgendaItem[], state: AgendaState, event: AgendaEvent): AgendaState {
  const live = state.current >= 0 && state.current < items.length;
  switch (event.type) {
    case 'start':
      if (state.current !== -1 || items.length === 0) return state;
      return { ...state, current: 0, startedAt: event.at, pausedAt: null };
    case 'next': {
      if (!live || state.current !== event.from) return state;
      const item = items[state.current] as AgendaItem;
      const spent = { ...state.spent, [item.id]: elapsedOf(state, event.at) };
      const to = state.current + 1;
      if (to >= items.length) return { ...state, current: items.length, startedAt: null, pausedAt: null, spent };
      return { ...state, current: to, startedAt: event.at, pausedAt: null, spent };
    }
    case 'back': {
      // Works from the finished state too, to reopen the last item.
      if (state.current !== event.from || state.current < 1 || state.current > items.length) return state;
      const leaving = items[state.current];
      const spent = leaving ? { ...state.spent, [leaving.id]: elapsedOf(state, event.at) } : { ...state.spent };
      const prev = items[state.current - 1] as AgendaItem;
      // The earlier item picks up where it stopped.
      const { [prev.id]: before = 0, ...rest } = spent;
      return { ...state, current: state.current - 1, startedAt: event.at - before, pausedAt: null, spent: rest };
    }
    case 'pause':
      if (!live || state.pausedAt !== null) return state;
      return { ...state, pausedAt: event.at };
    case 'resume': {
      if (!live || state.pausedAt === null || state.startedAt === null) return state;
      return { ...state, startedAt: state.startedAt + (event.at - state.pausedAt), pausedAt: null };
    }
    case 'extend': {
      if (!live) return state;
      const id = (items[state.current] as AgendaItem).id;
      const extra = Math.max(0, (state.extra[id] ?? 0) + event.minutes);
      return { ...state, extra: { ...state.extra, [id]: extra } };
    }
    case 'reset':
      return createAgenda();
  }
}

/** Where the session is at `now`. */
export function agendaStatus(items: readonly AgendaItem[], state: AgendaState, now: number): AgendaStatus {
  const totalMs = items.reduce((sum, it) => sum + plannedOf(it, state), 0);
  const index = state.current;
  const item = items[index] ?? null;
  const base = { index, item, next: items[index + 1] ?? null, totalMs };

  // Time over or under plan on items already finished.
  let driftMs = 0;
  for (const it of items) {
    const spent = state.spent[it.id];
    if (spent !== undefined) driftMs += spent - plannedOf(it, state);
  }

  if (index < 0) {
    return {
      ...base,
      phase: 'before',
      next: items[0] ?? null,
      plannedMs: 0,
      elapsedMs: 0,
      leftMs: 0,
      driftMs: 0,
      endsAt: null,
    };
  }
  if (!item) {
    return { ...base, phase: 'finished', plannedMs: 0, elapsedMs: 0, leftMs: 0, driftMs, endsAt: null };
  }

  const plannedMs = plannedOf(item, state);
  const elapsedMs = elapsedOf(state, now);
  const leftMs = plannedMs - elapsedMs;
  const overMs = Math.max(0, -leftMs);
  const later = items.slice(index + 1).reduce((sum, it) => sum + plannedOf(it, state), 0);
  const phase: AgendaPhase = state.pausedAt !== null ? 'paused' : leftMs < 0 ? 'over' : 'running';
  return {
    ...base,
    phase,
    plannedMs,
    elapsedMs,
    leftMs,
    driftMs: driftMs + overMs,
    endsAt: now + Math.max(0, leftMs) + later,
  };
}

/** `m:ss` for a length of time (its absolute value), rounded up to the second. */
export function formatClock(ms: number): string {
  const s = Math.ceil(Math.abs(ms) / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
