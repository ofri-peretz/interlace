/**
 * TypeAnswer: folding, typo tolerance (never for numbers), clock scoring,
 * the room's answers, and the component's send, reveal and timeout.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  allowedEdits,
  editDistance,
  groupTyped,
  matchAnswer,
  normalizeAnswer,
  scoreTyped,
} from '../src/games/typed-answer-model.js';
import { MIN_VIEWPORT, TypeAnswer } from '../src/games/type-answer.js';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

afterEach(() => {
  cleanup();
  reduced.value = false;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('typed-answer-model', () => {
  it('folds case, accents, punctuation and spaces, keeping numbers whole', () => {
    expect(normalizeAnswer('  Tel-Aviv. ')).toBe('tel aviv');
    expect(normalizeAnswer('Café  Crème!')).toBe('cafe creme');
    expect(normalizeAnswer('3.14 and 1,5')).toBe('3.14 and 1.5');
    expect(normalizeAnswer('The Dead Sea', ['the'])).toBe('dead sea');
    expect(normalizeAnswer('?!')).toBe('');
  });

  it('counts edits, with swaps, and stops early', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('abcd', 'abdc')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('a', 'abcdef', 2)).toBe(3);
    expect(editDistance('abcdef', 'uvwxyz', 1)).toBe(2);
    expect(allowedEdits('nile')).toBe(0);
    expect(allowedEdits('jordan')).toBe(1);
    expect(allowedEdits('mediterranean')).toBe(2);
    expect(allowedEdits('1948')).toBe(0);
  });

  it('matches exactly, closely, or not at all', () => {
    const accepted = ['Mediterranean Sea', 'Mediterranean'];
    expect(matchAnswer('mediterranean', accepted)).toEqual({ outcome: 'exact', matched: 'Mediterranean', distance: 0 });
    expect(matchAnswer('Mediteranean', accepted)).toMatchObject({
      outcome: 'close',
      matched: 'Mediterranean',
      distance: 1,
    });
    expect(matchAnswer('Mediteranean', accepted, { tolerance: 'exact' }).outcome).toBe('wrong');
    expect(matchAnswer('Atlantic', accepted).outcome).toBe('wrong');
    expect(matchAnswer('   ', accepted).outcome).toBe('empty');
    expect(matchAnswer('1949', ['1948']).outcome).toBe('wrong');
    expect(matchAnswer('Nil', ['Nile']).outcome).toBe('wrong');
    expect(matchAnswer('x', ['', '!!']).outcome).toBe('wrong');
  });

  it('scores with the quiz clock', () => {
    const right = scoreTyped({ text: 'jordan', elapsedMs: 0, limitMs: 20_000 }, ['Jordan']);
    expect(right).toMatchObject({ outcome: 'correct', points: 1000, text: 'jordan' });
    expect(scoreTyped({ text: 'Jordn' }, ['Jordan'])).toMatchObject({
      outcome: 'correct',
      match: { outcome: 'close' },
    });
    expect(scoreTyped({ text: 'Nile' }, ['Jordan'])).toMatchObject({ outcome: 'wrong', points: 0 });
    expect(scoreTyped({ text: null, limitMs: 1000 }, ['Jordan'])).toMatchObject({ outcome: 'timeout', text: null });
    expect(scoreTyped({ text: '  ' }, ['Jordan']).outcome).toBe('timeout');
  });

  it('groups what the room typed, right answers as one row', () => {
    const groups = groupTyped(
      ['Jordan', 'jordan.', 'Jordn', 'Nile', 'nile', 'Euphrates', '', 7 as never, 'Nile '],
      ['Jordan'],
    );
    expect(groups).toEqual([
      { text: 'Jordan', count: 3, correct: true },
      { text: 'Nile', count: 3, correct: false },
      { text: 'Euphrates', count: 1, correct: false },
    ]);
    expect(groupTyped(['a'], [])).toEqual([{ text: 'a', count: 1, correct: false }]);
  });

  it('folds a room of 60 the same in any order, for counts', () => {
    const room = Array.from({ length: 60 }, (_, i) => ['Jordan', 'Nile', 'Jordn'][i % 3] as string);
    const counts = (g: ReturnType<typeof groupTyped>) => g.map((r) => [r.correct, r.count]).sort();
    expect(counts(groupTyped([...room].reverse(), ['Jordan']))).toEqual(counts(groupTyped(room, ['Jordan'])));
  });
});

describe('TypeAnswer', () => {
  it('sends on Enter, forgives a slip, spells it out and shows the room', () => {
    const onAnswer = vi.fn();
    const { container } = render(
      <TypeAnswer
        question="Which river flows into the Dead Sea?"
        accepted={['Jordan', 'Jordan River']}
        room={['Jordan', 'Nile', 'nile', 'Jordan', 'Euphrates', 'Tigris', 'Volga', 'Amazon']}
        spreadRows={3}
        meta="Question 2 of 5"
        explanation="It runs south from the north."
        onAnswer={onAnswer}
        locale="en-US"
      />,
    );
    expect(container.querySelector('[data-slot="type-answer"]')?.getAttribute('data-min-viewport')).toBe(
      String(MIN_VIEWPORT),
    );
    const field = screen.getByRole('textbox', { name: 'Which river flows into the Dead Sea?' }) as HTMLInputElement;
    // An empty send keeps the round open.
    fireEvent.submit(field.form as HTMLFormElement);
    expect(onAnswer).not.toHaveBeenCalled();
    field.focus();
    fireEvent.change(field, { target: { value: 'Jordn' } });
    fireEvent.submit(field.form as HTMLFormElement);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer.mock.calls[0]?.[0]).toMatchObject({ outcome: 'correct', text: 'Jordn', points: 1000 });
    const result = container.querySelector('[data-slot="type-answer-result"]') as HTMLElement;
    expect(result.textContent).toBe('Right, it is spelled Jordan. +1000 points.');
    expect(document.activeElement).toBe(result);
    expect(field.readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
    const spread = screen.getByRole('region', { name: 'What the room typed' });
    expect(spread.textContent).toContain('Jordan');
    expect(spread.textContent).toContain('Nile');
    expect(spread.textContent).toContain('Something else');
    // A second send does nothing.
    fireEvent.submit(field.form as HTMLFormElement);
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('marks a wrong answer and its row', () => {
    const { container } = render(
      <TypeAnswer
        question="Q"
        accepted={['Jordan']}
        room={['Nile', 'Jordan', 'Volga', 'Rhine']}
        roomIncludesAnswer
        spreadRows={2}
        labels={{ other: 'Andere' }}
      />,
    );
    const field = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'Rhine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(container.querySelector('[data-slot="type-answer"]')?.getAttribute('data-outcome')).toBe('wrong');
    expect(screen.getByText('Not this time. The answer is Jordan.')).toBeTruthy();
    expect(screen.getByRole('region').textContent).toContain('Andere');
  });

  it('runs out the clock with what is typed, or with nothing', () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    render(<TypeAnswer question="Q" accepted={['Jordan']} timeLimit={5} onAnswer={onAnswer} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'jordan' } });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onAnswer.mock.calls[0]?.[0]).toMatchObject({ outcome: 'correct', timed: true });
    cleanup();
    onAnswer.mockClear();
    render(<TypeAnswer question="Q" accepted={['Jordan']} timeLimit={5} onAnswer={onAnswer} />);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onAnswer.mock.calls[0]?.[0]).toMatchObject({ outcome: 'timeout', text: null });
    expect(screen.getByText("Time's up. The answer is Jordan.")).toBeTruthy();
  });

  it('can stop the clock, and then scores without speed', () => {
    const onAnswer = vi.fn();
    render(<TypeAnswer question="Q" accepted={['Jordan']} timeLimit={20} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop the clock' }));
    expect(screen.getByText('Clock stopped')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Jordan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(onAnswer.mock.calls[0]?.[0]).toMatchObject({ outcome: 'correct', points: 500, timed: false });
  });

  it('restores a revealed round without moving focus or animating', () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const done = scoreTyped({ text: 'Nile' }, ['Jordan']);
    render(<TypeAnswer question="Q" accepted={['Jordan']} defaultResult={done} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Nile');
    expect(document.activeElement).toBe(document.body);
    expect(animate).not.toHaveBeenCalled();
  });

  it('settles right, shakes wrong, and keeps still under reduced motion', () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const send = (value: string) => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    };
    render(<TypeAnswer question="Q" accepted={['Jordan']} />);
    send('Jordan');
    expect(animate.mock.calls[0]?.[0]).toHaveLength(3);
    cleanup();
    render(<TypeAnswer question="Q" accepted={['Jordan']} />);
    send('Nile');
    expect(animate.mock.calls[1]?.[0]).toHaveLength(5);
    cleanup();
    reduced.value = true;
    render(<TypeAnswer question="Q" accepted={['Jordan']} />);
    send('Nile');
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('does not take focus from elsewhere on the page', () => {
    vi.useFakeTimers();
    render(
      <>
        <button type="button">Elsewhere</button>
        <TypeAnswer question="Q" accepted={['Jordan']} timeLimit={2} />
      </>,
    );
    const other = screen.getByRole('button', { name: 'Elsewhere' });
    other.focus();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(document.activeElement).toBe(other);
  });
});
