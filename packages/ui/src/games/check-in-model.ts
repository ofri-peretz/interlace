/**
 * @interlace/ui — games/check-in-model
 *
 * A face check-in: "how are you arriving?" with a handful of moods, asked again later in the same
 * session so the room can see whether it moved. It works in the lobby, so early arrivals have
 * something to do. Each mood has a plain word (the face is never the only signal) and a value from
 * -2 to 2, so the room's mood and its shift between two rounds are numbers a recap can repeat.
 * Not anonymous: picks are held by player id so a person can change theirs, which the host and a
 * client reading the room's state can see (`CheckIn` says so). Pure; `checkInActivity` is the same thing as a rule a live room runs and `readCheckIn` reads what
 * the room holds back as untrusted data.
 */

import type { ActivityReducer, RoomState } from './room-model.js';
import { readShared } from './room-model.js';
import { cleanLabel, finite, isId, isRecord, isStr, presentIds } from './room-activity-kit.js';

export const CHECK_IN_KEY = 'check-in';
export const MAX_ROUNDS = 4;
const MAX_LABEL = 24;

export interface Mood {
  id: string;
  /** The word a screen reader says and a phone shows under the face. */
  label: string;
  /** -2 (low) to 2 (high). */
  value: number;
}

/** Five moods, the faces being the consumer's to draw. */
export const DEFAULT_MOODS: readonly Mood[] = [
  { id: 'great', label: 'Great', value: 2 },
  { id: 'good', label: 'Good', value: 1 },
  { id: 'okay', label: 'Okay', value: 0 },
  { id: 'low', label: 'Low', value: -1 },
  { id: 'rough', label: 'Rough', value: -2 },
];

/** Two to six moods, each with its own id, a plain label and a value from -2 to 2. Null when they are not. */
export function cleanMoods(raw: unknown): Mood[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 6) return null;
  const seen = new Set<string>();
  const out: Mood[] = [];
  for (const m of raw) {
    if (!isRecord(m) || !isId(m.id) || seen.has(m.id) || !finite(m.value) || m.value < -2 || m.value > 2) return null;
    const label = cleanLabel(m.label, MAX_LABEL);
    if (label === null) return null;
    seen.add(m.id);
    out.push({ id: m.id, label, value: m.value });
  }
  return out;
}

export interface MoodSummary {
  count: number;
  /** Per mood, in the host's order. */
  counts: { id: string; label: string; count: number }[];
  /** The average value, -2 to 2; null with no answers. */
  mean: number | null;
  /** The mood most people chose (the first when level); null with no answers. */
  top: string | null;
}

/** How a round of picks (mood id by player) reads. A pick for a mood that is not there counts nowhere. */
export function summarizeMoods(moods: readonly Mood[], picks: Readonly<Record<string, string>>): MoodSummary {
  const counts = moods.map((m) => ({ id: m.id, label: m.label, count: 0 }));
  let sum = 0;
  let count = 0;
  for (const id of Object.values(picks)) {
    const i = moods.findIndex((m) => m.id === id);
    if (i < 0) continue;
    (counts[i] as { count: number }).count += 1;
    sum += (moods[i] as Mood).value;
    count += 1;
  }
  const best = Math.max(...counts.map((c) => c.count));
  return { count, counts, mean: count === 0 ? null : sum / count, top: count === 0 ? null : (counts.find((c) => c.count === best) as { id: string }).id };
}

/** How far the room's mood moved from one round to the next, or null when either has no answers. */
export function moodShift(moods: readonly Mood[], before: Readonly<Record<string, string>>, after: Readonly<Record<string, string>>): number | null {
  const a = summarizeMoods(moods, before).mean;
  const b = summarizeMoods(moods, after).mean;
  return a === null || b === null ? null : b - a;
}

// --- The room --------------------------------------------------------------------

export interface CheckInState {
  moods: Mood[];
  /** The rounds asked so far, in order; the last is the one open for answers. */
  rounds: string[];
  /** Each round's picks: mood id by player id. */
  picks: Record<string, Record<string, string>>;
  open: boolean;
}

function decodeCheckIn(raw: unknown): CheckInState | null {
  if (!isRecord(raw) || !Array.isArray(raw.rounds) || !isRecord(raw.picks)) return null;
  const moods = cleanMoods(raw.moods);
  if (!moods || raw.rounds.length < 1 || raw.rounds.length > MAX_ROUNDS) return null;
  const rounds = [...new Set(raw.rounds)];
  if (!rounds.every((r): r is string => isId(r)) || rounds.length !== raw.rounds.length) return null;
  const ids = new Set(moods.map((m) => m.id));
  const picks: Record<string, Record<string, string>> = {};
  for (const r of rounds) {
    const own: Record<string, string> = {};
    const stored = Object.hasOwn(raw.picks, r) ? raw.picks[r] : null;
    if (isRecord(stored)) for (const [by, id] of Object.entries(stored)) if (isStr(by, 64) && typeof id === 'string' && ids.has(id)) own[by] = id;
    picks[r] = own;
  }
  return { moods, rounds, picks, open: raw.open !== false };
}

/** The check-in a room holds, without picks from anyone no longer in it. Null before the host starts it. */
export function readCheckIn(room: Pick<RoomState, 'shared' | 'players'> | null | undefined): CheckInState | null {
  const state = readShared(room, CHECK_IN_KEY, decodeCheckIn);
  if (!state || !room) return null;
  const here = presentIds(room);
  return {
    ...state,
    picks: Object.fromEntries(Object.entries(state.picks).map(([r, p]) => [r, Object.fromEntries(Object.entries(p).filter(([by]) => here.has(by)))])),
  };
}

/** The round open for answers. */
export const currentRound = (state: Pick<CheckInState, 'rounds'>): string => state.rounds[state.rounds.length - 1] as string;

/**
 * The check-in as an activity. The host starts it (`{ type: 'start', round?, moods? }`), asks again
 * (`{ type: 'round', id }`, which keeps the earlier rounds), closes (`open`) and clears the round
 * that is open; a phone picks its mood (`{ type: 'pick', mood }`) and picks again to change it.
 */
export const checkInActivity: ActivityReducer = (slice, action, ctx) => {
  if (!isRecord(action) || typeof action.type !== 'string') return { refuse: 'bad-action' };
  if (action.type === 'start') {
    if (!ctx.host) return { refuse: 'not-host' };
    const moods = action.moods === undefined ? [...DEFAULT_MOODS] : cleanMoods(action.moods);
    const round = action.round === undefined ? 'start' : action.round;
    if (!moods || !isId(round)) return { refuse: 'bad-action' };
    return { slice: { moods, rounds: [round], picks: { [round]: {} }, open: true } satisfies CheckInState };
  }
  const state = decodeCheckIn(slice);
  if (action.type === 'pick') {
    if (ctx.host || !isStr(action.mood, 24)) return { refuse: 'bad-action' };
    if (!state) return { refuse: 'wrong-phase' };
    if (!state.moods.some((m) => m.id === action.mood)) return { refuse: 'bad-action' };
    if (!state.open) return { refuse: 'wrong-phase' };
    const round = currentRound(state);
    return { slice: { ...state, picks: { ...state.picks, [round]: { ...state.picks[round], [ctx.playerId]: action.mood } } } };
  }
  if (action.type === 'round' || action.type === 'open' || action.type === 'clear') {
    if (!ctx.host) return { refuse: 'not-host' };
    if (!state) return { refuse: 'wrong-phase' };
    if (action.type === 'clear') return { slice: { ...state, picks: { ...state.picks, [currentRound(state)]: {} }, open: true } };
    if (action.type === 'open') return typeof action.on === 'boolean' ? { slice: { ...state, open: action.on } } : { refuse: 'bad-action' };
    if (!isId(action.id) || state.rounds.includes(action.id) || state.rounds.length >= MAX_ROUNDS) return { refuse: 'bad-action' };
    return { slice: { ...state, rounds: [...state.rounds, action.id], picks: { ...state.picks, [action.id]: {} }, open: true } };
  }
  return { refuse: 'bad-action' };
};
