/**
 * @interlace/ui — games/live-text-model
 *
 * Puts the activities where people type short text on a live room's own state: the word cloud, the open
 * wall (and the reflections a person chooses to share to it) and the sticky-note board. Their pure models
 * (`word-cloud-model`, `text-safety-model`, `note-board-model`) and components are unchanged; this is the
 * room side only. Each is an `ActivityReducer` the host runs and a `read…` that gives back the model's own
 * shape, treating what the room holds as untrusted.
 *
 * ## Nothing typed reaches a screen unchecked
 *
 * Every text passes `checkText` on the host (shape limits, no links, emails or phone numbers, and the
 * consumer's blocklist) however the phone behaved, and the open wall holds new posts for the host's review
 * by default (`moderated`): a post is `review` until approved, and a dismissed one is archived, never shown.
 *
 * ## What the room guarantees, so these do not have to
 *
 * - A move is applied once however many times it arrives, a phone sends it again until the host shows
 *   it, and a late joiner, a reconnect and a refreshed host get the same slice.
 * - The host's clock stamps every move, and who made it is the room's `playerId`.
 *
 * Not anonymous: the room holds who wrote what (so a removed player's words go with them, and the host
 * can moderate), which the host and a client reading the room's state can see. Screens show no names.
 */

import type { ActivityReducer, RoomState } from './room-model.js';
import { readShared } from './room-model.js';
import { cleanLabel, finite, isId, isRecord, isStr, presentIds } from './room-activity-kit.js';
import type { BoardMove, BoardNote } from './note-board-model.js';
import { checkText, foldText, type TextRules } from './text-safety-model.js';
import type { CloudEntry } from './word-cloud-model.js';

export const CLOUD_KEY = 'cloud';
export const WALL_KEY = 'wall';
export const NOTES_KEY = 'notes';

type Room = Pick<RoomState, 'shared' | 'players'> | null | undefined;

/** The most things any of these holds, so a room's state cannot grow without bound. */
export const MAX_WORDS_IN_ROOM = 600;
export const MAX_POSTS_IN_ROOM = 300;
export const MAX_NOTES_IN_ROOM = 200;

// --- Word cloud ----------------------------------------------------------------------------

export interface CloudState {
  /** One word per entry, with who sent it, in the order they arrived. */
  entries: { by: string; text: string }[];
  /** The most words one person may send. */
  maxWords: number;
  open: boolean;
}

function decodeCloud(raw: unknown): CloudState | null {
  if (!isRecord(raw) || !Array.isArray(raw.entries) || typeof raw.maxWords !== 'number' || !Number.isInteger(raw.maxWords) || raw.maxWords < 1 || raw.maxWords > 10) return null;
  const entries: CloudState['entries'] = [];
  for (const e of raw.entries) if (isRecord(e) && isStr(e.by, 64) && isStr(e.text, 60)) entries.push({ by: e.by, text: e.text });
  return { entries: entries.slice(0, MAX_WORDS_IN_ROOM), maxWords: raw.maxWords, open: raw.open !== false };
}

/** The cloud a room holds, as the entries `buildCloud` and `WordCloud` take (`by` is there so `viewer` can mark a person's own). Null before the host starts it. */
export function readCloud(room: Room): (CloudState & { words: CloudEntry[] }) | null {
  const state = readShared(room, CLOUD_KEY, decodeCloud);
  if (!state || !room) return null;
  const here = presentIds(room);
  const entries = state.entries.filter((e) => here.has(e.by));
  return { ...state, entries, words: entries.map((e) => ({ text: e.text, by: e.by })) };
}

/**
 * The word cloud as an activity. The host starts it (`{ type: 'start', maxWords? }`), opens or closes
 * it (`open`) and clears it; a phone sends one word at a time (`{ type: 'word', text }`), up to
 * `maxWords` (3), the same word at most once, after `checkText` with `rules` (a blocklist, say).
 */
export const cloudActivity = (rules: TextRules = {}): ActivityReducer => (slice, action, ctx) => {
  if (!isRecord(action) || typeof action.type !== 'string') return { refuse: 'bad-action' };
  if (action.type === 'start') {
    if (!ctx.host) return { refuse: 'not-host' };
    const maxWords = action.maxWords === undefined ? 3 : action.maxWords;
    return typeof maxWords === 'number' && Number.isInteger(maxWords) && maxWords >= 1 && maxWords <= 10
      ? { slice: { entries: [], maxWords, open: true } satisfies CloudState }
      : { refuse: 'bad-action' };
  }
  const state = decodeCloud(slice);
  if (action.type === 'word') {
    if (ctx.host || typeof action.text !== 'string') return { refuse: 'bad-action' };
    if (!state) return { refuse: 'wrong-phase' };
    const checked = checkText(action.text, { ...rules, maxLength: Math.min(rules.maxLength ?? 25, 25), maxWords: 1 });
    if (!checked.ok) return { refuse: 'bad-action' };
    if (!state.open) return { refuse: 'wrong-phase' };
    const mine = state.entries.filter((e) => e.by === ctx.playerId);
    if (mine.length >= state.maxWords || mine.some((e) => foldText(e.text) === foldText(checked.text))) return { refuse: 'bad-action' };
    if (state.entries.length >= MAX_WORDS_IN_ROOM) return { refuse: 'full' };
    return { slice: { ...state, entries: [...state.entries, { by: ctx.playerId, text: checked.text }] } };
  }
  if (action.type === 'open' || action.type === 'clear') {
    if (!ctx.host) return { refuse: 'not-host' };
    if (!state) return { refuse: 'wrong-phase' };
    if (action.type === 'clear') return { slice: { ...state, entries: [], open: true } };
    return typeof action.on === 'boolean' ? { slice: { ...state, open: action.on } } : { refuse: 'bad-action' };
  }
  return { refuse: 'bad-action' };
};

// --- Open wall -----------------------------------------------------------------------------

export type PostStatus = 'review' | 'live' | 'dismissed';
const STATUSES: readonly PostStatus[] = ['review', 'live', 'dismissed'];

export interface WallEntry {
  id: string;
  text: string;
  by: string;
  at: number;
  status: PostStatus;
}

export interface WallState {
  posts: WallEntry[];
  /** New posts wait for the host's approval. @default true */
  moderated: boolean;
  open: boolean;
  /** The post the host has put in the spotlight, or null. */
  spotlight: string | null;
  /** How many posts there have been: the number in the newest id. */
  n: number;
}

/** The most posts one person may have waiting or showing. */
export const POSTS_PER_PLAYER = 5;

function decodeWall(raw: unknown): WallState | null {
  if (!isRecord(raw) || !Array.isArray(raw.posts) || !finite(raw.n)) return null;
  const posts: WallEntry[] = [];
  for (const p of raw.posts) {
    if (!isRecord(p) || !isStr(p.id, 24) || typeof p.text !== 'string' || !isStr(p.by, 64) || !finite(p.at)) continue;
    if (!STATUSES.includes(p.status as PostStatus)) continue;
    posts.push({ id: p.id, text: p.text, by: p.by, at: p.at, status: p.status as PostStatus });
  }
  return {
    posts: posts.slice(0, MAX_POSTS_IN_ROOM),
    moderated: raw.moderated !== false,
    open: raw.open !== false,
    spotlight: typeof raw.spotlight === 'string' ? raw.spotlight : null,
    n: raw.n,
  };
}

/** The wall a room holds, without posts from anyone no longer in it, and a spotlight only on a post that is showing. Null before the host starts it. */
export function readWall(room: Room): (WallState & { live: WallEntry[]; review: WallEntry[] }) | null {
  const state = readShared(room, WALL_KEY, decodeWall);
  if (!state || !room) return null;
  const here = presentIds(room);
  const posts = state.posts.filter((p) => here.has(p.by));
  const live = posts.filter((p) => p.status === 'live').sort((a, b) => b.at - a.at);
  return {
    ...state,
    posts,
    live,
    review: posts.filter((p) => p.status === 'review'),
    spotlight: live.some((p) => p.id === state.spotlight) ? state.spotlight : null,
  };
}

/**
 * The open wall as an activity. The host starts it (`{ type: 'start', moderated? }`), `approve`s or
 * `dismiss`es a post (`{ id }`), puts one in the spotlight (`{ type: 'spotlight', id }`, null to put it
 * down), opens or closes it and clears it; a phone sends a post (`{ type: 'post', text }`), up to five
 * at a time, after `checkText` with `rules`. With `moderated` (the default) a post waits for approval.
 */
export const wallActivity = (rules: TextRules = {}): ActivityReducer => (slice, action, ctx) => {
  if (!isRecord(action) || typeof action.type !== 'string') return { refuse: 'bad-action' };
  if (action.type === 'start') {
    if (!ctx.host) return { refuse: 'not-host' };
    const moderated = action.moderated === undefined ? true : action.moderated;
    return typeof moderated === 'boolean'
      ? { slice: { posts: [], moderated, open: true, spotlight: null, n: 0 } satisfies WallState }
      : { refuse: 'bad-action' };
  }
  const state = decodeWall(slice);
  if (action.type === 'post') {
    if (ctx.host || typeof action.text !== 'string') return { refuse: 'bad-action' };
    if (!state) return { refuse: 'wrong-phase' };
    const checked = checkText(action.text, rules);
    if (!checked.ok) return { refuse: 'bad-action' };
    if (!state.open) return { refuse: 'wrong-phase' };
    const mine = state.posts.filter((p) => p.by === ctx.playerId && p.status !== 'dismissed');
    if (mine.length >= POSTS_PER_PLAYER) return { refuse: 'rate-limited' };
    if (state.posts.length >= MAX_POSTS_IN_ROOM) return { refuse: 'full' };
    const n = state.n + 1;
    const post: WallEntry = { id: `w${n}`, text: checked.text, by: ctx.playerId, at: ctx.at, status: state.moderated ? 'review' : 'live' };
    return { slice: { ...state, posts: [...state.posts, post], n } };
  }
  if (action.type === 'approve' || action.type === 'dismiss' || action.type === 'spotlight' || action.type === 'open' || action.type === 'clear') {
    if (!ctx.host) return { refuse: 'not-host' };
    if (!state) return { refuse: 'wrong-phase' };
    if (action.type === 'clear') return { slice: { ...state, posts: [], spotlight: null, open: true } };
    if (action.type === 'open') return typeof action.on === 'boolean' ? { slice: { ...state, open: action.on } } : { refuse: 'bad-action' };
    if (action.type === 'spotlight') {
      if (action.id === null) return { slice: { ...state, spotlight: null } };
      return isStr(action.id, 24) && state.posts.some((p) => p.id === action.id && p.status === 'live')
        ? { slice: { ...state, spotlight: action.id } }
        : { refuse: 'bad-action' };
    }
    if (!isStr(action.id, 24) || !state.posts.some((p) => p.id === action.id)) return { refuse: 'bad-action' };
    const status: PostStatus = action.type === 'approve' ? 'live' : 'dismissed';
    return {
      slice: {
        ...state,
        posts: state.posts.map((p) => (p.id === action.id ? { ...p, status } : p)),
        spotlight: status === 'dismissed' && state.spotlight === action.id ? null : state.spotlight,
      },
    };
  }
  return { refuse: 'bad-action' };
};

// --- Sticky-note board ------------------------------------------------------------------------

export interface NotesState {
  columns: { id: string; label: string }[];
  notes: (BoardNote & { by: string })[];
  /** Each note's latest move, so the list cannot grow past the notes. */
  moves: BoardMove[];
  open: boolean;
  /** How many notes there have been: the number in the newest id. */
  n: number;
}

/** The most notes one person may post. */
export const NOTES_PER_PLAYER = 10;

function decodeNotes(raw: unknown): NotesState | null {
  if (!isRecord(raw) || !Array.isArray(raw.columns) || !Array.isArray(raw.notes) || !Array.isArray(raw.moves) || !finite(raw.n)) return null;
  if (raw.columns.length < 2 || raw.columns.length > 6) return null;
  const columns: NotesState['columns'] = [];
  for (const c of raw.columns) {
    const label = isRecord(c) ? cleanLabel(c.label, 40) : null;
    if (!isRecord(c) || !isId(c.id) || label === null || columns.some((x) => x.id === c.id)) return null;
    columns.push({ id: c.id, label });
  }
  const has = new Set(columns.map((c) => c.id));
  const notes: NotesState['notes'] = [];
  for (const n of raw.notes) {
    if (isRecord(n) && isStr(n.id, 24) && typeof n.text === 'string' && isStr(n.by, 64) && finite(n.at) && typeof n.column === 'string' && has.has(n.column)) {
      notes.push({ id: n.id, column: n.column, text: n.text, by: n.by, at: n.at });
    }
  }
  const moves: BoardMove[] = [];
  for (const m of raw.moves) if (isRecord(m) && isStr(m.id, 24) && typeof m.column === 'string' && has.has(m.column) && finite(m.at)) moves.push({ id: m.id, column: m.column, at: m.at });
  return { columns, notes: notes.slice(0, MAX_NOTES_IN_ROOM), moves: moves.slice(0, MAX_NOTES_IN_ROOM), open: raw.open !== false, n: raw.n };
}

/** The board a room holds, without notes from anyone no longer in it (and the moves of notes that are gone). Null before the host starts it. */
export function readNotes(room: Room): NotesState | null {
  const state = readShared(room, NOTES_KEY, decodeNotes);
  if (!state || !room) return null;
  const here = presentIds(room);
  const notes = state.notes.filter((n) => here.has(n.by));
  const ids = new Set(notes.map((n) => n.id));
  return { ...state, notes, moves: state.moves.filter((m) => ids.has(m.id)) };
}

/**
 * The note board as an activity. The host starts it with its columns (`{ type: 'start', columns: [{ id,
 * label }] }`, two to six), opens or closes it and clears it; a phone posts a note (`{ type: 'add',
 * column, text }`, up to ten, after `checkText` with `rules`) and any phone moves a note to another
 * column (`{ type: 'move', id, column }`): the sorting is the room's.
 */
export const notesActivity = (rules: TextRules = {}): ActivityReducer => (slice, action, ctx) => {
  if (!isRecord(action) || typeof action.type !== 'string') return { refuse: 'bad-action' };
  if (action.type === 'start') {
    if (!ctx.host) return { refuse: 'not-host' };
    const fresh = decodeNotes({ columns: action.columns, notes: [], moves: [], n: 0 });
    return fresh ? { slice: fresh } : { refuse: 'bad-action' };
  }
  const state = decodeNotes(slice);
  if (action.type === 'add' || action.type === 'move') {
    if (ctx.host) return { refuse: 'bad-action' };
    if (!state) return { refuse: 'wrong-phase' };
    if (typeof action.column !== 'string' || !state.columns.some((c) => c.id === action.column)) return { refuse: 'bad-action' };
    if (action.type === 'move') {
      if (!isStr(action.id, 24) || !state.notes.some((n) => n.id === action.id)) return { refuse: 'bad-action' };
      if (!state.open) return { refuse: 'wrong-phase' };
      return { slice: { ...state, moves: [...state.moves.filter((m) => m.id !== action.id), { id: action.id, column: action.column, at: ctx.at }] } };
    }
    if (typeof action.text !== 'string') return { refuse: 'bad-action' };
    const checked = checkText(action.text, { maxLength: 140, ...rules });
    if (!checked.ok) return { refuse: 'bad-action' };
    if (!state.open) return { refuse: 'wrong-phase' };
    if (state.notes.filter((n) => n.by === ctx.playerId).length >= NOTES_PER_PLAYER) return { refuse: 'rate-limited' };
    if (state.notes.length >= MAX_NOTES_IN_ROOM) return { refuse: 'full' };
    const n = state.n + 1;
    return { slice: { ...state, notes: [...state.notes, { id: `n${n}`, column: action.column, text: checked.text, by: ctx.playerId, at: ctx.at }], n } };
  }
  if (action.type === 'open' || action.type === 'clear') {
    if (!ctx.host) return { refuse: 'not-host' };
    if (!state) return { refuse: 'wrong-phase' };
    if (action.type === 'clear') return { slice: { ...state, notes: [], moves: [], open: true } };
    return typeof action.on === 'boolean' ? { slice: { ...state, open: action.on } } : { refuse: 'bad-action' };
  }
  return { refuse: 'bad-action' };
};
