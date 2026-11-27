/**
 * @interlace/ui — games/live-collect-model
 *
 * Puts the activities where each person gives one answer on a live room's own state: the rating, the
 * quadrant, the pin on a picture, the ranking, the points split, the dot vote, the prediction and the
 * typed answer. Their pure models (`rating-model`, `quadrant-model`, …) stay as they are and so do their
 * components; this is the room side only. Each is an `ActivityReducer` (`RoomSettings.activities`) the
 * host runs, and a `read…` that turns what the room holds back into the model's own shape, treating it
 * as untrusted. A player's phone sends its move with a `submit` event (`submitEvent`).
 *
 * ## What the room guarantees, so these do not have to
 *
 * - A move is applied once however many times it arrives, and a phone sends it again until the host's
 *   state shows it; a late joiner, a reconnecting phone and a host that refreshes get the same slice.
 * - The host's clock stamps every move, and who made it is the room's `playerId`.
 *
 * ## What these add
 *
 * - One answer per person: a second send replaces the first while the activity is open (a prediction
 *   and a typed answer are final: the first stands).
 * - The host starts it with the question's own shape (its options, its scale, its budget), and only
 *   the host opens, closes, clears or reveals. A phone's answer is checked against that shape.
 * - A player who is removed disappears from what every screen reads.
 * - Anything that is not the shape of a move is refused as `bad-action`, never half-applied.
 *
 * Not anonymous: the room holds each answer by player id (so it can be replaced, and removed with its
 * player), which the host and a client reading the room's state can see. Screens show shares, not names.
 */

import { cleanBallot } from './dot-vote-model.js';
import { cleanPins, type PinPoint } from './pin-drop-model.js';
import { checkSplit, type Split } from './points-model.js';
import { cleanPoints, type QuadPoint } from './quadrant-model.js';
import { isFullRanking } from './ranking-model.js';
import type { ActivityReducer, RoomState } from './room-model.js';
import { readShared } from './room-model.js';
import { finite, isId, isRecord, isStr, presentIds, safeKey } from './room-activity-kit.js';
import { checkText, type TextRules } from './text-safety-model.js';

export const RATING_KEY = 'rating';
export const QUADRANT_KEY = 'quadrant';
export const PIN_KEY = 'pin';
export const RANKING_KEY = 'ranking';
export const POINTS_KEY = 'points';
export const DOTS_KEY = 'dots';
export const PREDICTION_KEY = 'prediction';
export const TYPED_KEY = 'typed';

// --- The one rule behind all of them -----------------------------------------------------

export interface CollectSpec<M, V, R = never> {
  /** The question's own shape, from the host's `start` (or as stored): checked, and the same when checked again. */
  meta(raw: Record<string, unknown>): M | null;
  /** A person's answer, checked against that shape. Null when it is not one. */
  value(raw: unknown, meta: M): V | null;
  /** The first answer stands. */
  once?: boolean;
  /** What the host reveals (the right place, the outcome). Without it the activity has no `reveal`. */
  reveal?(raw: unknown, meta: M): R | null;
}

export interface Collected<M, V, R = never> {
  meta: M;
  /** Each player's answer, by player id. */
  entries: Record<string, V>;
  /** False once the host has closed it (a reveal closes it). */
  open: boolean;
  revealed: R | null;
}

function decode<M, V, R>(spec: CollectSpec<M, V, R>, raw: unknown): Collected<M, V, R> | null {
  if (!isRecord(raw) || !isRecord(raw.meta) || !isRecord(raw.entries)) return null;
  const meta = spec.meta(raw.meta);
  if (meta === null) return null;
  const entries: Record<string, V> = {};
  for (const [by, v] of Object.entries(raw.entries)) {
    if (!isStr(by, 64)) continue;
    const value = spec.value(v, meta);
    if (value !== null) entries[by] = value;
  }
  const revealed = spec.reveal && raw.revealed !== null && raw.revealed !== undefined ? spec.reveal(raw.revealed, meta) : null;
  return { meta, entries, open: raw.open !== false, revealed };
}

/** An activity where each person gives one answer. The host `start`s, `open`s, `clear`s and `reveal`s; a phone `send`s. */
export function collectActivity<M, V, R = never>(spec: CollectSpec<M, V, R>): ActivityReducer {
  return (slice, action, ctx) => {
    if (!isRecord(action) || typeof action.type !== 'string') return { refuse: 'bad-action' };
    if (action.type === 'start') {
      if (!ctx.host) return { refuse: 'not-host' };
      const meta = spec.meta(action);
      return meta === null ? { refuse: 'bad-action' } : { slice: { meta, entries: {}, open: true, revealed: null } };
    }
    const state = decode(spec, slice);
    if (action.type === 'send') {
      if (ctx.host) return { refuse: 'bad-action' };
      if (!state) return { refuse: 'wrong-phase' };
      const value = spec.value(action.value, state.meta);
      if (value === null) return { refuse: 'bad-action' };
      if (!state.open) return { refuse: 'wrong-phase' };
      if (spec.once && Object.hasOwn(state.entries, ctx.playerId)) return { refuse: 'bad-action' };
      return { slice: { ...state, entries: { ...state.entries, [ctx.playerId]: value } } };
    }
    if (action.type === 'open' || action.type === 'clear' || action.type === 'reveal') {
      if (!ctx.host) return { refuse: 'not-host' };
      if (!state) return { refuse: 'wrong-phase' };
      if (action.type === 'clear') return { slice: { ...state, entries: {}, open: true, revealed: null } };
      if (action.type === 'open') return typeof action.on === 'boolean' ? { slice: { ...state, open: action.on } } : { refuse: 'bad-action' };
      const revealed = spec.reveal ? spec.reveal(action.value, state.meta) : null;
      return revealed === null ? { refuse: 'bad-action' } : { slice: { ...state, revealed, open: false } };
    }
    return { refuse: 'bad-action' };
  };
}

/** What a room holds for an activity, without answers from anyone no longer in it. Null before the host starts it. */
export function readCollected<M, V, R>(
  room: Pick<RoomState, 'shared' | 'players'> | null | undefined,
  key: string,
  spec: CollectSpec<M, V, R>,
): Collected<M, V, R> | null {
  const state = readShared(room, key, (raw) => decode(spec, raw));
  if (!state || !room) return null;
  const here = presentIds(room);
  return { ...state, entries: Object.fromEntries(Object.entries(state.entries).filter(([by]) => here.has(by))) as Record<string, V> };
}

// --- Checks the specs share -----------------------------------------------------------

/** Between `min` and `max` unique ids, in order. */
function idList(raw: unknown, min: number, max: number): string[] | null {
  if (!Array.isArray(raw) || raw.length < min || raw.length > max) return null;
  const ids = raw.filter((x): x is string => isId(x));
  return ids.length === raw.length && new Set(ids).size === ids.length ? ids : null;
}

/** A whole number from `min` to `max`, or `fallback` when it is left out; null when it is something else. */
function whole(raw: unknown, fallback: number, min: number, max: number): number | null {
  const v = raw === undefined ? fallback : raw;
  return finite(v) && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

// --- Rating ------------------------------------------------------------------------------

export interface RatingMeta {
  min: number;
  max: number;
}

export const ratingSpec: CollectSpec<RatingMeta, number> = {
  meta(raw) {
    const min = whole(raw.min, 1, 0, 9);
    const max = whole(raw.max, 5, 1, 10);
    return min === null || max === null || max <= min ? null : { min, max };
  },
  value: (raw, m) => (finite(raw) && Number.isInteger(raw) && raw >= m.min && raw <= m.max ? raw : null),
};

/** The rating as an activity: the host starts it (`{ type: 'start', min?, max? }`); a phone sends a whole number on the scale. */
export const ratingActivity: ActivityReducer = collectActivity(ratingSpec);
export const readRating = (room: Pick<RoomState, 'shared' | 'players'> | null | undefined) => readCollected(room, RATING_KEY, ratingSpec);

// --- Quadrant ------------------------------------------------------------------------------

export const quadrantSpec: CollectSpec<Record<string, never>, QuadPoint> = {
  meta: () => ({}),
  value(raw) {
    if (!isRecord(raw)) return null;
    const [p] = cleanPoints([raw as unknown as QuadPoint]);
    return p ?? null;
  },
};

/** The quadrant as an activity: a phone sends a dot (`{ x, y }`, pulled onto the grid). */
export const quadrantActivity: ActivityReducer = collectActivity(quadrantSpec);
export const readQuadrant = (room: Pick<RoomState, 'shared' | 'players'> | null | undefined) => readCollected(room, QUADRANT_KEY, quadrantSpec);

// --- Pin on a picture ----------------------------------------------------------------------------

const toPin = (raw: unknown): PinPoint | null => (isRecord(raw) ? (cleanPins([raw as unknown as PinPoint])[0] ?? null) : null);

export const pinSpec: CollectSpec<Record<string, never>, PinPoint, PinPoint> = {
  meta: () => ({}),
  value: toPin,
  reveal: toPin,
};

/** The pin as an activity: a phone sends a pin (`{ x, y }`, held to the picture); the host reveals the right place. */
export const pinActivity: ActivityReducer = collectActivity(pinSpec);
export const readPin = (room: Pick<RoomState, 'shared' | 'players'> | null | undefined) => readCollected(room, PIN_KEY, pinSpec);

// --- Ranking ---------------------------------------------------------------------------------

export interface RankingMeta {
  items: string[];
}

export const rankingSpec: CollectSpec<RankingMeta, string[]> = {
  meta(raw) {
    const items = idList(raw.items, 2, 12);
    return items ? { items } : null;
  },
  value: (raw, m) => (Array.isArray(raw) && raw.every((x) => typeof x === 'string') && isFullRanking(raw, m.items) ? [...raw] : null),
};

/** The ranking as an activity: the host starts it with its `items` (ids); a phone sends all of them in its order. */
export const rankingActivity: ActivityReducer = collectActivity(rankingSpec);
export const readRanking = (room: Pick<RoomState, 'shared' | 'players'> | null | undefined) => readCollected(room, RANKING_KEY, rankingSpec);

// --- Points split ------------------------------------------------------------------------------

export interface PointsMeta {
  options: string[];
  budget: number;
  step: number;
  partial: boolean;
}

export const pointsSpec: CollectSpec<PointsMeta, Split> = {
  meta(raw) {
    const options = idList(raw.options, 2, 12);
    const budget = whole(raw.budget, 100, 1, 1000);
    const step = whole(raw.step, 10, 1, 1000);
    const partial = raw.partial === undefined ? false : raw.partial;
    return options && budget !== null && step !== null && typeof partial === 'boolean' ? { options, budget, step, partial } : null;
  },
  value(raw, m) {
    if (!isRecord(raw)) return null;
    const split: Record<string, number> = {};
    for (const [id, n] of Object.entries(raw)) {
      if (!finite(n) || !safeKey(id)) return null;
      split[id] = n;
    }
    return checkSplit(split, m.options, m).ok ? split : null;
  },
};

/** The points split as an activity: the host starts it with its `options`, `budget`, `step` and `partial`; a phone sends a split that fits them. */
export const pointsActivity: ActivityReducer = collectActivity(pointsSpec);
export const readPoints = (room: Pick<RoomState, 'shared' | 'players'> | null | undefined) => readCollected(room, POINTS_KEY, pointsSpec);

// --- Dot vote ------------------------------------------------------------------------------------

export interface DotsMeta {
  ideas: string[];
  dots: number;
  maxPerIdea: number;
}

export const dotsSpec: CollectSpec<DotsMeta, Record<string, number>> = {
  meta(raw) {
    const ideas = idList(raw.ideas, 2, 20);
    const dots = whole(raw.dots, 3, 1, 20);
    const maxPerIdea = whole(raw.maxPerIdea, dots ?? 3, 1, 20);
    return ideas && dots !== null && maxPerIdea !== null ? { ideas, dots, maxPerIdea } : null;
  },
  value(raw, m) {
    if (!isRecord(raw)) return null;
    const ballot = cleanBallot(raw as Record<string, number>, m.ideas, m);
    return Object.keys(ballot).length > 0 ? ballot : null;
  },
};

/** The dot vote as an activity: the host starts it with its `ideas`, `dots` and `maxPerIdea`; a phone sends its dots, held to those. */
export const dotsActivity: ActivityReducer = collectActivity(dotsSpec);
export const readDots = (room: Pick<RoomState, 'shared' | 'players'> | null | undefined) => readCollected(room, DOTS_KEY, dotsSpec);

// --- Prediction ----------------------------------------------------------------------------------

export interface PredictionMeta {
  options: string[];
}

const optionOf = (raw: unknown, m: PredictionMeta): string | null => (typeof raw === 'string' && m.options.includes(raw) ? raw : null);

export const predictionSpec: CollectSpec<PredictionMeta, string, string> = {
  meta(raw) {
    const options = idList(raw.options, 2, 6);
    return options ? { options } : null;
  },
  value: optionOf,
  once: true,
  reveal: optionOf,
};

/** The prediction as an activity: a phone locks one call, and the first stands; the host reveals the outcome, which closes it. */
export const predictionActivity: ActivityReducer = collectActivity(predictionSpec);
export const readPrediction = (room: Pick<RoomState, 'shared' | 'players'> | null | undefined) => readCollected(room, PREDICTION_KEY, predictionSpec);

// --- Typed answer ------------------------------------------------------------------------------

/** What a typed answer must pass before the room holds it: `rules` (the length, a blocklist) from the consumer. */
export function typedSpec(rules: TextRules = {}): CollectSpec<Record<string, never>, string> {
  return {
    meta: () => ({}),
    value(raw) {
      if (typeof raw !== 'string') return null;
      const checked = checkText(raw, { maxLength: 80, ...rules });
      return checked.ok ? checked.text : null;
    },
    once: true,
  };
}

/** The typed answer as an activity: a phone sends its text once, after the text-safety checks; the room's spread is what `TypeAnswer` shows. */
export const typedActivity = (rules: TextRules = {}): ActivityReducer => collectActivity(typedSpec(rules));
export const readTyped = (room: Pick<RoomState, 'shared' | 'players'> | null | undefined, rules: TextRules = {}) => readCollected(room, TYPED_KEY, typedSpec(rules));
