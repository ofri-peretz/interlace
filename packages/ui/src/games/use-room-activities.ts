'use client';

/**
 * @interlace/ui — the rest of the live activities on a room
 *
 * `useRoomRating`, `useRoomQuadrant`, `useRoomPin`, `useRoomRanking`, `useRoomPoints`, `useRoomDots`,
 * `useRoomPrediction`, `useRoomTypeAnswer`, `useRoomCloud`, `useRoomWall`, `useRoomReflection`,
 * `useRoomNotes`, `useRoomGoal` and `useRoomReveal` connect `Rating`, `Quadrant`, `PinDrop`,
 * `RankChoices`, `PointsSplit`, `DotVote`, `Prediction`, `TypeAnswer`, `WordCloud` and `WordEntry`,
 * `TextWall`, `ReflectionCard`, `NoteBoard`, `RoomGoal` and `PictureReveal` to a live room (`useRoom`),
 * the way `use-live-activities` does for the Q&A board, reactions, hands and the spectrum: a move is
 * applied once, sent again until the host's state shows it, and restored for a late joiner or a
 * refreshed host. Each hook returns the props to spread onto the component (which is unchanged), and the
 * host's moves; the room must run the activity, so `settings.activities` has its rule under its key.
 *
 * ```tsx
 * const api = useRoom({ transport, selfId, settings: { activities: { [RATING_KEY]: ratingActivity } } });
 * const rating = useRoomRating(api, selfId);
 * rating.props && <Rating question="How familiar is this?" {...rating.props} />
 * ```
 *
 * `props` is null until the host starts the activity. A component's own copy (`question`, `options`,
 * labels, the picture) stays yours: the room holds only what everyone must agree on.
 */

import * as React from 'react';

import { dotsLeft, tallyDots } from './dot-vote-model.js';
import {
  DOTS_KEY, PIN_KEY, POINTS_KEY, PREDICTION_KEY, QUADRANT_KEY, RANKING_KEY, RATING_KEY, TYPED_KEY,
  readDots, readPin, readPoints, readPrediction, readQuadrant, readRanking, readRating, readTyped,
} from './live-collect-model.js';
import { GOAL_KEY, REVEAL_KEY, readGoal, readReveal } from './live-host-model.js';
import { CLOUD_KEY, NOTES_KEY, WALL_KEY, readCloud, readNotes, readWall } from './live-text-model.js';
import type { UseRoomResult } from './live-room.js';
import { totalPoints } from './points-model.js';
import { settlePredictions } from './prediction-model.js';
import { tallyRankings } from './ranking-model.js';
import { scoreTyped, type TypedResult, type TypedRules } from './typed-answer-model.js';
import { useSubmit } from './use-live-activities.js';
import type { BoardMove } from './note-board-model.js';
import type { PinPoint } from './pin-drop-model.js';
import type { QuadPoint } from './quadrant-model.js';
import type { Split } from './points-model.js';
import type { TextRules } from './text-safety-model.js';

type Api = Pick<UseRoomResult, 'room' | 'send'>;
type Entries<V> = Record<string, V>;

const mineOf = <V>(entries: Entries<V> | undefined, selfId: string): V | null =>
  entries && Object.hasOwn(entries, selfId) ? (entries[selfId] as V) : null;

/** What every "one answer per person" activity gives the host. */
function hostMoves(submit: (action: unknown, options?: { retry?: boolean }) => void) {
  return {
    /** Close (`false`) or reopen (`true`) it. */
    open: (on: boolean) => submit({ type: 'open', on }),
    clear: () => submit({ type: 'clear' }),
  };
}

// --- Rating -----------------------------------------------------------------------------

export function useRoomRating(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, RATING_KEY);
  const state = React.useMemo(() => readRating(api.room), [api.room]);
  const mine = mineOf(state?.entries, selfId);
  return {
    state,
    mine,
    /** Spread onto `Rating`. */
    props: state
      ? {
          min: state.meta.min,
          max: state.meta.max,
          values: Object.values(state.entries),
          valuesIncludeOwn: true,
          value: mine,
          onRate: (value: number) => submit({ type: 'send', value }),
        }
      : null,
    start: (scale: { min?: number; max?: number } = {}) => submit({ type: 'start', ...scale }),
    ...hostMoves(submit),
  };
}

// --- Quadrant ---------------------------------------------------------------------------

export function useRoomQuadrant(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, QUADRANT_KEY);
  const state = React.useMemo(() => readQuadrant(api.room), [api.room]);
  const mine = mineOf(state?.entries, selfId);
  return {
    state,
    mine,
    /** Spread onto `Quadrant`. */
    props: state
      ? { points: Object.values(state.entries), pointsIncludeOwn: true, value: mine, onPlace: (point: QuadPoint) => submit({ type: 'send', value: point }) }
      : null,
    start: () => submit({ type: 'start' }),
    ...hostMoves(submit),
  };
}

// --- Pin on a picture --------------------------------------------------------------------

export function useRoomPin(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, PIN_KEY);
  const state = React.useMemo(() => readPin(api.room), [api.room]);
  const mine = mineOf(state?.entries, selfId);
  return {
    state,
    mine,
    /** Spread onto `PinDrop` (and `pins`, `answer`, `revealed` onto `PinMap`). */
    props: state
      ? {
          pins: Object.values(state.entries),
          pinsIncludeOwn: true,
          value: mine,
          answer: state.revealed,
          revealed: state.revealed !== null,
          onPlace: (pin: PinPoint) => submit({ type: 'send', value: pin }),
        }
      : null,
    start: () => submit({ type: 'start' }),
    /** Show the right place; this closes it. */
    reveal: (answer: PinPoint) => submit({ type: 'reveal', value: answer }),
    ...hostMoves(submit),
  };
}

// --- Ranking ----------------------------------------------------------------------------

export function useRoomRanking(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, RANKING_KEY);
  const state = React.useMemo(() => readRanking(api.room), [api.room]);
  const mine = mineOf(state?.entries, selfId);
  const results = React.useMemo(() => (state ? tallyRankings(state.entries, state.meta.items) : null), [state]);
  return {
    state,
    mine,
    /** The room's combined order, for `RankResults.items`. */
    results,
    /** Spread onto `RankChoices` (its `options` are yours; their ids are the room's `items`). */
    props: state ? { sent: mine !== null, onSend: (order: string[]) => submit({ type: 'send', value: order }) } : null,
    start: (items: readonly string[]) => submit({ type: 'start', items }),
    ...hostMoves(submit),
  };
}

// --- Points split ------------------------------------------------------------------------

export function useRoomPoints(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, POINTS_KEY);
  const state = React.useMemo(() => readPoints(api.room), [api.room]);
  const mine = mineOf(state?.entries, selfId);
  const totals = React.useMemo(() => (state ? totalPoints(state.entries, state.meta.options, state.meta) : null), [state]);
  return {
    state,
    mine,
    /** The room's total for each option, for a results view. */
    totals,
    /** Spread onto `PointsSplit` (its `options` are yours; their ids are the room's). */
    props: state
      ? { budget: state.meta.budget, step: state.meta.step, partial: state.meta.partial, sent: mine !== null, onSend: (split: Split) => submit({ type: 'send', value: split }) }
      : null,
    start: (options: readonly string[], rules: { budget?: number; step?: number; partial?: boolean } = {}) => submit({ type: 'start', options, ...rules }),
    ...hostMoves(submit),
  };
}

// --- Dot vote ----------------------------------------------------------------------------

export function useRoomDots(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, DOTS_KEY);
  const state = React.useMemo(() => readDots(api.room), [api.room]);
  const mine = mineOf(state?.entries, selfId);
  const tally = React.useMemo(() => (state ? tallyDots(state.entries, state.meta.ideas, state.meta) : null), [state]);
  return {
    state,
    mine,
    tally,
    /** How many dots this person has left. */
    left: state ? dotsLeft(mine ?? {}, state.meta) : 0,
    /** Spread onto `DotVote` (its `ideas` are yours; their ids are the room's). */
    props: state
      ? {
          dots: state.meta.dots,
          maxPerIdea: state.meta.maxPerIdea,
          value: mine,
          ballots: state.entries,
          ballotsIncludeOwn: true,
          onSend: (ballot: Record<string, number>) => submit({ type: 'send', value: ballot }),
        }
      : null,
    start: (ideas: readonly string[], rules: { dots?: number; maxPerIdea?: number } = {}) => submit({ type: 'start', ideas, ...rules }),
    ...hostMoves(submit),
  };
}

// --- Prediction --------------------------------------------------------------------------

export function useRoomPrediction(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, PREDICTION_KEY);
  const state = React.useMemo(() => readPrediction(api.room), [api.room]);
  const mine = mineOf(state?.entries, selfId);
  const settled = React.useMemo(() => (state ? settlePredictions(state.entries, state.meta.options, state.revealed) : null), [state]);
  return {
    state,
    mine,
    /** Who called what, and who was right. */
    settled,
    /** Spread onto `Prediction` (its `options`, with their labels, are yours; their ids are the room's). */
    props: state && settled
      ? {
          value: mine,
          closed: !state.open,
          outcome: state.revealed,
          counts: settled.counts,
          countsIncludeOwn: true,
          onLock: (id: string) => submit({ type: 'send', value: id }),
        }
      : null,
    start: (options: readonly string[]) => submit({ type: 'start', options }),
    /** Say what happened; this closes it. */
    reveal: (outcome: string) => submit({ type: 'reveal', value: outcome }),
    ...hostMoves(submit),
  };
}

// --- Typed answer ------------------------------------------------------------------------

/**
 * `accepted` and `rules` are the question's (yours, kept off the room until you reveal): they rebuild
 * this person's result from the text the room holds, so a refreshed phone still shows how it did.
 */
export function useRoomTypeAnswer(api: Api, selfId: string, options: { accepted: readonly string[]; rules?: TypedRules & TextRules }) {
  const submit = useSubmit(api, selfId, TYPED_KEY);
  const { accepted, rules } = options;
  const state = React.useMemo(() => readTyped(api.room, rules), [api.room, rules]);
  const mine = mineOf(state?.entries, selfId);
  return {
    state,
    mine,
    /** Spread onto `TypeAnswer`. */
    props: state
      ? {
          room: Object.values(state.entries),
          roomIncludesAnswer: true,
          result: (mine === null ? null : scoreTyped({ text: mine }, accepted, rules)) as TypedResult | null,
          onAnswer: (result: TypedResult) => {
            if (result.text !== null && result.match.outcome !== 'empty') submit({ type: 'send', value: result.text });
          },
        }
      : null,
    start: () => submit({ type: 'start' }),
    ...hostMoves(submit),
  };
}

// --- Word cloud --------------------------------------------------------------------------

export function useRoomCloud(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, CLOUD_KEY);
  const state = React.useMemo(() => readCloud(api.room), [api.room]);
  const sent = React.useMemo(() => (state ? state.entries.filter((e) => e.by === selfId).map((e) => e.text) : []), [state, selfId]);
  return {
    state,
    sent,
    /** Spread onto `WordCloud`. */
    cloud: state ? { entries: state.words, viewer: selfId } : null,
    /** Spread onto `WordEntry`. */
    entry: state ? { sent, maxWords: state.maxWords, disabled: !state.open, onWord: (text: string) => submit({ type: 'word', text }) } : null,
    start: (options: { maxWords?: number } = {}) => submit({ type: 'start', ...options }),
    ...hostMoves(submit),
  };
}

// --- Open wall (and shared reflections) --------------------------------------------------

export function useRoomWall(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, WALL_KEY);
  const state = React.useMemo(() => readWall(api.room), [api.room]);
  return {
    state,
    /** Spread onto `TextWall`. */
    props: state ? { posts: state.live.map((p) => ({ id: p.id, text: p.text, at: p.at })), spotlight: state.spotlight } : null,
    /** Posts waiting for the host, for a review list. */
    review: state?.review ?? [],
    post: (text: string) => submit({ type: 'post', text }),
    start: (options: { moderated?: boolean } = {}) => submit({ type: 'start', ...options }),
    approve: (id: string) => submit({ type: 'approve', id }),
    dismiss: (id: string) => submit({ type: 'dismiss', id }),
    spotlight: (id: string | null) => submit({ type: 'spotlight', id }),
    ...hostMoves(submit),
  };
}

/**
 * Connects `ReflectionCard.onSave` to the wall: a private note goes nowhere (the room never hears of
 * it), and a note the writer chooses to share is posted to the wall, to be approved like any other.
 */
export function useRoomReflection(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, WALL_KEY);
  return {
    onSave: (text: string, options: { shared: boolean }) => {
      if (options.shared) submit({ type: 'post', text });
    },
  };
}

// --- Sticky-note board -------------------------------------------------------------------

export function useRoomNotes(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, NOTES_KEY);
  const state = React.useMemo(() => readNotes(api.room), [api.room]);
  return {
    state,
    /** Spread onto `NoteBoard`. */
    props: state
      ? {
          columns: state.columns.map((c) => ({ id: c.id, title: c.label })),
          notes: state.notes.map(({ id, column, text, at }) => ({ id, column, text, at })),
          moves: state.moves,
          onAdd: (column: string, text: string) => submit({ type: 'add', column, text }),
          onMove: (move: BoardMove) => submit({ type: 'move', id: move.id, column: move.column }),
        }
      : null,
    start: (columns: readonly { id: string; label: string }[]) => submit({ type: 'start', columns }),
    ...hostMoves(submit),
  };
}

// --- Room goal and picture reveal (the host's) --------------------------------------------

export function useRoomGoal(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, GOAL_KEY);
  const goal = React.useMemo(() => readGoal(api.room), [api.room]);
  return {
    goal,
    /** Spread onto `RoomGoal`. */
    props: goal ? { label: goal.label, value: goal.value, target: goal.target, milestones: goal.milestones, streak: goal.streak } : null,
    start: (goal: { label: string; target: number; milestones?: readonly { at: number; label: string }[] }) => submit({ type: 'start', ...goal }),
    round: (result: { right: number; answered: number }) => submit({ type: 'round', ...result }),
    clear: () => submit({ type: 'clear' }),
  };
}

export function useRoomReveal(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, REVEAL_KEY);
  const state = React.useMemo(() => readReveal(api.room), [api.room]);
  return {
    state,
    /** Spread onto `PictureReveal` (its `src`, `alt`, `answer`, `cols`, `rows` and `clues` are yours). */
    props: state ? { step: state.step, steps: state.steps, seed: state.seed, revealed: state.revealed } : null,
    start: (steps: number, seed: string) => submit({ type: 'start', steps, seed }),
    step: (step: number) => submit({ type: 'step', step }),
    reveal: () => submit({ type: 'reveal' }),
    cover: () => submit({ type: 'cover' }),
  };
}
