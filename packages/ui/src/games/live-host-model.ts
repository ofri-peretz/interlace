/**
 * @interlace/ui — games/live-host-model
 *
 * Puts the two big-screen activities the host drives on a live room's own state: the picture that is
 * uncovered tile by tile (`PictureReveal`) and the room's shared goal meter (`RoomGoal`). Their pure models
 * (`picture-reveal-model`, `room-goal-model`) and components are unchanged. Nobody but the host moves
 * either: a phone only reads, so the room refuses everything a phone sends. A late joiner, a reconnect
 * and a refreshed host get the same slice, and a move is applied once however many times it arrives.
 *
 * The goal's value is the room's own points (`RoomState.scores`, without anyone no longer in the room), so
 * the meter fills as the quiz is played; what the host adds is the target, the milestones and each round's
 * result (how many were right, for the streak).
 */

import type { ActivityReducer, RoomState } from './room-model.js';
import { readShared } from './room-model.js';
import { cleanLabel, finite, isId, isRecord, presentIds } from './room-activity-kit.js';
import { roomStreak, tallyRoomGoal, type RoomGoalTally, type RoomMilestone } from './room-goal-model.js';

export const REVEAL_KEY = 'reveal';
export const GOAL_KEY = 'goal';

type Room = Pick<RoomState, 'shared' | 'players' | 'scores'> | null | undefined;

// --- Picture reveal -------------------------------------------------------------------------

export interface RevealState {
  /** How many steps the picture is uncovered in. */
  steps: number;
  /** What the shuffle of tiles starts from, so every screen uncovers the same ones. */
  seed: string;
  /** How many steps have been shown: 0 (all covered) to `steps`. */
  step: number;
  /** The whole picture is shown and the answer named. */
  revealed: boolean;
}

function decodeReveal(raw: unknown): RevealState | null {
  if (!isRecord(raw) || !finite(raw.steps) || !Number.isInteger(raw.steps) || raw.steps < 2 || raw.steps > 12) return null;
  if (!isId(raw.seed, 40) || !finite(raw.step) || !Number.isInteger(raw.step) || raw.step < 0 || raw.step > raw.steps) return null;
  return { steps: raw.steps, seed: raw.seed, step: raw.step, revealed: raw.revealed === true };
}

/** The picture a room holds. Null before the host starts it. */
export function readReveal(room: Room): RevealState | null {
  return readShared(room, REVEAL_KEY, decodeReveal);
}

/**
 * The picture reveal as an activity, the host's alone: `{ type: 'start', steps, seed }` covers it,
 * `{ type: 'step', step }` shows more (or fewer), `{ type: 'reveal' }` shows all of it, `{ type:
 * 'cover' }` covers it again. `seed` is letters, digits, `-` and `_`.
 */
export const revealActivity: ActivityReducer = (slice, action, ctx) => {
  if (!isRecord(action) || typeof action.type !== 'string') return { refuse: 'bad-action' };
  if (!ctx.host) return { refuse: 'not-host' };
  if (action.type === 'start') {
    const fresh = decodeReveal({ steps: action.steps, seed: action.seed, step: 0, revealed: false });
    return fresh ? { slice: fresh } : { refuse: 'bad-action' };
  }
  const state = decodeReveal(slice);
  if (!state) return { refuse: 'wrong-phase' };
  if (action.type === 'step') {
    return typeof action.step === 'number' && Number.isInteger(action.step) && action.step >= 0 && action.step <= state.steps
      ? { slice: { ...state, step: action.step, revealed: false } }
      : { refuse: 'bad-action' };
  }
  if (action.type === 'reveal') return { slice: { ...state, step: state.steps, revealed: true } };
  if (action.type === 'cover') return { slice: { ...state, step: 0, revealed: false } };
  return { refuse: 'bad-action' };
};

// --- Room goal ------------------------------------------------------------------------------

export interface GoalState {
  label: string;
  target: number;
  milestones: RoomMilestone[];
  /** Each round's result, as the host sent it, oldest first. */
  rounds: { right: number; answered: number }[];
}

/** The most rounds the room keeps for the streak. */
export const MAX_GOAL_ROUNDS = 60;

function decodeGoal(raw: unknown): GoalState | null {
  if (!isRecord(raw) || !Array.isArray(raw.rounds) || !Array.isArray(raw.milestones)) return null;
  const label = cleanLabel(raw.label, 60);
  if (label === null || !finite(raw.target) || raw.target <= 0 || raw.target > 1_000_000) return null;
  const milestones: RoomMilestone[] = [];
  for (const m of raw.milestones) {
    const name = isRecord(m) ? cleanLabel(m.label, 40) : null;
    if (!isRecord(m) || name === null || !finite(m.at) || m.at <= 0 || m.at > raw.target) continue;
    milestones.push({ at: m.at, label: name });
  }
  const rounds: GoalState['rounds'] = [];
  for (const r of raw.rounds) {
    if (isRecord(r) && finite(r.right) && finite(r.answered) && Number.isInteger(r.right) && Number.isInteger(r.answered) && r.right >= 0 && r.answered >= r.right) {
      rounds.push({ right: r.right, answered: r.answered });
    }
  }
  return { label, target: raw.target, milestones: milestones.slice(0, 8), rounds: rounds.slice(-MAX_GOAL_ROUNDS) };
}

export interface GoalView extends GoalState {
  /** The room's points so far: what `RoomGoal` shows as `value`. */
  value: number;
  tally: RoomGoalTally;
  /** Rounds in a row the room did well: what `RoomGoal` shows as `streak`. */
  streak: number;
}

/** The goal a room holds, with its value from the room's own points. Null before the host starts it. */
export function readGoal(room: Room): GoalView | null {
  const state = readShared(room, GOAL_KEY, decodeGoal);
  if (!state || !room) return null;
  const here = presentIds(room);
  const contributions = Object.entries(room.scores ?? {})
    .filter(([by, points]) => here.has(by) && finite(points) && points > 0)
    .map(([by, points]) => ({ by, round: 'all', points }));
  const tally = tallyRoomGoal(contributions, { target: state.target, milestones: state.milestones });
  return { ...state, value: tally.total, tally, streak: roomStreak(state.rounds).current };
}

/**
 * The room goal as an activity, the host's alone: `{ type: 'start', label, target, milestones? }`, `{
 * type: 'round', right, answered }` after each round (for the streak) and `{ type: 'clear' }`.
 */
export const goalActivity: ActivityReducer = (slice, action, ctx) => {
  if (!isRecord(action) || typeof action.type !== 'string') return { refuse: 'bad-action' };
  if (!ctx.host) return { refuse: 'not-host' };
  if (action.type === 'start') {
    if (action.milestones !== undefined && !Array.isArray(action.milestones)) return { refuse: 'bad-action' };
    const fresh = decodeGoal({ label: action.label, target: action.target, milestones: action.milestones ?? [], rounds: [] });
    return fresh ? { slice: fresh } : { refuse: 'bad-action' };
  }
  const state = decodeGoal(slice);
  if (!state) return { refuse: 'wrong-phase' };
  if (action.type === 'clear') return { slice: { ...state, rounds: [] } };
  if (action.type === 'round') {
    const next = decodeGoal({ ...state, rounds: [{ right: action.right, answered: action.answered }] });
    return next && next.rounds.length === 1 ? { slice: { ...state, rounds: [...state.rounds, ...next.rounds].slice(-MAX_GOAL_ROUNDS) } } : { refuse: 'bad-action' };
  }
  return { refuse: 'bad-action' };
};
