/**
 * Exit ticket: the numbers a recap repeats, the room rule, and the form people fill in.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EXIT_TICKET_KEY,
  cleanAnswers,
  cleanQuestions,
  exitTicketActivity,
  npsBand,
  readExitTicket,
  summarizeNps,
  summarizeTicket,
  type ExitTicketState,
  type TicketQuestion,
} from '../src/games/exit-ticket-model.js';
import { ExitTicket, MIN_VIEWPORT } from '../src/games/exit-ticket.js';

if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}
afterEach(cleanup);

const QUESTIONS: TicketQuestion[] = [
  { id: 'recommend', kind: 'nps', prompt: 'How likely are you to recommend this?' },
  { id: 'clear', kind: 'scale', prompt: 'How clear was it?', min: 1, max: 5 },
  { id: 'next', kind: 'choice', prompt: 'What next?', options: [{ id: 'more', label: 'More of this' }, { id: 'less', label: 'Less of this' }] },
];
const players = ['p1', 'p2'].map((id) => ({ id, name: id, connected: true }));
const ctx = (playerId: string, host = false) => ({ playerId, host, at: 1, players });
const fresh = (): ExitTicketState => ({ questions: QUESTIONS, responses: {}, open: true });

describe('exit-ticket-model: the numbers', () => {
  it('groups a 0 to 10 score into the three standard bands', () => {
    expect([0, 6].map(npsBand)).toEqual(['detractor', 'detractor']);
    expect([7, 8].map(npsBand)).toEqual(['passive', 'passive']);
    expect([9, 10].map(npsBand)).toEqual(['promoter', 'promoter']);
  });

  it('scores promoters minus detractors as a whole number, and ignores anything off the scale', () => {
    expect(summarizeNps([10, 9, 8, 3])).toEqual({ count: 4, promoters: 2, passives: 1, detractors: 1, score: 25 });
    expect(summarizeNps([10, 10])).toMatchObject({ score: 100 });
    expect(summarizeNps([0, 5])).toMatchObject({ score: -100 });
    expect(summarizeNps([7, 8])).toMatchObject({ score: 0 });
    expect(summarizeNps([1, 2, 3, 9, 8, 8, 8])).toMatchObject({ score: -29 }); // (1 - 3) of 7, rounded
    expect(summarizeNps([11, -1, 2.5, 9])).toEqual({ count: 1, promoters: 1, passives: 0, detractors: 0, score: 100 });
    expect(summarizeNps([])).toEqual({ count: 0, promoters: 0, passives: 0, detractors: 0, score: null });
  });

  it('summarises every kind of question from anonymous answers', () => {
    const out = summarizeTicket(QUESTIONS, [
      { recommend: 10, clear: 5, next: 'more' },
      { recommend: 6, clear: 3 },
      { clear: 4, next: 'more' },
      { recommend: 'x' as unknown as number, clear: 99, next: 'zzz' },
    ]);
    expect(out[0]).toMatchObject({ kind: 'nps', count: 2, promoters: 1, detractors: 1, score: 0 });
    expect(out[1]).toEqual({ id: 'clear', kind: 'scale', count: 3, mean: 4, counts: [0, 0, 1, 1, 1], min: 1 });
    expect(out[2]).toEqual({ id: 'next', kind: 'choice', count: 2, options: [{ id: 'more', label: 'More of this', count: 2 }, { id: 'less', label: 'Less of this', count: 0 }] });
    expect(summarizeTicket(QUESTIONS, [])[1]).toMatchObject({ count: 0, mean: null });
  });
});

describe('exit-ticket-model: what a host and a phone may send', () => {
  it('takes one to five questions, each well formed, with defaults for a scale', () => {
    expect(cleanQuestions(QUESTIONS)).toEqual(QUESTIONS);
    expect(cleanQuestions([{ id: 's', kind: 'scale', prompt: 'P' }])).toEqual([{ id: 's', kind: 'scale', prompt: 'P', min: 1, max: 5 }]);
    expect(cleanQuestions([])).toBeNull();
    expect(cleanQuestions('x')).toBeNull();
    expect(cleanQuestions(Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, kind: 'nps', prompt: 'P' })))).toBeNull();
    expect(cleanQuestions([{ id: 'a', kind: 'nps', prompt: 'P' }, { id: 'a', kind: 'nps', prompt: 'Q' }])).toBeNull();
    expect(cleanQuestions([{ id: 'a b', kind: 'nps', prompt: 'P' }])).toBeNull();
    expect(cleanQuestions([{ id: 'a', kind: 'nps', prompt: ' ' }])).toBeNull();
    expect(cleanQuestions([{ id: 'a', kind: 'nps', prompt: 'x'.repeat(161) }])).toBeNull();
    expect(cleanQuestions([{ id: 'a', kind: 'weird', prompt: 'P' }])).toBeNull();
    expect(cleanQuestions([null])).toBeNull();
    for (const bad of [{ min: 1.5 }, { min: -1 }, { max: 11 }, { min: 3, max: 3 }, { max: 'x' }]) {
      expect(cleanQuestions([{ id: 's', kind: 'scale', prompt: 'P', ...bad }])).toBeNull();
    }
    const choice = (options: unknown) => cleanQuestions([{ id: 'c', kind: 'choice', prompt: 'P', options }]);
    expect(choice([{ id: 'a', label: 'A' }])).toBeNull();
    expect(choice('x')).toBeNull();
    expect(choice(Array.from({ length: 7 }, (_, i) => ({ id: `o${i}`, label: 'L' })))).toBeNull();
    expect(choice([{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }])).toBeNull();
    expect(choice([{ id: 'a', label: 'A' }, { id: 'b', label: '' }])).toBeNull();
    expect(choice([{ id: 'a', label: 'A' }, null])).toBeNull();
  });

  it('takes answers that fit the questions, and refuses the whole ticket for one that does not', () => {
    expect(cleanAnswers(QUESTIONS, { recommend: 9 })).toEqual({ recommend: 9 });
    expect(cleanAnswers(QUESTIONS, { recommend: 0, clear: 1, next: 'less' })).toEqual({ recommend: 0, clear: 1, next: 'less' });
    for (const bad of [{}, null, [], 'x', { ghost: 1 }, { recommend: 11 }, { recommend: 1.5 }, { recommend: '9' }, { clear: 0 }, { clear: 6 }, { next: 'zzz' }, { next: 3 }, { recommend: 9, clear: 99 }]) {
      expect(cleanAnswers(QUESTIONS, bad)).toBeNull();
    }
    expect(cleanAnswers(QUESTIONS, JSON.parse('{"__proto__":3,"recommend":4}'))).toBeNull();
  });
});

describe('exit-ticket-model: the room rule', () => {
  const run = (slice: unknown, action: unknown, who = 'p1', host = false) => exitTicketActivity(slice, action, ctx(who, host));

  it('lets only the host start, with usable questions', () => {
    expect(run(null, { type: 'start', questions: QUESTIONS })).toEqual({ refuse: 'not-host' });
    expect(run(null, { type: 'start', questions: QUESTIONS }, 'host', true)).toMatchObject({ slice: { responses: {}, open: true } });
    expect(run(null, { type: 'start', questions: [] }, 'host', true)).toEqual({ refuse: 'bad-action' });
  });

  it('keeps one set of answers per person, and a second send replaces the first', () => {
    const a = run(fresh(), { type: 'send', answers: { recommend: 9 } }) as { slice: ExitTicketState };
    const b = run(a.slice, { type: 'send', answers: { recommend: 3, clear: 2 } }) as { slice: ExitTicketState };
    expect(b.slice.responses).toEqual({ p1: { recommend: 3, clear: 2 } });
    const c = run(b.slice, { type: 'send', answers: { next: 'more' } }, 'p2') as { slice: ExitTicketState };
    expect(Object.keys(c.slice.responses)).toEqual(['p1', 'p2']);
  });

  it('refuses the host sending, a send before it starts, bad answers, and a send after it closes', () => {
    expect(run(fresh(), { type: 'send', answers: { recommend: 9 } }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(null, { type: 'send', answers: { recommend: 9 } })).toEqual({ refuse: 'wrong-phase' });
    expect(run(fresh(), { type: 'send', answers: { recommend: 99 } })).toEqual({ refuse: 'bad-action' });
    const closed = run(fresh(), { type: 'close', on: true }, 'host', true) as { slice: ExitTicketState };
    expect(closed.slice.open).toBe(false);
    expect(run(closed.slice, { type: 'send', answers: { recommend: 9 } })).toEqual({ refuse: 'wrong-phase' });
    expect((run(closed.slice, { type: 'close', on: false }, 'host', true) as { slice: ExitTicketState }).slice.open).toBe(true);
  });

  it('lets only the host close or clear, and clearing empties the answers and reopens', () => {
    expect(run(fresh(), { type: 'close', on: true })).toEqual({ refuse: 'not-host' });
    expect(run(fresh(), { type: 'clear' })).toEqual({ refuse: 'not-host' });
    expect(run(null, { type: 'close', on: true }, 'host', true)).toEqual({ refuse: 'wrong-phase' });
    expect(run(fresh(), { type: 'close', on: 'x' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    const full = { ...fresh(), responses: { p1: { recommend: 9 } }, open: false };
    expect(run(full, { type: 'clear' }, 'host', true)).toMatchObject({ slice: { responses: {}, open: true } });
  });

  it('refuses what is not the shape of a move', () => {
    for (const action of [null, 'send', 3, [], {}, { type: 1 }, { type: 'dance' }]) expect(run(fresh(), action)).toEqual({ refuse: 'bad-action' });
  });

  it('reads the room as untrusted, and drops people who left', () => {
    const room = (slice: unknown, ids = ['p1']) => ({ shared: { [EXIT_TICKET_KEY]: slice }, players: ids.map((id) => ({ id, name: id, connected: true })) });
    expect(readExitTicket(null)).toBeNull();
    expect(readExitTicket({ shared: {}, players: [] })).toBeNull();
    expect(readExitTicket(room(4))).toBeNull();
    expect(readExitTicket(room({ ...fresh(), questions: [] }))).toBeNull();
    expect(readExitTicket(room({ ...fresh(), responses: 3 }))).toBeNull();
    const slice = { ...fresh(), responses: { p1: { recommend: 9 }, gone: { recommend: 2 }, p2: { recommend: 77 } }, open: false };
    const read = readExitTicket(room(slice, ['p1', 'p2'])) as ExitTicketState;
    expect(read.responses).toEqual({ p1: { recommend: 9 } }); // p2's is off the scale, gone left
    expect(read.open).toBe(false);
    expect(readExitTicket(room(JSON.parse(JSON.stringify({ ...slice, responses: { '': { recommend: 1 } } })))))
      .toMatchObject({ responses: {} });
    // A player called __proto__ must not become the prototype of everyone's answers.
    const hostile = JSON.parse('{"questions":' + JSON.stringify(QUESTIONS) + ',"open":true,"responses":{"__proto__":{"recommend":9},"p1":{"recommend":4}}}');
    const safe = readExitTicket(room(hostile, ['p1', '__proto__'])) as ExitTicketState;
    expect(Object.getPrototypeOf(safe.responses)).toBe(Object.prototype);
    expect(Object.keys(safe.responses)).toEqual(['p1']);
    expect((safe.responses as Record<string, unknown>).recommend).toBeUndefined();
  });
});

describe('ExitTicket', () => {
  const summary = summarizeTicket(QUESTIONS, [{ recommend: 10, clear: 5, next: 'more' }, { recommend: 9, clear: 4 }, { recommend: 5, clear: 3, next: 'less' }]);

  it('asks every question as a labelled group, and cannot send an empty ticket', () => {
    const { container } = render(<ExitTicket questions={QUESTIONS} />);
    expect(container.querySelector('[data-slot="exit-ticket"]')?.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getByRole('radiogroup', { name: 'How likely are you to recommend this?' }).querySelectorAll('[role="radio"]')).toHaveLength(11);
    expect(screen.getByRole('radiogroup', { name: 'How clear was it?' }).querySelectorAll('[role="radio"]')).toHaveLength(5);
    expect(screen.getByRole('radiogroup', { name: 'What next?' }).querySelectorAll('[role="radio"]')).toHaveLength(2);
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Answer at least one question.')).toBeTruthy();
    expect(screen.getByText('Not at all likely')).toBeTruthy();
  });

  it('sends the answers once, thanks the person in a focused live region, and shows the room', () => {
    const onSend = vi.fn();
    const { container } = render(<ExitTicket questions={QUESTIONS} onSend={onSend} summary={summary} count={3} />);
    fireEvent.click(within('How likely are you to recommend this?', '9'));
    fireEvent.click(within('How clear was it?', '4'));
    fireEvent.click(screen.getByRole('radio', { name: 'More of this' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledExactlyOnceWith({ recommend: 9, clear: 4, next: 'more' });
    const status = container.querySelector('[data-slot="exit-ticket-status"]') as HTMLElement;
    expect(status.textContent).toBe('Thanks. Your answers are in.');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(status);
    expect(container.querySelector('[data-slot="exit-ticket-form"]')).toBeNull();
    expect(container.querySelector('[data-slot="exit-ticket-nps"]')?.textContent).toBe('Score 33: 2 promoters, 0 passives, 1 detractors.');
    expect(container.querySelector('[data-slot="exit-ticket-results"]')?.textContent).toContain('Average 4 from 3 people.');
    expect(container.querySelector('[data-slot="exit-ticket-results"]')?.textContent).toContain('More of this: 1. Less of this: 1.');
  });

  it('lets a person change their answers until it closes, then not', () => {
    const onSend = vi.fn();
    const { rerender } = render(<ExitTicket questions={QUESTIONS} onSend={onSend} defaultValue={{ recommend: 9 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change my answers' }));
    expect((screen.getByRole('radio', { name: '9' }) as HTMLElement).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within('How likely are you to recommend this?', '2'));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenLastCalledWith({ recommend: 2 });
    rerender(<ExitTicket questions={QUESTIONS} onSend={onSend} defaultValue={{ recommend: 9 }} closed />);
    expect(screen.queryByRole('button', { name: 'Change my answers' })).toBeNull();
    expect(screen.getByText('The exit ticket is closed.')).toBeTruthy();
  });

  it('hides the room until enough have sent, and says so', () => {
    const { container } = render(<ExitTicket questions={QUESTIONS} defaultValue={{ recommend: 9 }} summary={summary} count={3} minResponses={10} />);
    expect(container.querySelector('[data-slot="exit-ticket-results"]')).toBeNull();
    expect(container.querySelector('[data-slot="exit-ticket-status"]')?.textContent).toContain("The room's numbers show once 10 people have sent theirs.");
  });

  it('says plainly when no one has answered a question, and follows a controlled value', () => {
    const empty = summarizeTicket(QUESTIONS, []);
    const { container } = render(<ExitTicket questions={QUESTIONS} value={{ recommend: 9 }} summary={empty} count={1} labels={{ thanks: 'Done.' }} />);
    expect(container.querySelector('[data-slot="exit-ticket-results"]')?.textContent).toContain('No answers yet.');
    expect(container.querySelector('[data-slot="exit-ticket-status"]')?.textContent).toBe('Done.');
    expect(container.querySelector('[data-slot="exit-ticket"]')?.getAttribute('data-state')).toBe('sent');
  });

  it('is answered with the keyboard alone', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ExitTicket questions={[QUESTIONS[1] as TicketQuestion]} onSend={onSend} />);
    await user.tab();
    await user.keyboard(' ');
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Send' }));
    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledWith({ clear: 1 });
  });
});

function within(group: string, name: string): HTMLElement {
  const g = screen.getByRole('radiogroup', { name: group });
  return Array.from(g.querySelectorAll<HTMLElement>('[role="radio"]')).find((r) => r.textContent === name) as HTMLElement;
}
