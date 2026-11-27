/**
 * @interlace/ui — games/debate-corners-model
 *
 * A statement with two to four positions, one in each corner of the room. Each person picks the
 * corner they stand in, may move until the host locks it, and the host calls one corner at a time
 * to defend its position. The model is pure; `cornersActivity` is the same thing as a rule a live
 * room runs, and `readCorners` turns what the room holds back into the model's shape, treating it as
 * untrusted.
 *
 * ## What the room guarantees, so this does not have to
 *
 * - A move is applied once however often it arrives; a phone sends it again until the host shows it.
 * - Who picked is the room's `playerId`, never a field the phone wrote.
 * - A late joiner, a reconnecting phone and a host that refreshes all get the same slice.
 *
 * ## What this adds
 *
 * - Only the host sets the statement, locks the corners and calls one; a phone only picks its own.
 * - A person is in one corner at a time; picking again moves them.
 * - A player who is removed disappears from every count, without anyone rewriting the slice.
 * - Anything that is not the shape of a move is refused as `bad-action`, never half-applied.
 */

import type { ActivityReducer, RoomState } from './room-model.js';
import { readShared } from './room-model.js';
import { cleanLabel, isId, isRecord, isStr, presentIds } from './room-activity-kit.js';

export const CORNERS_KEY = 'corners';
export const MIN_CORNERS = 2;
export const MAX_CORNERS = 4;
const MAX_LABEL = 60;
const MAX_STATEMENT = 200;

export interface Corner {
  id: string;
  label: string;
}

export interface CornersState {
  statement: string;
  corners: Corner[];
  /** Each player's corner, by player id. */
  picks: Record<string, string>;
  /** False once the host has locked it: nobody moves. */
  open: boolean;
  /** The corner the host has called to defend its position, or null. */
  speaking: string | null;
}

/** The corners a host may send: two to four, each with its own id and a plain label. Null when they are not. */
export function cleanCorners(raw: unknown): Corner[] | null {
  if (!Array.isArray(raw) || raw.length < MIN_CORNERS || raw.length > MAX_CORNERS) return null;
  const seen = new Set<string>();
  const out: Corner[] = [];
  for (const c of raw) {
    if (!isRecord(c) || !isId(c.id) || seen.has(c.id)) return null;
    const label = cleanLabel(c.label, MAX_LABEL);
    if (label === null) return null;
    seen.add(c.id);
    out.push({ id: c.id, label });
  }
  return out;
}

/** A fresh round: nobody has picked, and it is open. Null when the statement or the corners are not usable. */
export function createCorners(statement: unknown, corners: unknown): CornersState | null {
  const s = cleanLabel(statement, MAX_STATEMENT);
  const cs = cleanCorners(corners);
  return s === null || cs === null ? null : { statement: s, corners: cs, picks: {}, open: true, speaking: null };
}

export interface CornerCount {
  id: string;
  label: string;
  count: number;
  /** 0 to 1: this corner's part of everyone who picked. */
  share: number;
  /** The host has called this corner to defend. */
  speaking: boolean;
}

export interface CornersTally {
  /** How many have picked. */
  total: number;
  /** The corners in the host's order. */
  corners: CornerCount[];
  /** The corner with the most (the first when level), or null before anyone picks. */
  leading: string | null;
}

/** How many are in each corner. A pick for a corner that is not there counts nowhere. */
export function tallyCorners(state: Pick<CornersState, 'corners' | 'picks' | 'speaking'>): CornersTally {
  const counts = new Map(state.corners.map((c) => [c.id, 0]));
  for (const id of Object.values(state.picks)) if (counts.has(id)) counts.set(id, (counts.get(id) as number) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const corners = state.corners.map((c) => ({
    id: c.id,
    label: c.label,
    count: counts.get(c.id) as number,
    share: total > 0 ? (counts.get(c.id) as number) / total : 0,
    speaking: state.speaking === c.id,
  }));
  const top = Math.max(...corners.map((c) => c.count));
  return { total, corners, leading: total > 0 ? (corners.find((c) => c.count === top) as CornerCount).id : null };
}

// --- The room --------------------------------------------------------------------

function decodeCorners(raw: unknown): CornersState | null {
  if (!isRecord(raw) || !isRecord(raw.picks)) return null;
  const corners = cleanCorners(raw.corners);
  const statement = cleanLabel(raw.statement, MAX_STATEMENT);
  if (!corners || statement === null) return null;
  const ids = new Set(corners.map((c) => c.id));
  const picks: Record<string, string> = {};
  for (const [by, id] of Object.entries(raw.picks)) if (isStr(by, 64) && typeof id === 'string' && ids.has(id)) picks[by] = id;
  return {
    statement,
    corners,
    picks,
    open: raw.open !== false,
    speaking: typeof raw.speaking === 'string' && ids.has(raw.speaking) ? raw.speaking : null,
  };
}

/** The corners a room holds, without anyone no longer in it. Null before the host starts them. */
export function readCorners(room: Pick<RoomState, 'shared' | 'players'> | null | undefined): CornersState | null {
  const state = readShared(room, CORNERS_KEY, decodeCorners);
  if (!state || !room) return null;
  const here = presentIds(room);
  return { ...state, picks: Object.fromEntries(Object.entries(state.picks).filter(([by]) => here.has(by))) };
}

/**
 * The corners as an activity. The host starts (`{ type: 'start', statement, corners }`), locks
 * (`lock`), calls one corner (`call`) and clears; a phone picks (`{ type: 'pick', corner }`).
 */
export const cornersActivity: ActivityReducer = (slice, action, ctx) => {
  if (!isRecord(action) || typeof action.type !== 'string') return { refuse: 'bad-action' };
  if (action.type === 'start') {
    if (!ctx.host) return { refuse: 'not-host' };
    const fresh = createCorners(action.statement, action.corners);
    return fresh ? { slice: fresh } : { refuse: 'bad-action' };
  }
  const state = decodeCorners(slice);
  if (action.type === 'pick') {
    if (ctx.host || !isStr(action.corner, 24)) return { refuse: 'bad-action' };
    if (!state) return { refuse: 'wrong-phase' };
    if (!state.corners.some((c) => c.id === action.corner)) return { refuse: 'bad-action' };
    if (!state.open) return { refuse: 'wrong-phase' };
    return { slice: { ...state, picks: { ...state.picks, [ctx.playerId]: action.corner } } };
  }
  if (action.type === 'lock' || action.type === 'call' || action.type === 'clear') {
    if (!ctx.host) return { refuse: 'not-host' };
    if (!state) return { refuse: 'wrong-phase' };
    if (action.type === 'clear') return { slice: { ...state, picks: {}, speaking: null, open: true } };
    if (action.type === 'lock') return typeof action.on === 'boolean' ? { slice: { ...state, open: !action.on } } : { refuse: 'bad-action' };
    if (action.corner === null) return { slice: { ...state, speaking: null } };
    return isStr(action.corner, 24) && state.corners.some((c) => c.id === action.corner)
      ? { slice: { ...state, speaking: action.corner } }
      : { refuse: 'bad-action' };
  }
  return { refuse: 'bad-action' };
};
