/**
 * @interlace/ui — games/agenda-sync-model
 *
 * What `games/agenda-model` does not do by itself: keep one agenda right across a presenter's
 * windows and across a refresh. Pure; the hook that uses it is `useAgendaSync`.
 *
 * ## Two screens
 *
 * One window controls (it holds the agenda and applies events with its own clock) and any number
 * show it. They talk over a `RoomTransport<AgendaMessage>`: the state, a second screen's intents,
 * and a hello from a screen that just opened. A change names the run of the controlling window
 * (`session`) and counts up (`seq`), so a screen keeps only the newest state of a run and follows
 * a new run whatever its `seq`.
 *
 * An intent names the `seq` it was made against and carries a unique `id`, so a repeated message
 * is applied once and one made against an older screen is dropped (`acceptIntent`), never applied
 * twice: `extend` is not idempotent by itself, and a screen's `at` is its own clock, so the
 * controlling window stamps the event again (`stampEvent`).
 *
 * ## Keeping an agenda across a refresh
 *
 * `serializeAgenda` and `restoreAgenda` write and rebuild the items, the state and `seq`; nothing
 * read back is trusted. The state is timestamps, so a running agenda goes on counting through the
 * refresh: the minutes the page was away are minutes the item ran. `seq` moves ahead so a screen
 * takes the restored agenda as the newest.
 */

import type { AgendaEvent, AgendaItem, AgendaState } from './agenda-model.js';

/** What travels between the controlling window and a second screen. */
export type AgendaMessage =
  /** The controlling window's agenda after every change; `at` is its clock when it sent it. */
  | { kind: 'agenda-state'; items: AgendaItem[]; state: AgendaState; seq: number; at: number; session: string }
  /** A second screen asks the controlling window to apply an event. */
  | { kind: 'agenda-intent'; id: string; seq: number; event: AgendaEvent }
  /** A screen that just opened asks for the state. */
  | { kind: 'agenda-hello' };

/** An agenda as one window holds it. */
export interface AgendaSnapshot {
  items: AgendaItem[];
  state: AgendaState;
  /** Counts up with every change of one run. */
  seq: number;
}

/** The most items an agenda keeps, and the longest text of one. */
export const MAX_ITEMS = 60;
const MAX_TITLE = 120;
const MAX_NOTES = 4_000;
const MAX_MINUTES = 12 * 60;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ID = /^[\w-]{1,64}$/;

/**
 * Items from untrusted data: a string id and title, minutes between 0 and 12 hours, plain-text
 * notes. An item that does not read, or repeats an id, is dropped. At most `MAX_ITEMS`.
 */
export function readItems(raw: unknown): AgendaItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AgendaItem[] = [];
  for (const r of raw) {
    if (out.length >= MAX_ITEMS) break;
    if (!isRecord(r) || typeof r.id !== 'string' || !ID.test(r.id) || seen.has(r.id)) continue;
    if (typeof r.title !== 'string' || !finite(r.minutes)) continue;
    seen.add(r.id);
    const item: AgendaItem = {
      id: r.id,
      title: r.title.slice(0, MAX_TITLE),
      minutes: Math.min(MAX_MINUTES, Math.max(0, r.minutes)),
    };
    if (typeof r.notes === 'string' && r.notes) item.notes = r.notes.slice(0, MAX_NOTES);
    out.push(item);
  }
  return out;
}

/** A number per item id, kept only where it is a non-negative number. */
function readTimes(raw: unknown, items: readonly AgendaItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const item of items) {
    const v = Object.hasOwn(raw, item.id) ? raw[item.id] : undefined;
    if (finite(v) && v >= 0) out[item.id] = v;
  }
  return out;
}

/**
 * A state from untrusted data, checked against `items`, or null when it is not one. Times that are
 * not numbers are dropped; a position outside the items, or a running item with no start, is
 * refused rather than guessed.
 */
export function readAgendaState(raw: unknown, items: readonly AgendaItem[]): AgendaState | null {
  if (!isRecord(raw) || !Number.isInteger(raw.current)) return null;
  const current = raw.current as number;
  if (current < -1 || current > items.length) return null;
  const startedAt = raw.startedAt === null ? null : finite(raw.startedAt) ? raw.startedAt : undefined;
  const pausedAt = raw.pausedAt === null ? null : finite(raw.pausedAt) ? raw.pausedAt : undefined;
  if (startedAt === undefined || pausedAt === undefined) return null;
  const live = current >= 0 && current < items.length;
  if (live && startedAt === null) return null;
  if (!live && (startedAt !== null || pausedAt !== null)) return null;
  if (pausedAt !== null && startedAt !== null && pausedAt < startedAt) return null;
  return {
    current,
    startedAt,
    pausedAt,
    extra: readTimes(raw.extra, items),
    spent: readTimes(raw.spent, items),
  };
}

/** A message's agenda, or null when it does not read. */
export function readSnapshot(message: Extract<AgendaMessage, { kind: 'agenda-state' }>): AgendaSnapshot | null {
  if (!finite(message.seq) || message.seq < 0) return null;
  const items = readItems(message.items);
  const state = readAgendaState(message.state, items);
  return state ? { items, state, seq: message.seq } : null;
}

/**
 * Whether the controlling window applies a second screen's intent: not when it has already applied
 * one with this `id` (a repeated message), and not when it was made against a different state
 * (`seq`), such as a tap on a screen that has since been overtaken.
 */
export function acceptIntent(seq: number, intent: { id: string; seq: number }, applied: ReadonlySet<string>): boolean {
  return intent.seq === seq && !applied.has(intent.id);
}

/** The event with `at` set to the controlling window's clock. Events without a time are as they were. */
export function stampEvent(event: AgendaEvent, at: number): AgendaEvent {
  switch (event.type) {
    case 'start':
    case 'next':
    case 'back':
    case 'pause':
    case 'resume':
      return { ...event, at };
    case 'extend':
    case 'reset':
      return event;
  }
}

/** True for an event that has the shape of one, so an intent from the network is never trusted blind. */
export function isAgendaEvent(raw: unknown): raw is AgendaEvent {
  if (!isRecord(raw)) return false;
  switch (raw.type) {
    case 'start':
    case 'pause':
    case 'resume':
      return finite(raw.at);
    case 'next':
    case 'back':
      return finite(raw.at) && Number.isInteger(raw.from);
    case 'extend':
      return finite(raw.minutes) && Math.abs(raw.minutes) <= MAX_MINUTES;
    case 'reset':
      return true;
    default:
      return false;
  }
}

// --- Keeping an agenda across a refresh ----------------------------------------------

/** How far `restoreAgenda` moves `seq` ahead, so a screen takes the restored agenda as the newest. */
export const AGENDA_SEQ_JUMP = 1_000;

/** The agenda as text, to keep in `localStorage`, so a presenter who refreshes goes on where they were. */
export function serializeAgenda(snapshot: AgendaSnapshot): string {
  return JSON.stringify(snapshot);
}

/** The agenda from text written by `serializeAgenda`, or null when it is not one. Rebuilt and checked. */
export function restoreAgenda(text: string | null | undefined): AgendaSnapshot | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || !finite(raw.seq) || raw.seq < 0) return null;
  const items = readItems(raw.items);
  if (items.length === 0) return null;
  const state = readAgendaState(raw.state, items);
  return state ? { items, state, seq: raw.seq + AGENDA_SEQ_JUMP } : null;
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
): { load(): AgendaSnapshot | null; save(snapshot: AgendaSnapshot): void; clear(): void } {
  return {
    load() {
      try {
        return restoreAgenda(storage?.getItem(key));
      } catch {
        return null;
      }
    },
    save(snapshot) {
      try {
        storage?.setItem(key, serializeAgenda(snapshot));
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
