/**
 * Poll and quiz: the shares and points a server can repeat, and the
 * components a player sees.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { tally, wholePercents } from '../src/games/tally-model.js';
import { scoreAnswer } from '../src/games/quiz-model.js';
import { Poll, MIN_VIEWPORT as POLL_MIN } from '../src/games/poll.js';
import { QuizQuestion } from '../src/games/quiz-question.js';
import { TallyBars } from '../src/games/tally-bars.js';
import { TimerRing } from '../src/games/timer-ring.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('tally-model', () => {
  it('rounds to whole percents that sum to 100', () => {
    expect(wholePercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercents([2, 1])).toEqual([67, 33]);
    expect(wholePercents([0, 0])).toEqual([0, 0]);
    expect(wholePercents([1, 0, 0, 0])).toEqual([100, 0, 0, 0]);
    const p = wholePercents([7, 13, 29, 3, 11]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('adds the viewer vote once and marks the leader', () => {
    const t = tally(['a', 'b', 'c'], { a: 2, b: 3 }, { vote: 'a' });
    expect(t.total).toBe(6);
    expect(t.rows.map((r) => r.count)).toEqual([3, 3, 0]);
    expect(t.rows.map((r) => r.leading)).toEqual([true, true, false]);
    expect(t.rows[0]).toMatchObject({ mine: true, percent: 50, share: 0.5 });
    expect(tally(['a', 'b'], { a: 2 }, { vote: 'a', countsIncludeVote: true }).total).toBe(2);
  });

  it('ignores junk counts and handles nobody voting', () => {
    const t = tally(['a', 'b', 'c'], { a: -4, b: Number.NaN, c: 2.7 });
    expect(t.rows.map((r) => r.count)).toEqual([0, 0, 2]);
    const empty = tally(['a', 'b']);
    expect(empty.total).toBe(0);
    expect(empty.rows.every((r) => r.share === 0 && !r.leading && !r.mine)).toBe(true);
  });
});

describe('quiz-model', () => {
  it('scores right, wrong and time-out answers', () => {
    expect(scoreAnswer({ choice: 'a' }, 'a')).toMatchObject({ outcome: 'correct', points: 1000, timed: false });
    expect(scoreAnswer({ choice: 'b' }, 'a')).toMatchObject({ outcome: 'wrong', points: 0 });
    expect(scoreAnswer({ choice: null, limitMs: 10_000, elapsedMs: 10_000 }, 'a')).toMatchObject({ outcome: 'timeout', points: 0 });
  });

  it('pays for speed only on a running clock', () => {
    expect(scoreAnswer({ choice: 'a', limitMs: 10_000, elapsedMs: 0 }, 'a').points).toBe(1000);
    expect(scoreAnswer({ choice: 'a', limitMs: 10_000, elapsedMs: 5000 }, 'a')).toMatchObject({ points: 750, timed: true, elapsedMs: 5000 });
    expect(scoreAnswer({ choice: 'a', limitMs: 10_000, elapsedMs: 20_000 }, 'a').points).toBe(500);
    // The clock was stopped: no speed share, never more than racing.
    const stopped = scoreAnswer({ choice: 'a', limitMs: 10_000 }, 'a');
    expect(stopped).toMatchObject({ points: 500, timed: false });
    expect(stopped).not.toHaveProperty('elapsedMs');
    expect(scoreAnswer({ choice: 'a', limitMs: 10_000, elapsedMs: 0 }, 'a', { maxPoints: 10, speedShare: 2 }).points).toBe(10);
    expect(scoreAnswer({ choice: 'a', limitMs: 10_000 }, 'a', { speedShare: -1 }).points).toBe(1000);
  });
});

describe('Poll', () => {
  const options = [
    { id: 'a', label: 'Mornings' },
    { id: 'b', label: 'Evenings' },
  ];

  it('votes in one tap, shows the shares and fires once', () => {
    const onVote = vi.fn();
    const { container } = render(<Poll question="When do you read?" options={options} counts={{ a: 1, b: 2 }} onVote={onVote} />);
    expect(container.firstElementChild?.getAttribute('data-min-viewport')).toBe(String(POLL_MIN));
    expect(screen.getByRole('group', { name: 'When do you read?' })).toBeTruthy();
    const btn = screen.getByRole('button', { name: 'Mornings' });
    btn.focus();
    fireEvent.click(btn);
    expect(onVote).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('button', { name: 'Mornings' })).toBeNull();
    expect(screen.getByText('You chose Mornings, with 50% of 4 votes.')).toBeTruthy();
    expect(screen.getByText('Your answer')).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-slot')).toBe('poll-result');
  });

  it('restores a stored vote and holds results under minVotes', () => {
    const { rerender } = render(
      <Poll question="Q" options={options} counts={{ a: 1 }} countsIncludeVote defaultVote="a" minVotes={5} footer="Closes Friday" />,
    );
    expect(screen.getByText('Thanks. The results show once 5 people have voted.')).toBeTruthy();
    expect(screen.getByText('Closes Friday')).toBeTruthy();
    rerender(<Poll question="Q" options={[{ id: 'a', label: <b>A</b>, text: 'Alpha' }]} vote="a" counts={{ a: 1 }} />);
    expect(screen.getByText('You chose Alpha, with 100% of 2 votes.')).toBeTruthy();
  });

  it('controlled: leaves the vote to the parent, and re-opens when cleared', () => {
    const onVote = vi.fn();
    const { rerender } = render(<Poll question="Q" options={options} vote={null} onVote={onVote} />);
    fireEvent.click(screen.getByRole('button', { name: 'Evenings' }));
    expect(onVote).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Evenings' })).toBeTruthy();
    rerender(<Poll question="Q" options={[{ id: 'x', label: <i>icon</i> }]} vote="x" labels={{ total: (n) => `${n} in` }} />);
    expect(screen.getByText('You chose x, with 100% of 1 in.')).toBeTruthy();
    rerender(<Poll question="Q" options={options} vote={null} onVote={onVote} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mornings' }));
    expect(onVote).toHaveBeenCalledTimes(2);
  });
});

describe('TallyBars', () => {
  it('reads as a list with words for marks', () => {
    const { rows } = tally(['a', 'b'], { a: 1, b: 0 }, { vote: 'b' });
    render(
      <TallyBars
        rows={rows}
        optionLabels={{ a: 'Alpha' }}
        marks={{ a: 'correct', b: 'wrong' }}
        showTotal={false}
        animate={false}
      />,
    );
    expect(screen.getByText('Right answer')).toBeTruthy();
    expect(screen.getByText('Your answer')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.queryByText(/votes?$/)).toBeNull();
  });

  it('grows the fills on mount when it can', () => {
    const animate = vi.fn();
    const orig = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = animate as unknown as typeof orig;
    const { rows } = tally(['a'], { a: 1 });
    render(<TallyBars rows={rows} optionLabels={{ a: 'A' }} labels={{ total: (n) => `${n} total` }} />);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 total')).toBeTruthy();
    HTMLElement.prototype.animate = orig;
  });
});

describe('TimerRing', () => {
  it('counts down to the deadline, announces sparingly and expires once', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onExpire = vi.fn();
    render(<TimerRing seconds={12} deadline={12_000} onExpire={onExpire} />);
    const timer = screen.getByRole('timer', { name: 'Time left' });
    expect(timer.textContent).toContain('12');
    act(() => {
      vi.advanceTimersByTime(2_100);
    });
    expect(timer.textContent).toContain('10');
    expect(screen.getByText('10 seconds left')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(timer.getAttribute('data-state')).toBe('low');
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(timer.getAttribute('data-state')).toBe('done');
    expect(screen.getByText("Time's up")).toBeTruthy();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('counts on the clock it is given (a deadline set by another device)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    // The host's clock is 90 s ahead: its deadline 100 s reads as 10 s left here.
    render(<TimerRing seconds={20} deadline={100_000} now={() => Date.now() + 90_000} />);
    expect(screen.getByRole('timer').textContent).toContain('10');
    vi.useRealTimers();
  });

  it('sits idle and full with no deadline', () => {
    render(<TimerRing seconds={0} deadline={null} size="sm" labels={{ name: 'Clock' }} />);
    expect(screen.getByRole('timer', { name: 'Clock' }).getAttribute('data-state')).toBe('idle');
  });
});

describe('QuizQuestion', () => {
  const choices = [
    { id: 'a', label: 'Two' },
    { id: 'b', label: 'Four' },
    { id: 'c', label: 'Six' },
  ];

  it('answers by tap, marks the tiles and shows the spread', () => {
    const onAnswer = vi.fn();
    render(
      <QuizQuestion
        question="2 + 2?"
        choices={choices}
        correct="b"
        onAnswer={onAnswer}
        distribution={{ a: 1, b: 2 }}
        explanation="Two pairs."
        meta="Question 1 of 3"
      />,
    );
    expect(screen.getByRole('group', { name: '2 + 2?' })).toBeTruthy();
    const two = screen.getByRole('button', { name: 'Two' });
    expect(two.getAttribute('aria-keyshortcuts')).toBe('1');
    two.focus();
    fireEvent.click(two);
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'wrong', points: 0, choice: 'a' }));
    expect(screen.getByText('Not this time. The answer is Four.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'How everyone answered' })).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-slot')).toBe('quiz-question-result');
    expect(screen.getByRole('button', { name: /Four.*Right answer/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Four/ }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('picks with number keys, but not while typing or with modifiers', () => {
    const onAnswer = vi.fn();
    const onKeyDown = vi.fn();
    const { container } = render(
      <QuizQuestion question="Q" choices={choices} correct="b" onAnswer={onAnswer} onKeyDown={onKeyDown} explanation={<span>why</span>} />,
    );
    const root = container.firstElementChild as HTMLElement;
    const input = document.createElement('input');
    root.appendChild(input);
    fireEvent.keyDown(input, { key: '2' });
    fireEvent.keyDown(root, { key: '2', ctrlKey: true });
    fireEvent.keyDown(root, { key: '7' });
    fireEvent.keyDown(root, { key: 'x' });
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.keyDown(root, { key: '2' });
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'correct', points: 1000 }));
    expect(onKeyDown).toHaveBeenCalled();
    expect(screen.getByText('Right. +1000 points.')).toBeTruthy();
  });

  it('times out, and the clock can be stopped', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onAnswer = vi.fn();
    const { unmount } = render(<QuizQuestion question="Q" choices={choices} correct="a" timeLimit={3} onAnswer={onAnswer} />);
    act(() => {
      vi.advanceTimersByTime(3_100);
    });
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'timeout', choice: null }));
    expect(screen.getByText("Time's up. The answer is Two.")).toBeTruthy();
    unmount();

    const onStopped = vi.fn();
    render(<QuizQuestion question="Q" choices={choices} correct="a" timeLimit={3} onAnswer={onStopped} labels={{ clockStopped: 'Off' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop the clock' }));
    expect(screen.getByText('Off')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onStopped).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Two' }));
    expect(onStopped).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'correct', points: 500, timed: false }));
  });

  it('restores a stored result and plays the reveal when it can', () => {
    const animate = vi.fn();
    const orig = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = animate as unknown as typeof orig;
    render(<QuizQuestion question="Q" choices={choices} correct="c" result={null} onAnswer={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Two' }));
    // Controlled: still asking until the parent stores the result.
    expect(screen.getByRole('button', { name: 'Two' })).toBeTruthy();
    cleanup();
    render(
      <QuizQuestion
        question="Q"
        choices={[{ id: 'z', label: <b>Zed</b> }]}
        correct="q"
        defaultResult={scoreAnswer({ choice: 'z' }, 'q')}
        labels={{ result: ({ answer }) => `Was ${answer}` }}
      />,
    );
    expect(screen.getByText('Was q')).toBeTruthy();
    cleanup();
    render(<QuizQuestion question="Q" choices={choices} correct="c" />);
    fireEvent.click(screen.getByRole('button', { name: 'Two' }));
    expect(animate).toHaveBeenCalledTimes(2);
    HTMLElement.prototype.animate = orig;
  });
});
