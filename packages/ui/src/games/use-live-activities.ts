'use client';

/**
 * @interlace/ui — useRoomBoard, useRoomReactions, useRoomHand, useRoomSpectrum
 *
 * Connect `QuestionBoard`, `QuestionAsk`, `QuestionQueue`, `ReactionBar`, `ReactionStream`,
 * `RaiseHand`, `HandQueue` and `Spectrum` to a live room (`useRoom`), so they are applied once,
 * sent again until the host shows them, and restored for a late joiner or a refreshed host. Each
 * hook returns the props to spread onto the component; the rules are `games/live-activities-model`
 * and the room must run the activity: `settings.activities` has its reducer under its key.
 *
 * ```tsx
 * const api = useRoom({ transport, selfId, settings: { activities: { [BOARD_KEY]: boardActivity() } } });
 * const board = useRoomBoard(api, selfId);
 * <QuestionBoard questions={board.live} onVote={board.onVote} />
 * <QuestionAsk onAsk={board.onAsk} />
 * ```
 *
 * A reaction is sent once (`retry: false`): one that arrives late is no reaction. Everything else
 * is sent again until the host's state shows it.
 */

import * as React from 'react';

import { readBoard, readHands, readReactions, readSpectrum, submitEvent, BOARD_KEY, HANDS_KEY, REACTIONS_KEY, SPECTRUM_KEY } from './live-activities-model.js';
import type { BoardEvent } from './question-board-model.js';
import { boardCounts, rankQuestions } from './question-board-model.js';
import { placeInLine } from './reactions-model.js';
import type { UseRoomResult } from './live-room.js';

let counter = 0;
/** A unique id for one move: a UUID where the browser has one, else the time and a count. */
const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Sends `action` to the activity under `key` as `selfId`, with a fresh id. */
function useSubmit(api: Pick<UseRoomResult, 'send'>, selfId: string, key: string) {
  const send = React.useRef(api.send);
  send.current = api.send;
  return React.useCallback(
    (action: unknown, options: { retry?: boolean } = {}) => send.current(submitEvent(key, selfId, uid(), action, options)),
    [selfId, key],
  );
}

// --- Q&A ------------------------------------------------------------------------------

export function useRoomBoard(api: Pick<UseRoomResult, 'room' | 'send'>, selfId: string) {
  const submit = useSubmit(api, selfId, BOARD_KEY);
  const board = React.useMemo(() => readBoard(api.room), [api.room]);
  const view = React.useMemo(
    () => ({
      live: board ? rankQuestions(board, { viewer: selfId }) : [],
      review: board ? rankQuestions(board, { viewer: selfId, status: 'review' }) : [],
      done: board ? rankQuestions(board, { viewer: selfId, status: 'answered' }) : [],
    }),
    [board, selfId],
  );
  return {
    board,
    ...view,
    counts: board ? boardCounts(board) : null,
    /** Wire to `QuestionBoard.onVote`. */
    onVote: (id: string, on: boolean) => submit({ type: on ? 'vote' : 'unvote', id }),
    /** Wire to `QuestionAsk.onAsk`. */
    onAsk: (text: string) => submit({ type: 'ask', text }),
    /** Wire to `QuestionQueue.onEvent`. The host's: the room refuses a phone's. */
    onEvent: (event: BoardEvent) => submit(event),
    /** The host opens the board. */
    begin: (options: { moderated?: boolean; open?: boolean } = {}) => submit({ type: 'begin', ...options }),
  };
}

// --- Reactions ------------------------------------------------------------------------

export function useRoomReactions(api: Pick<UseRoomResult, 'room' | 'send'>, selfId: string) {
  const submit = useSubmit(api, selfId, REACTIONS_KEY);
  const state = React.useMemo(() => readReactions(api.room), [api.room]);
  return {
    state,
    /** Wire to `ReactionStream.reactions`. */
    reactions: state?.recent ?? [],
    /** Wire to `ReactionBar.onReact`. Sent once: a late reaction is no reaction. */
    onReact: (kind: string) => submit({ type: 'react', kind }, { retry: false }),
    start: () => submit({ type: 'start' }),
    clear: () => submit({ type: 'clear' }),
  };
}

// --- Raised hands ---------------------------------------------------------------------

export function useRoomHand(api: Pick<UseRoomResult, 'room' | 'send'>, selfId: string) {
  const submit = useSubmit(api, selfId, HANDS_KEY);
  const hands = React.useMemo(() => readHands(api.room), [api.room]);
  const place = hands ? placeInLine(hands, selfId) : null;
  return {
    hands,
    /** Wire to `RaiseHand`. */
    raised: place !== null,
    place,
    speaking: hands?.speaking?.by === selfId,
    onChange: (raised: boolean) => submit({ type: raised ? 'raise' : 'lower' }),
    /** Wire to `HandQueue`. The host's. */
    onCall: (by?: string) => submit(by === undefined ? { type: 'call' } : { type: 'call', by }),
    onLower: (by: string) => submit({ type: 'dismiss', by }),
    onDone: () => submit({ type: 'done' }),
    start: () => submit({ type: 'start' }),
  };
}

// --- Spectrum -------------------------------------------------------------------------

export function useRoomSpectrum(api: Pick<UseRoomResult, 'room' | 'send'>, selfId: string) {
  const submit = useSubmit(api, selfId, SPECTRUM_KEY);
  const spectrum = React.useMemo(() => readSpectrum(api.room), [api.room]);
  const mine = spectrum && Object.hasOwn(spectrum.placed, selfId) ? (spectrum.placed[selfId] as number) : null;
  return {
    spectrum,
    /** Wire to `Spectrum.values`, with `valuesIncludeOwn`. */
    values: spectrum?.values ?? [],
    /** Wire to `Spectrum.value`. */
    value: mine,
    onPlace: (value: number) => submit({ type: 'place', value }),
    start: () => submit({ type: 'start' }),
    setOpen: (on: boolean) => submit({ type: 'open', on }),
  };
}
