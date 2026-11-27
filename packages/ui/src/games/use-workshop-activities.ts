'use client';

/**
 * @interlace/ui — useRoomCorners, useRoomExitTicket, useRoomCheckIn
 *
 * Connect `DebateCorners`, `ExitTicket` and `CheckIn` to a live room (`useRoom`), the way
 * `use-live-activities` does for the Q&A board and the spectrum: a move is applied once, sent again
 * until the host's state shows it, and restored for a late joiner or a refreshed host. Each hook
 * returns the props to spread onto the component; the room must run the activity, so
 * `settings.activities` has its rule under its key.
 *
 * ```tsx
 * const api = useRoom({ transport, selfId, settings: { activities: { [CORNERS_KEY]: cornersActivity } } });
 * const corners = useRoomCorners(api, selfId);
 * corners.state && <DebateCorners {...corners.props} />
 * ```
 */

import * as React from 'react';

import { CHECK_IN_KEY, currentRound, readCheckIn, type Mood } from './check-in-model.js';
import { CORNERS_KEY, readCorners, tallyCorners } from './debate-corners-model.js';
import { EXIT_TICKET_KEY, readExitTicket, summarizeTicket, type TicketAnswers, type TicketQuestion } from './exit-ticket-model.js';
import type { UseRoomResult } from './live-room.js';
import { useSubmit } from './use-live-activities.js';

type Api = Pick<UseRoomResult, 'room' | 'send'>;

// --- Debate corners -------------------------------------------------------------------

export function useRoomCorners(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, CORNERS_KEY);
  const state = React.useMemo(() => readCorners(api.room), [api.room]);
  const tally = React.useMemo(() => (state ? tallyCorners(state) : null), [state]);
  const mine = state && Object.hasOwn(state.picks, selfId) ? (state.picks[selfId] as string) : null;
  return {
    state,
    tally,
    mine,
    /** Spread onto `DebateCorners`. */
    props: state && tally
      ? {
          statement: state.statement,
          corners: state.corners,
          counts: Object.fromEntries(tally.corners.map((c) => [c.id, c.count])),
          value: mine,
          speaking: state.speaking,
          locked: !state.open,
          onPick: (corner: string) => submit({ type: 'pick', corner }),
        }
      : null,
    /** The host's. The room refuses a phone's. */
    start: (statement: string, corners: readonly { id: string; label: string }[]) => submit({ type: 'start', statement, corners }),
    lock: (on: boolean) => submit({ type: 'lock', on }),
    call: (corner: string | null) => submit({ type: 'call', corner }),
    clear: () => submit({ type: 'clear' }),
  };
}

// --- Exit ticket ----------------------------------------------------------------------

export function useRoomExitTicket(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, EXIT_TICKET_KEY);
  const state = React.useMemo(() => readExitTicket(api.room), [api.room]);
  const answers = React.useMemo(() => (state ? Object.values(state.responses) : []), [state]);
  const summary = React.useMemo(() => (state ? summarizeTicket(state.questions, answers) : []), [state, answers]);
  const mine: TicketAnswers | null = state && Object.hasOwn(state.responses, selfId) ? (state.responses[selfId] as TicketAnswers) : null;
  return {
    state,
    summary,
    mine,
    /** How many people have sent theirs. */
    count: answers.length,
    /** Spread onto `ExitTicket`. */
    props: state
      ? {
          questions: state.questions,
          value: mine,
          summary,
          count: answers.length,
          closed: !state.open,
          onSend: (a: TicketAnswers) => submit({ type: 'send', answers: a }),
        }
      : null,
    start: (questions: readonly TicketQuestion[]) => submit({ type: 'start', questions }),
    close: (on: boolean) => submit({ type: 'close', on }),
    clear: () => submit({ type: 'clear' }),
  };
}

// --- Check-in -------------------------------------------------------------------------

export function useRoomCheckIn(api: Api, selfId: string) {
  const submit = useSubmit(api, selfId, CHECK_IN_KEY);
  const state = React.useMemo(() => readCheckIn(api.room), [api.room]);
  const round = state ? currentRound(state) : null;
  const picks = state && round ? (state.picks[round] as Record<string, string>) : null;
  const mine = picks && Object.hasOwn(picks, selfId) ? (picks[selfId] as string) : null;
  return {
    state,
    round,
    mine,
    /** Spread onto `CheckIn`. `before` is the round asked before this one, when there is one. */
    props: state && round && picks
      ? {
          moods: state.moods as Mood[],
          picks,
          before: state.rounds.length > 1 ? (state.picks[state.rounds[state.rounds.length - 2] as string] as Record<string, string>) : undefined,
          value: mine,
          closed: !state.open,
          onPick: (mood: string) => submit({ type: 'pick', mood }),
        }
      : null,
    start: (options: { round?: string; moods?: readonly Mood[] } = {}) => submit({ type: 'start', ...options }),
    /** Ask again: the earlier rounds are kept, so the room's shift can be shown. */
    ask: (id: string) => submit({ type: 'round', id }),
    open: (on: boolean) => submit({ type: 'open', on }),
    clear: () => submit({ type: 'clear' }),
  };
}
