/**
 * @interlace/ui — question-board-model
 *
 * A room's questions, as one state the host owns: people ask, the room
 * votes the ones it wants answered up, and a moderator decides what reaches
 * the shared screen. Pure, so the host's device, a server and a recap page
 * all agree on the order.
 *
 * ## Lifecycle of a question
 *
 *   ask ──▶ review ──approve──▶ live ──answer──▶ answered
 *             │                  │  ▲
 *             └──dismiss──▶ dismissed ◀──dismiss──┘ │
 *                               └────restore────────┘
 *
 * With `moderated` off, a question skips review and goes live at once.
 * `pin` marks the one live question being answered now (at most one).
 *
 * ## Votes
 *
 * One vote per person per question, toggled with `vote` / `unvote`. Nobody
 * votes for their own question, and only live questions take votes.
 *
 * ## Order
 *
 * `rankQuestions` sorts live questions: the pinned one first, then most
 * votes, then the oldest, so a question that has waited longer wins a tie.
 */

import { checkText, type TextRefusal, type TextRules } from './text-safety-model.js';

export type QuestionStatus = 'review' | 'live' | 'answered' | 'dismissed';

export interface BoardQuestion {
  id: string;
  text: string;
  /** Who asked. Never shown unless the consumer chooses to. */
  by: string;
  /** When it arrived, in ms (host clock). */
  at: number;
  status: QuestionStatus;
  /** Ids of the people who voted it up. */
  votes: string[];
}

export interface BoardState {
  questions: BoardQuestion[];
  /** New questions wait for review. @default true */
  moderated: boolean;
  /** Taking new questions. */
  open: boolean;
  /** The live question being answered now. */
  pinned: string | null;
  /** Bumped on every change. */
  seq: number;
}

export interface BoardRules extends Pick<TextRules, 'blocklist' | 'allowLinks' | 'allowContact'> {
  /** The longest question, in characters. @default 200 */
  maxLength?: number;
  /** Questions one person may ask. @default 5 */
  maxPerPerson?: number;
}

export type BoardEvent =
  | { type: 'ask'; id: string; text: string; by: string; at: number }
  | { type: 'vote'; id: string; by: string }
  | { type: 'unvote'; id: string; by: string }
  | { type: 'approve'; id: string }
  | { type: 'dismiss'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'answer'; id: string }
  | { type: 'pin'; id: string | null }
  | { type: 'moderate'; on: boolean }
  | { type: 'open'; on: boolean };

export type BoardRejection =
  | TextRefusal
  | 'closed'
  | 'limit'
  | 'duplicate-id'
  | 'unknown'
  | 'not-live'
  | 'own'
  | 'already'
  | 'not-voted'
  | 'wrong-status';

export type BoardResult = { ok: true; state: BoardState } | { ok: false; reason: BoardRejection; state: BoardState };

export function createBoard(init: { moderated?: boolean; open?: boolean } = {}): BoardState {
  return { questions: [], moderated: init.moderated ?? true, open: init.open ?? true, pinned: null, seq: 0 };
}

const FROM: Record<'approve' | 'dismiss' | 'restore' | 'answer', readonly QuestionStatus[]> = {
  approve: ['review'],
  dismiss: ['review', 'live', 'answered'],
  restore: ['dismissed', 'answered'],
  answer: ['live'],
};
const TO: Record<'approve' | 'dismiss' | 'restore' | 'answer', QuestionStatus> = {
  approve: 'live',
  dismiss: 'dismissed',
  restore: 'live',
  answer: 'answered',
};

/** Applies one event, or says why it cannot. The state is never mutated. */
export function applyBoardEvent(state: BoardState, event: BoardEvent, rules: BoardRules = {}): BoardResult {
  const no = (reason: BoardRejection): BoardResult => ({ ok: false, reason, state });
  const next = (patch: Partial<BoardState>): BoardResult => ({
    ok: true,
    state: { ...state, ...patch, seq: state.seq + 1 },
  });
  const find = (id: string) => state.questions.find((q) => q.id === id);
  const replace = (q: BoardQuestion) => state.questions.map((x) => (x.id === q.id ? q : x));

  switch (event.type) {
    case 'ask': {
      if (!state.open) return no('closed');
      if (find(event.id)) return no('duplicate-id');
      const { maxLength = 200, maxPerPerson = 5, ...textRules } = rules;
      const check = checkText(event.text, { ...textRules, maxLength });
      if (!check.ok) return no(check.reason);
      if (state.questions.filter((q) => q.by === event.by).length >= maxPerPerson) return no('limit');
      const q: BoardQuestion = {
        id: event.id,
        text: check.text,
        by: event.by,
        at: event.at,
        status: state.moderated ? 'review' : 'live',
        votes: [],
      };
      return next({ questions: [...state.questions, q] });
    }
    case 'vote':
    case 'unvote': {
      const q = find(event.id);
      if (!q) return no('unknown');
      if (q.status !== 'live') return no('not-live');
      const has = q.votes.includes(event.by);
      if (event.type === 'vote') {
        if (q.by === event.by) return no('own');
        if (has) return no('already');
        return next({ questions: replace({ ...q, votes: [...q.votes, event.by] }) });
      }
      if (!has) return no('not-voted');
      return next({ questions: replace({ ...q, votes: q.votes.filter((v) => v !== event.by) }) });
    }
    case 'approve':
    case 'dismiss':
    case 'restore':
    case 'answer': {
      const q = find(event.id);
      if (!q) return no('unknown');
      if (!FROM[event.type].includes(q.status)) return no('wrong-status');
      return next({
        questions: replace({ ...q, status: TO[event.type] }),
        pinned: state.pinned === q.id ? null : state.pinned,
      });
    }
    case 'pin': {
      if (event.id === null) return next({ pinned: null });
      const q = find(event.id);
      if (!q) return no('unknown');
      if (q.status !== 'live') return no('not-live');
      return next({ pinned: q.id });
    }
    case 'moderate':
      return next({ moderated: event.on });
    case 'open':
      return next({ open: event.on });
  }
}

export interface RankedQuestion extends BoardQuestion {
  /** Votes, as a number. */
  count: number;
  pinned: boolean;
  /** The viewer asked it. */
  mine: boolean;
  /** The viewer voted for it. */
  voted: boolean;
}

/** Questions in one status, ranked: pinned first, then most votes, then oldest. */
export function rankQuestions(
  state: BoardState,
  options: { viewer?: string; status?: QuestionStatus } = {},
): RankedQuestion[] {
  const { viewer, status = 'live' } = options;
  return state.questions
    .filter((q) => q.status === status)
    .map(
      (q): RankedQuestion => ({
        ...q,
        count: q.votes.length,
        pinned: state.pinned === q.id,
        mine: viewer !== undefined && q.by === viewer,
        voted: viewer !== undefined && q.votes.includes(viewer),
      }),
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.count - a.count || a.at - b.at);
}

/** How many questions are in each status. */
export function boardCounts(state: BoardState): Record<QuestionStatus, number> {
  const out: Record<QuestionStatus, number> = { review: 0, live: 0, answered: 0, dismissed: 0 };
  for (const q of state.questions) out[q.status]++;
  return out;
}
