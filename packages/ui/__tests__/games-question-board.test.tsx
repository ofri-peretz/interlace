/**
 * Question board: the state a host owns, and the three parts people use.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyBoardEvent,
  boardCounts,
  createBoard,
  rankQuestions,
  type BoardEvent,
  type BoardState,
} from '../src/games/question-board-model.js';
import { MIN_VIEWPORT, QuestionAsk, QuestionBoard, QuestionQueue } from '../src/games/question-board.js';

afterEach(cleanup);

function run(state: BoardState, ...events: BoardEvent[]): BoardState {
  return events.reduce((s, e) => {
    const r = applyBoardEvent(s, e);
    if (!r.ok) throw new Error(`${e.type} refused: ${r.reason}`);
    return r.state;
  }, state);
}

const ask = (id: string, by: string, at: number, text = `Question ${id}?`): BoardEvent => ({
  type: 'ask',
  id,
  text,
  by,
  at,
});

describe('question-board-model', () => {
  it('holds new questions for review when moderated, and goes live when not', () => {
    const s = run(createBoard(), ask('a', 'p1', 1));
    expect(s.questions[0]).toMatchObject({ status: 'review', text: 'Question a?', votes: [] });
    expect(s.seq).toBe(1);
    const open = run(createBoard({ moderated: false }), ask('a', 'p1', 1));
    expect(open.questions[0]?.status).toBe('live');
    expect(createBoard()).toMatchObject({ moderated: true, open: true, pinned: null, seq: 0 });
  });

  it('refuses asks that are closed, repeated, unsafe or over the limit', () => {
    const base = createBoard({ moderated: false });
    expect(applyBoardEvent(createBoard({ open: false }), ask('a', 'p', 1))).toMatchObject({
      ok: false,
      reason: 'closed',
    });
    const one = run(base, ask('a', 'p', 1));
    expect(applyBoardEvent(one, ask('a', 'q', 2))).toMatchObject({ ok: false, reason: 'duplicate-id' });
    expect(applyBoardEvent(base, ask('x', 'p', 1, 'see example.com'))).toMatchObject({ ok: false, reason: 'link' });
    expect(applyBoardEvent(base, ask('x', 'p', 1, 'so bad'), { blocklist: ['bad'] })).toMatchObject({
      ok: false,
      reason: 'blocked',
    });
    expect(applyBoardEvent(base, ask('x', 'p', 1, 'x'.repeat(11)), { maxLength: 10 })).toMatchObject({
      ok: false,
      reason: 'too-long',
    });
    expect(applyBoardEvent(one, ask('b', 'p', 2), { maxPerPerson: 1 })).toMatchObject({ ok: false, reason: 'limit' });
    const refused = applyBoardEvent(one, ask('b', 'p', 2), { maxPerPerson: 1 });
    expect(refused.state).toBe(one);
  });

  it('takes one vote per person, never on their own, only while live', () => {
    let s = run(createBoard(), ask('a', 'p1', 1));
    expect(applyBoardEvent(s, { type: 'vote', id: 'a', by: 'p2' })).toMatchObject({ ok: false, reason: 'not-live' });
    s = run(s, { type: 'approve', id: 'a' }, { type: 'vote', id: 'a', by: 'p2' });
    expect(s.questions[0]?.votes).toEqual(['p2']);
    expect(applyBoardEvent(s, { type: 'vote', id: 'a', by: 'p2' })).toMatchObject({ ok: false, reason: 'already' });
    expect(applyBoardEvent(s, { type: 'vote', id: 'a', by: 'p1' })).toMatchObject({ ok: false, reason: 'own' });
    expect(applyBoardEvent(s, { type: 'vote', id: 'zz', by: 'p1' })).toMatchObject({ ok: false, reason: 'unknown' });
    expect(applyBoardEvent(s, { type: 'unvote', id: 'a', by: 'p3' })).toMatchObject({ ok: false, reason: 'not-voted' });
    s = run(s, { type: 'unvote', id: 'a', by: 'p2' });
    expect(s.questions[0]?.votes).toEqual([]);
  });

  it('moves through review, live, answered and dismissed, and pins one live question', () => {
    let s = run(createBoard(), ask('a', 'p1', 1), ask('b', 'p2', 2), { type: 'approve', id: 'a' });
    expect(applyBoardEvent(s, { type: 'approve', id: 'a' })).toMatchObject({ ok: false, reason: 'wrong-status' });
    expect(applyBoardEvent(s, { type: 'answer', id: 'zz' })).toMatchObject({ ok: false, reason: 'unknown' });
    expect(applyBoardEvent(s, { type: 'pin', id: 'b' })).toMatchObject({ ok: false, reason: 'not-live' });
    expect(applyBoardEvent(s, { type: 'pin', id: 'zz' })).toMatchObject({ ok: false, reason: 'unknown' });
    s = run(s, { type: 'pin', id: 'a' });
    expect(s.pinned).toBe('a');
    s = run(s, { type: 'answer', id: 'a' });
    expect(s.pinned).toBeNull();
    expect(s.questions[0]?.status).toBe('answered');
    s = run(s, { type: 'restore', id: 'a' }, { type: 'pin', id: 'a' }, { type: 'pin', id: null });
    expect(s.pinned).toBeNull();
    s = run(s, { type: 'pin', id: 'a' }, { type: 'dismiss', id: 'b' });
    expect(s.pinned).toBe('a');
    expect(boardCounts(s)).toEqual({ review: 0, live: 1, answered: 0, dismissed: 1 });
    s = run(s, { type: 'moderate', on: false }, { type: 'open', on: false });
    expect(s).toMatchObject({ moderated: false, open: false });
  });

  it('ranks pinned first, then votes, then the oldest', () => {
    const s = run(
      createBoard({ moderated: false }),
      ask('a', 'p1', 1),
      ask('b', 'p2', 2),
      ask('c', 'p3', 3),
      ask('d', 'p4', 4),
      ask('e', 'p5', 5),
      { type: 'vote', id: 'c', by: 'p1' },
      { type: 'vote', id: 'c', by: 'p2' },
      { type: 'vote', id: 'b', by: 'p1' },
      { type: 'pin', id: 'd' },
    );
    const ranked = rankQuestions(s, { viewer: 'p1' });
    expect(ranked.map((q) => q.id)).toEqual(['d', 'c', 'b', 'a', 'e']);
    expect(ranked.map((q) => q.count)).toEqual([0, 2, 1, 0, 0]);
    expect(ranked[0]?.pinned).toBe(true);
    expect(ranked.find((q) => q.id === 'a')?.mine).toBe(true);
    expect(ranked.find((q) => q.id === 'c')?.voted).toBe(true);
    expect(rankQuestions(s).every((q) => !q.mine && !q.voted)).toBe(true);
    expect(rankQuestions(s, { status: 'review' })).toEqual([]);
  });
});

function boardWith(viewer?: string) {
  const s = run(
    createBoard({ moderated: false }),
    ask('a', 'me', 1, 'Mine?'),
    ask('b', 'p2', 2, 'Theirs?'),
    { type: 'vote', id: 'b', by: 'me' },
    { type: 'pin', id: 'b' },
  );
  return rankQuestions(s, { viewer });
}

describe('QuestionBoard', () => {
  it('lists ranked questions with a toggle vote, the pinned one named', () => {
    const onVote = vi.fn();
    const { container } = render(<QuestionBoard questions={boardWith('me')} onVote={onVote} locale="en-US" />);
    expect(container.firstElementChild?.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.hasAttribute('data-pinned')).toBe(true);
    expect(screen.getByText('Answering now')).toBeTruthy();
    expect(screen.getByText('Your question')).toBeTruthy();
    const remove = screen.getByRole('button', { name: 'Remove your vote, 1 vote' });
    expect(remove.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(remove);
    expect(onVote).toHaveBeenCalledWith('b', false);
    // The viewer's own question shows its count, with no button.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('0 votes')).toBeTruthy();
    expect(screen.getByText('2 questions')).toBeTruthy();
  });

  it('is read-only without onVote, and says when it is empty', () => {
    const { rerender } = render(<QuestionBoard questions={boardWith()} size="stage" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('1 vote')).toBeTruthy();
    rerender(<QuestionBoard questions={[]} />);
    expect(screen.getByText('No questions yet. Ask the first one.')).toBeTruthy();
  });
});

describe('QuestionAsk', () => {
  it('checks, sends and thanks according to moderation', () => {
    const onAsk = vi.fn();
    const { rerender } = render(<QuestionAsk onAsk={onAsk} maxLength={20} blocklist={['bad']} />);
    const field = screen.getByLabelText('Your question') as HTMLTextAreaElement;
    const send = () => fireEvent.submit(field.closest('form') as HTMLFormElement);

    send();
    expect(screen.getByText('Type a question first.')).toBeTruthy();
    fireEvent.change(field, { target: { value: 'x'.repeat(21) } });
    expect(screen.getByText('-1 characters left')).toBeTruthy();
    fireEvent.change(field, { target: { value: 'so bad' } });
    send();
    expect(screen.getByText('That question cannot be shown here. Try other words.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(field, { target: { value: ' Why? ' } });
    send();
    expect(onAsk).toHaveBeenCalledWith('Why?');
    expect(field.value).toBe('');
    expect(screen.getByText('Sent. A moderator will check it before it shows.')).toBeTruthy();

    rerender(<QuestionAsk onAsk={onAsk} moderated={false} />);
    fireEvent.change(field, { target: { value: 'How?' } });
    send();
    expect(screen.getByText('Sent. It is on the board.')).toBeTruthy();

    rerender(<QuestionAsk onAsk={onAsk} disabled />);
    send();
    expect(onAsk).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Questions are closed for now.')).toBeTruthy();
  });
});

describe('QuestionQueue', () => {
  it('sends one event per action', () => {
    const onEvent = vi.fn();
    let s = run(createBoard(), ask('r', 'p1', 1, 'Waiting?'), ask('l', 'p2', 2, 'Live?'), { type: 'approve', id: 'l' });
    s = run(s, ask('d', 'p3', 3, 'Old?'), { type: 'approve', id: 'd' }, { type: 'answer', id: 'd' });
    const pinned = run(s, { type: 'pin', id: 'l' });
    const { rerender } = render(
      <QuestionQueue
        review={rankQuestions(s, { status: 'review' })}
        live={rankQuestions(s)}
        done={rankQuestions(s, { status: 'answered' })}
        onEvent={onEvent}
        locale="en-US"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Answered' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to the board' }));
    expect(onEvent.mock.calls.map((c) => c[0])).toEqual([
      { type: 'approve', id: 'r' },
      { type: 'dismiss', id: 'r' },
      { type: 'pin', id: 'l' },
      { type: 'answer', id: 'l' },
      { type: 'dismiss', id: 'l' },
      { type: 'restore', id: 'd' },
    ]);
    expect(screen.getByText('0 votes')).toBeTruthy();

    rerender(<QuestionQueue review={[]} live={rankQuestions(pinned)} onEvent={onEvent} />);
    expect(screen.getByText('Nothing waiting.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));
    expect(onEvent).toHaveBeenLastCalledWith({ type: 'pin', id: null });
    expect(screen.queryByText('Answered and hidden')).toBeNull();
  });
});
