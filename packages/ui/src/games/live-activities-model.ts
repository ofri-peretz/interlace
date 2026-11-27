/**
 * @interlace/ui — games/live-activities-model
 *
 * Puts the Q&A board, reactions, raised hands and the spectrum (their pure models) on a live
 * room's own state, so they keep the room's guarantees without any of them knowing about a
 * network. Each is an `ActivityReducer` (`RoomSettings.activities`) that runs on the host, and a
 * `read…` that turns what the room holds back into the model's own shape, treating it as
 * untrusted. A player's phone sends its move with a `submit` event (`submit.ts` builds them).
 *
 * ## What the room guarantees, so these do not have to
 *
 * - A move is applied once however many times it arrives (its `id` is remembered per player), and
 *   a phone sends it again until the host's state shows it.
 * - The host's clock stamps every move (`ctx.at`), never the phone's.
 * - A late joiner, a reconnecting phone and a host that refreshes all get the same slice.
 *
 * ## What these add
 *
 * - Who a move is from is the room's `playerId`, never a field the phone wrote.
 * - A phone may only make a player's moves; moderation and starting over are the host's.
 * - A player who is removed disappears from what every screen reads (their questions, votes,
 *   hands and dot), without anyone rewriting the slice.
 * - Anything that is not the shape of a move is refused as `bad-action`, never half-applied.
 */

import type { ActivityReducer, RoomEvent, RoomState } from './room-model.js';
import { readShared } from './room-model.js';
import {
  applyBoardEvent,
  type BoardEvent,
  type BoardQuestion,
  type BoardRules,
  type BoardState,
  type QuestionStatus,
  createBoard,
} from './question-board-model.js';
import {
  allowReaction,
  applyHandEvent,
  createHands,
  type HandState,
  type RaisedHand,
  type ReactionBudget,
  type ReactionLimitOptions,
} from './reactions-model.js';
import { cleanValues, type SpectrumOptions } from './spectrum-model.js';

export const BOARD_KEY = 'qa';
export const REACTIONS_KEY = 'reactions';
export const HANDS_KEY = 'hands';
export const SPECTRUM_KEY = 'spectrum';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** A key that is safe to use on a plain object (`__proto__` would set its prototype). */
const safe = (k: string) => k !== '__proto__';
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/** `submit` for `key`: what a phone (or the host) sends. `id` must be unique per move. */
export function submitEvent(
  key: string,
  playerId: string,
  id: string,
  action: unknown,
  options: { retry?: boolean } = {},
): RoomEvent {
  return {
    type: 'submit',
    playerId,
    id,
    key,
    action,
    ...(options.retry === false ? { retry: false } : {}),
  };
}

// --- Q&A board -------------------------------------------------------------------

const PLAYER_BOARD = new Set(['ask', 'vote', 'unvote']);
const HOST_BOARD = new Set(['approve', 'dismiss', 'restore', 'answer', 'pin', 'moderate', 'open']);

/** The board's moves. The host begins it (`{ type: 'begin' }`); a player asks and votes. */
export type BoardAction =
  | { type: 'begin'; moderated?: boolean; open?: boolean }
  | { type: 'ask'; text: string }
  | { type: 'vote'; id: string }
  | { type: 'unvote'; id: string }
  | Exclude<BoardEvent, { type: 'ask' | 'vote' | 'unvote' }>;

function decodeBoard(raw: unknown): BoardState | null {
  if (!isRecord(raw) || !Array.isArray(raw.questions) || !finite(raw.seq)) return null;
  const statuses: QuestionStatus[] = ['review', 'live', 'answered', 'dismissed'];
  const questions: BoardQuestion[] = [];
  for (const q of raw.questions) {
    if (!isRecord(q) || !isStr(q.id, 64) || typeof q.text !== 'string' || !isStr(q.by, 64) || !finite(q.at)) continue;
    if (!statuses.includes(q.status as QuestionStatus) || !Array.isArray(q.votes)) continue;
    questions.push({
      id: q.id,
      text: q.text,
      by: q.by,
      at: q.at,
      status: q.status as QuestionStatus,
      votes: [...new Set(q.votes.filter((v): v is string => isStr(v, 64)))],
    });
  }
  return {
    questions,
    moderated: raw.moderated !== false,
    open: raw.open !== false,
    pinned: typeof raw.pinned === 'string' ? raw.pinned : null,
    seq: raw.seq,
  };
}

/** The board a room holds, without what was said by anyone no longer in it. Null before `begin`. */
export function readBoard(room: Pick<RoomState, 'shared' | 'players'> | null | undefined): BoardState | null {
  const board = readShared(room, BOARD_KEY, decodeBoard);
  if (!board || !room) return board;
  const here = new Set(room.players.map((p) => p.id));
  return {
    ...board,
    questions: board.questions
      .filter((q) => here.has(q.by))
      .map((q) => ({ ...q, votes: q.votes.filter((v) => here.has(v)) })),
  };
}

/** The board as an activity. `rules` are the text rules and limits (see `BoardRules`). */
export function boardActivity(rules: BoardRules = {}): ActivityReducer {
  return (slice, action, ctx) => {
    if (!isRecord(action)) return { refuse: 'bad-action' };
    const board = decodeBoard(slice);
    if (action.type === 'begin') {
      if (!ctx.host) return { refuse: 'not-host' };
      return { slice: createBoard({ moderated: action.moderated !== false, open: action.open !== false }) };
    }
    if (!board) return { refuse: 'wrong-phase' };
    let event: BoardEvent;
    if (PLAYER_BOARD.has(action.type as string)) {
      if (ctx.host) return { refuse: 'bad-action' };
      if (action.type === 'ask') {
        if (typeof action.text !== 'string') return { refuse: 'bad-action' };
        event = { type: 'ask', id: `q${board.questions.length + 1}`, text: action.text, by: ctx.playerId, at: ctx.at };
      } else {
        if (!isStr(action.id, 64)) return { refuse: 'bad-action' };
        event = { type: action.type as 'vote' | 'unvote', id: action.id, by: ctx.playerId };
      }
    } else if (HOST_BOARD.has(action.type as string)) {
      if (!ctx.host) return { refuse: 'not-host' };
      if (action.type === 'moderate' || action.type === 'open') {
        if (typeof action.on !== 'boolean') return { refuse: 'bad-action' };
        event = { type: action.type, on: action.on };
      } else if (action.type === 'pin') {
        if (action.id !== null && !isStr(action.id, 64)) return { refuse: 'bad-action' };
        event = { type: 'pin', id: action.id };
      } else {
        if (!isStr(action.id, 64)) return { refuse: 'bad-action' };
        event = { type: action.type as 'approve' | 'dismiss' | 'restore' | 'answer', id: action.id };
      }
    } else return { refuse: 'bad-action' };
    const result = applyBoardEvent(board, event, rules);
    return result.ok ? { slice: result.state } : { refuse: 'bad-action' };
  };
}

// --- Reactions ---------------------------------------------------------------------

export interface LiveReaction {
  /** `r1`, `r2`, … from the room's count, so a screen floats each once. */
  id: string;
  kind: string;
  by: string;
  at: number;
}

export interface ReactionsState {
  /** How many reactions the room has had, by kind. */
  totals: Record<string, number>;
  /** The latest few, for a screen to float. */
  recent: LiveReaction[];
  /** How many there have been, which is also the number in the newest id. */
  n: number;
  /** Each player's recent times, for the rate limit. */
  budget: ReactionBudget;
}

/** How many recent reactions the room keeps for a screen to float. */
export const RECENT_REACTIONS = 40;
const MAX_KIND = 32;

function decodeReactions(raw: unknown): ReactionsState | null {
  if (!isRecord(raw) || !finite(raw.n) || !isRecord(raw.totals) || !Array.isArray(raw.recent) || !isRecord(raw.budget)) return null;
  const totals: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.totals)) if (isStr(k, MAX_KIND) && finite(v) && v >= 0) totals[k] = v;
  const recent: LiveReaction[] = [];
  for (const r of raw.recent) {
    if (isRecord(r) && isStr(r.id, 20) && isStr(r.kind, MAX_KIND) && isStr(r.by, 64) && finite(r.at))
      recent.push({ id: r.id, kind: r.kind, by: r.by, at: r.at });
  }
  const budget: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(raw.budget)) if (safe(k) && Array.isArray(v)) budget[k] = v.filter(finite);
  return { totals, recent: recent.slice(-RECENT_REACTIONS), n: raw.n, budget };
}

/** The room's reactions, or null before the host starts them. */
export function readReactions(room: Pick<RoomState, 'shared'> | null | undefined): ReactionsState | null {
  return readShared(room, REACTIONS_KEY, decodeReactions);
}

export interface ReactionsOptions extends ReactionLimitOptions {
  /** The kinds a phone may send. Anything else is refused. */
  kinds: readonly string[];
}

/** Reactions as an activity: the host starts (`{ type: 'start' }`) or clears them; a phone reacts. */
export function reactionsActivity(options: ReactionsOptions): ActivityReducer {
  const { kinds, ...limits } = options;
  const empty = (): ReactionsState => ({ totals: Object.fromEntries(kinds.map((k) => [k, 0])), recent: [], n: 0, budget: {} });
  return (slice, action, ctx) => {
    if (!isRecord(action)) return { refuse: 'bad-action' };
    if (action.type === 'start' || action.type === 'clear') return ctx.host ? { slice: empty() } : { refuse: 'not-host' };
    if (action.type !== 'react' || ctx.host) return { refuse: 'bad-action' };
    const state = decodeReactions(slice);
    if (!state) return { refuse: 'wrong-phase' };
    const kind = action.kind as string; // anything that is not one of `kinds` (a number, say) is not in the list
    if (!kinds.includes(kind)) return { refuse: 'bad-action' };
    const spent = allowReaction(state.budget, ctx.playerId, ctx.at, limits);
    if (!spent.ok) return { refuse: 'rate-limited' };
    // Only players with a time in the window stay in the budget, so it does not grow with the room's history.
    const windowMs = limits.windowMs ?? 3000;
    const budget = Object.fromEntries(
      Object.entries(spent.budget)
        .map(([by, times]) => [by, times.filter((t) => ctx.at - t < windowMs)] as const)
        .filter(([, times]) => times.length > 0),
    );
    const n = state.n + 1;
    return {
      slice: {
        totals: { ...state.totals, [kind]: (state.totals[kind] ?? 0) + 1 },
        recent: [...state.recent, { id: `r${n}`, kind, by: ctx.playerId, at: ctx.at }].slice(-RECENT_REACTIONS),
        n,
        budget,
      } satisfies ReactionsState,
    };
  };
}

// --- Raised hands -----------------------------------------------------------------------

function decodeHands(raw: unknown): HandState | null {
  if (!isRecord(raw) || !Array.isArray(raw.hands)) return null;
  const hand = (h: unknown): RaisedHand | null =>
    isRecord(h) && isStr(h.by, 64) && typeof h.name === 'string' && finite(h.at) ? { by: h.by, name: h.name, at: h.at } : null;
  const seen = new Set<string>();
  const hands: RaisedHand[] = [];
  for (const h of raw.hands) {
    const r = hand(h);
    if (r && !seen.has(r.by)) {
      seen.add(r.by);
      hands.push(r);
    }
  }
  return { hands, speaking: hand(raw.speaking) };
}

/** The raised hands, without anyone no longer in the room. Null before the host starts them. */
export function readHands(room: Pick<RoomState, 'shared' | 'players'> | null | undefined): HandState | null {
  const hands = readShared(room, HANDS_KEY, decodeHands);
  if (!hands || !room) return hands;
  const here = new Set(room.players.map((p) => p.id));
  return {
    hands: hands.hands.filter((h) => here.has(h.by)),
    speaking: hands.speaking && here.has(hands.speaking.by) ? hands.speaking : null,
  };
}

/** Raised hands as an activity: the host starts, calls, finishes and clears; a phone raises and lowers its own. */
export const handsActivity: ActivityReducer = (slice, action, ctx) => {
  if (!isRecord(action)) return { refuse: 'bad-action' };
  if (action.type === 'start') return ctx.host ? { slice: createHands() } : { refuse: 'not-host' };
  const state = decodeHands(slice);
  if (!state) return { refuse: 'wrong-phase' };
  if (action.type === 'raise' || action.type === 'lower') {
    if (ctx.host) return { refuse: 'bad-action' };
    const me = ctx.players.find((p) => p.id === ctx.playerId);
    if (!me) return { refuse: 'bad-action' };
    return {
      slice:
        action.type === 'raise'
          ? applyHandEvent(state, { type: 'raise', by: me.id, name: me.name, at: ctx.at })
          : applyHandEvent(state, { type: 'lower', by: me.id }),
    };
  }
  if (action.type === 'call' || action.type === 'done' || action.type === 'clear' || action.type === 'dismiss') {
    if (!ctx.host) return { refuse: 'not-host' };
    if (action.type === 'done') return { slice: applyHandEvent(state, { type: 'done' }) };
    if (action.type === 'clear') return { slice: applyHandEvent(state, { type: 'clear' }) };
    if (action.type === 'dismiss') {
      if (!isStr(action.by, 64)) return { refuse: 'bad-action' };
      return { slice: applyHandEvent(state, { type: 'lower', by: action.by }) };
    }
    if (action.by !== undefined && !isStr(action.by, 64)) return { refuse: 'bad-action' };
    return { slice: applyHandEvent(state, { type: 'call', ...(action.by === undefined ? {} : { by: action.by }) }) };
  }
  return { refuse: 'bad-action' };
};

// --- Spectrum ---------------------------------------------------------------------------

export interface SpectrumState {
  /** Each player's dot, by id: placing again moves it. */
  placed: Record<string, number>;
  /** False once the host has closed it: no dot moves. */
  open: boolean;
}

function decodeSpectrum(raw: unknown): SpectrumState | null {
  if (!isRecord(raw) || !isRecord(raw.placed)) return null;
  const placed: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.placed)) if (isStr(k, 64) && finite(v)) placed[k] = v;
  return { placed, open: raw.open !== false };
}

/** The dots in the room, and the dots as a list, without anyone no longer in it. Null before the host starts it. */
export function readSpectrum(
  room: Pick<RoomState, 'shared' | 'players'> | null | undefined,
): (SpectrumState & { values: number[] }) | null {
  const state = readShared(room, SPECTRUM_KEY, decodeSpectrum);
  if (!state || !room) return null;
  const here = new Set(room.players.map((p) => p.id));
  const placed = Object.fromEntries(Object.entries(state.placed).filter(([id]) => here.has(id)));
  return { ...state, placed, values: Object.values(placed) };
}

/** The spectrum as an activity: the host starts, closes and clears it; a phone places its own dot. */
export function spectrumActivity(options: SpectrumOptions = {}): ActivityReducer {
  return (slice, action, ctx) => {
    if (!isRecord(action)) return { refuse: 'bad-action' };
    if (action.type === 'start' || action.type === 'clear') {
      return ctx.host ? { slice: { placed: {}, open: true } satisfies SpectrumState } : { refuse: 'not-host' };
    }
    const state = decodeSpectrum(slice);
    if (!state) return { refuse: 'wrong-phase' };
    if (action.type === 'open') {
      if (!ctx.host) return { refuse: 'not-host' };
      return typeof action.on === 'boolean' ? { slice: { ...state, open: action.on } } : { refuse: 'bad-action' };
    }
    if (action.type !== 'place' || ctx.host || !finite(action.value)) return { refuse: 'bad-action' };
    if (!state.open) return { refuse: 'wrong-phase' };
    const [value] = cleanValues([action.value], options);
    return { slice: { ...state, placed: { ...state.placed, [ctx.playerId]: value as number } } };
  };
}
