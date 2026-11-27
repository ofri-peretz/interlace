/**
 * Room activities under real-room conditions: events that arrive twice or
 * out of order after a reconnect, a late joiner or a refreshed host who
 * starts from a saved snapshot, a full room of 60, keyboard-only use, and
 * reduced motion. Each part must end in the same state a calm room would.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { applyBoardEvent, createBoard, rankQuestions } = await import('../src/games/question-board-model.js');
const { QuestionBoard } = await import('../src/games/question-board.js');
const { applyHandEvent, createHands, placeInLine } = await import('../src/games/reactions-model.js');
const { HandQueue, ReactionStream } = await import('../src/games/reactions.js');
const { Spectrum } = await import('../src/games/spectrum.js');
const { summarizeSpectrum } = await import('../src/games/spectrum-model.js');
const { buildCloud } = await import('../src/games/word-cloud-model.js');
const { WordCloud } = await import('../src/games/word-cloud.js');

type BoardEvent = Parameters<typeof applyBoardEvent>[1];
type BoardState = ReturnType<typeof createBoard>;
const open = () => createBoard({ moderated: false });

afterEach(() => {
  cleanup();
  reduced.value = false;
});

const people = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

function replay(state: BoardState, events: readonly BoardEvent[]): BoardState {
  return events.reduce((s, e) => applyBoardEvent(s, e).state, state);
}

/** 60 people: 20 ask, everyone votes on a few, the host answers one. */
function busyRoom(): BoardEvent[] {
  const events: BoardEvent[] = [];
  const ps = people(60);
  ps.slice(0, 20).forEach((by, i) => events.push({ type: 'ask', id: `q${i}`, by, at: i, text: `Question ${i}` }));
  ps.forEach((by, i) => {
    for (let k = 0; k < 3; k++) events.push({ type: 'vote', id: `q${(i + k * 7) % 20}`, by });
  });
  events.push({ type: 'answer', id: 'q3' });
  return events;
}

describe('question board under a reconnect', () => {
  it('ends in the same state when every event arrives twice', () => {
    const events = busyRoom();
    const once = replay(open(), events);
    const twice = replay(
      open(),
      events.flatMap((e) => [e, e]),
    );
    expect(rankQuestions(twice)).toEqual(rankQuestions(once));
    expect(twice.questions).toEqual(once.questions);
  });

  it('refuses a vote that lands before its question, then takes it once the question exists', () => {
    const early = applyBoardEvent(open(), { type: 'vote', id: 'q1', by: 'p2' });
    expect(early).toMatchObject({ ok: false, reason: 'unknown' });
    const asked = applyBoardEvent(early.state, { type: 'ask', id: 'q1', by: 'p1', at: 0, text: 'Why?' }).state;
    const voted = applyBoardEvent(asked, { type: 'vote', id: 'q1', by: 'p2' });
    expect(voted.ok && voted.state.questions[0]?.votes).toEqual(['p2']);
  });

  it('carries on from a saved snapshot, as a late joiner or a refreshed host would', () => {
    const events = busyRoom();
    const half = Math.floor(events.length / 2);
    const live = replay(open(), events);
    const saved = JSON.parse(JSON.stringify(replay(open(), events.slice(0, half)))) as BoardState;
    expect(replay(saved, events.slice(half))).toEqual(live);
  });

  it('renders 60 votes on 20 questions and stays reachable by keyboard', () => {
    const state = replay(open(), busyRoom());
    const onVote = vi.fn();
    render(<QuestionBoard questions={rankQuestions(state, { viewer: 'p60' })} onVote={onVote} />);
    const buttons = screen.getAllByRole('button');
    // p60 asked nothing, so every live question offers a vote.
    expect(buttons).toHaveLength(19);
    const first = buttons[0] as HTMLButtonElement;
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.click(first);
    expect(onVote).toHaveBeenCalledTimes(1);
  });
});

describe('raised hands under a reconnect', () => {
  it('ignores a repeated raise and lower, and a call by name lands once', () => {
    let s = createHands();
    const events = [
      { type: 'raise', by: 'a', name: 'A', at: 1 },
      { type: 'raise', by: 'b', name: 'B', at: 2 },
      { type: 'raise', by: 'c', name: 'C', at: 3 },
      { type: 'lower', by: 'c' },
      { type: 'call', by: 'a' },
    ] as const;
    for (const e of events) s = applyHandEvent(applyHandEvent(s, e), e);
    expect(s.speaking?.by).toBe('a');
    expect(s.hands.map((h) => h.by)).toEqual(['b']);
    expect(placeInLine(s, 'b')).toBe(1);
  });

  it('keeps a line of 60 in raise order', () => {
    let s = createHands();
    for (const [i, by] of people(60).entries()) s = applyHandEvent(s, { type: 'raise', by, name: by, at: i });
    expect(placeInLine(s, 'p60')).toBe(60);
    render(<HandQueue hands={s.hands} speaking={s.speaking} onCall={() => undefined} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(60);
  });
});

describe('reaction stream under load', () => {
  it('does not burst on a refresh and floats at most the cap after a reconnect', () => {
    const animate = vi.fn(() => ({ finished: new Promise(() => undefined), cancel: () => undefined }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const old = people(40).map((p, i) => ({ id: `old${i}`, kind: 'love' }));
    const { container, rerender } = render(<ReactionStream reactions={old} maxFloating={8} />);
    expect(container.querySelectorAll('[data-slot="reaction-float"]')).toHaveLength(0);
    const flood = [...old, ...people(60).map((p, i) => ({ id: `new${i}`, kind: 'agree' }))];
    act(() => rerender(<ReactionStream reactions={flood} maxFloating={8} />));
    expect(container.querySelectorAll('[data-slot="reaction-float"]')).toHaveLength(8);
    // The same list again (a duplicate delivery) adds nothing.
    act(() => rerender(<ReactionStream reactions={[...flood]} maxFloating={8} />));
    expect(container.querySelectorAll('[data-slot="reaction-float"]')).toHaveLength(8);
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  });

  it('only counts under reduced motion', () => {
    reduced.value = true;
    const { container, rerender } = render(<ReactionStream reactions={[]} />);
    act(() => rerender(<ReactionStream reactions={[{ id: 'r1', kind: 'love' }]} />));
    expect(container.querySelectorAll('[data-slot="reaction-float"]')).toHaveLength(0);
    expect(container.textContent).toContain('1');
  });
});

describe('spectrum and word cloud with a full room', () => {
  it('summarizes 60 dots the same in any arrival order', () => {
    const values = people(60).map((_, i) => (i * 37) % 101);
    const shuffled = [...values].reverse();
    expect(summarizeSpectrum(shuffled)).toEqual(summarizeSpectrum(values));
    expect(summarizeSpectrum(values).count).toBe(60);
  });

  it('places a dot with the keyboard alone', () => {
    const onPlace = vi.fn();
    render(<Spectrum statement="Statement" poles={['One end', 'Other end']} values={[10, 90]} onPlace={onPlace} />);
    const thumb = screen.getByRole('slider');
    thumb.focus();
    fireEvent.keyDown(thumb, { key: 'End' });
    fireEvent.click(screen.getByRole('button', { name: 'Place my dot' }));
    expect(onPlace).toHaveBeenCalledWith(100);
    expect(document.activeElement?.getAttribute('data-slot')).toBe('spectrum-result');
  });

  it('builds the same cloud when entries arrive twice', () => {
    const entries = people(60).map((by, i) => ({
      id: `e${i}`,
      by,
      text: ['calm', 'curious', 'hopeful'][i % 3] as string,
    }));
    const once = buildCloud(entries);
    expect(once.total).toBe(60);
    expect(buildCloud([...entries, ...entries])).toEqual(once);
    // Without a sender, the id alone keeps a resent entry from counting twice.
    const anon = entries.map(({ id, text }) => ({ id, text }));
    expect(buildCloud([...anon, ...anon]).total).toBe(60);
    // One person sending the same word again, under a new id, still counts once.
    expect(
      buildCloud([
        { id: 'x', by: 'p1', text: 'Calm' },
        { id: 'y', by: 'p1', text: 'calm' },
      ]).total,
    ).toBe(1);
    render(<WordCloud entries={entries} />);
    expect(screen.getAllByRole('listitem').filter((li) => li.getAttribute('role') !== 'presentation').length).toBe(3);
  });
});
