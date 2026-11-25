/**
 * After a session: "I want more on this" and the one-thing-this-week
 * commitment with its "did you?" a week later.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rankInterest } from '../src/patterns/interest-model.js';
import {
  CHECK_IN_ANSWERS,
  DAY_MS,
  commitmentImpact,
  followUpAt,
  followUpState,
} from '../src/patterns/commitment-model.js';
import { InterestBoard, InterestSignal, MIN_VIEWPORT as INTEREST_MIN } from '../src/patterns/interest-signal.js';
import { CommitmentCheckIn, CommitmentPicker, MIN_VIEWPORT as COMMITMENT_MIN } from '../src/patterns/commitment.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('interest-model', () => {
  it('ranks by asks, ties share a rank and keep their order', () => {
    const r = rankInterest(['a', 'b', 'c', 'd'], { a: 2, b: 5, c: 2 });
    expect(r.rows.map((x) => [x.id, x.count, x.rank])).toEqual([
      ['b', 5, 1],
      ['a', 2, 2],
      ['c', 2, 2],
    ]);
    expect(r.rows[1]!.share).toBeCloseTo(0.4);
    expect(r.rows[0]!.share).toBe(1);
    expect(r).toMatchObject({ total: 9, held: 0, more: 0 });
  });

  it("adds the viewer's asks once, unless counted already", () => {
    expect(rankInterest(['a', 'b'], { a: 1 }, { mine: ['a', 'b'] }).rows.map((x) => [x.id, x.count, x.mine])).toEqual([
      ['a', 2, true],
      ['b', 1, true],
    ]);
    expect(rankInterest(['a'], { a: 1 }, { mine: ['a'], countsIncludeMine: true }).total).toBe(1);
  });

  it('holds back small topics and cuts to the top few', () => {
    const r = rankInterest(['a', 'b', 'c', 'd'], { a: 9, b: 4, c: 1, d: 3 }, { minCount: 3, top: 2 });
    expect(r.rows.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r).toMatchObject({ held: 1, more: 1, total: 17 });
    expect(rankInterest(['a'], { a: 1 }, { top: -2 }).more).toBe(1);
    expect(rankInterest(['a'], { a: 1 }, { minCount: 0 }).rows).toHaveLength(1);
  });

  it('ignores junk and duplicate ids, and handles nobody asking', () => {
    const r = rankInterest(['a', 'a', 'b', 'c'], { a: -1, b: Number.NaN, c: 2.9 });
    expect(r.rows.map((x) => [x.id, x.count])).toEqual([['c', 2]]);
    const empty = rankInterest(['a', 'b']);
    expect(empty).toEqual({ rows: [], held: 0, more: 0, total: 0 });
  });
});

describe('commitment-model', () => {
  const madeAt = Date.UTC(2026, 10, 2, 18);

  it('asks a week later by default, or after the days given', () => {
    expect(followUpAt(madeAt)).toBe(madeAt + 7 * DAY_MS);
    expect(followUpAt(madeAt, { days: 3 })).toBe(madeAt + 3 * DAY_MS);
    expect(followUpAt(madeAt, { days: -1 })).toBe(madeAt + 7 * DAY_MS);
    expect(followUpAt(madeAt, { days: 0 })).toBe(madeAt);
  });

  it('moves from waiting to due to lapsed, and answered wins', () => {
    const c = { choice: 'x', madeAt };
    expect(followUpState(c, madeAt + DAY_MS)).toBe('waiting');
    expect(followUpState(c, madeAt + 7 * DAY_MS)).toBe('due');
    expect(followUpState(c, madeAt + 20 * DAY_MS)).toBe('due');
    expect(followUpState(c, madeAt + 21 * DAY_MS)).toBe('lapsed');
    expect(followUpState(c, madeAt + 9 * DAY_MS, { days: 1, openDays: 2 })).toBe('lapsed');
    expect(followUpState({ ...c, checkIn: { answer: 'partly', at: madeAt } }, madeAt)).toBe('answered');
    // A stored answer the model does not know is treated as no answer.
    expect(followUpState({ ...c, checkIn: { answer: 'maybe' as never, at: madeAt } }, madeAt)).toBe('waiting');
  });

  it('adds up what a room did', () => {
    const at = madeAt;
    const impact = commitmentImpact([
      { choice: 'p95', madeAt, checkIn: { answer: 'done', at } },
      { choice: 'p95', madeAt, checkIn: { answer: 'partly', at } },
      { choice: 'slo', madeAt, checkIn: { answer: 'not-yet', at } },
      { choice: 'logs', madeAt, checkIn: null },
      { choice: 'p95', madeAt },
    ]);
    expect(impact).toEqual({
      made: 5,
      answered: 3,
      done: 1,
      partly: 1,
      notYet: 1,
      responseRate: 0.6,
      followThrough: 2 / 3,
      choices: [
        { choice: 'p95', count: 3 },
        { choice: 'slo', count: 1 },
        { choice: 'logs', count: 1 },
      ],
    });
    expect(commitmentImpact([])).toMatchObject({ made: 0, responseRate: null, followThrough: null, choices: [] });
    expect(CHECK_IN_ANSWERS).toEqual(['done', 'partly', 'not-yet']);
  });
});

describe('InterestSignal', () => {
  it('toggles with a stable name and says what happened', () => {
    const onPressedChange = vi.fn();
    render(<InterestSignal count={4} topic="Traces" onPressedChange={onPressedChange} locale="en-US" />);
    const button = screen.getByRole('button', { name: 'I want more on this' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.querySelector('[data-slot="interest-signal"]')!.getAttribute('data-min-viewport')).toBe(
      String(INTEREST_MIN),
    );
    fireEvent.click(button);
    expect(onPressedChange).toHaveBeenLastCalledWith(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Noted. 4 others asked too.')).toBeTruthy();
    fireEvent.click(button);
    expect(onPressedChange).toHaveBeenLastCalledWith(false);
    expect(document.querySelector('[data-slot="interest-signal-status"]')!.textContent).toBe('');
  });

  it('stays controlled, and takes its words from labels', () => {
    const { rerender } = render(
      <InterestSignal pressed count={1} size="sm" labels={{ action: 'More please', noted: 'Got it.' }} />,
    );
    expect(screen.getByRole('button', { name: 'More please' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Got it. 1 other person asked too.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
    rerender(<InterestSignal pressed count={0} labels={{ others: (n) => `${n}` }} />);
    expect(screen.getByText('Noted.')).toBeTruthy();
  });

  it('pops its icon when pressed here, unless motion is reduced', () => {
    const animate = vi.fn();
    const proto = HTMLElement.prototype as unknown as { animate?: unknown };
    const before = proto.animate;
    proto.animate = animate;
    try {
      render(<InterestSignal />);
      fireEvent.click(screen.getByRole('button'));
      expect(animate).toHaveBeenCalledTimes(1);
      cleanup();
      vi.stubGlobal('matchMedia', (q: string) => ({
        matches: q.includes('reduce'),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
      render(<InterestSignal />);
      fireEvent.click(screen.getByRole('button'));
      expect(animate).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    } finally {
      proto.animate = before;
    }
  });
});

describe('InterestBoard', () => {
  const topics = [
    { id: 'metrics', label: 'Metrics' },
    { id: 'logs', label: 'Logs' },
    { id: 'traces', label: 'Traces' },
    { id: 'alerts', label: 'Alerts' },
  ];

  it('lists topics most-asked first, marks the viewer, notes what it held back', () => {
    render(
      <InterestBoard
        title="What the room wants more of"
        topics={topics}
        counts={{ metrics: 3, logs: 8, traces: 1, alerts: 4 }}
        mine={['alerts']}
        minCount={2}
        top={2}
        locale="en-US"
      />,
    );
    expect(screen.getByRole('region', { name: 'What the room wants more of' })).toBeTruthy();
    const rows = [...document.querySelectorAll('[data-slot="interest-board-row"]')];
    expect(rows.map((r) => r.querySelector('[data-slot="interest-board-label"]')!.textContent)).toEqual([
      'Logs',
      'AlertsYou asked',
    ]);
    expect(rows[1]!.hasAttribute('data-mine')).toBe(true);
    expect(screen.getByText('8 asked')).toBeTruthy();
    expect(screen.getByText('1 more topic shows once 2 people ask. And 1 more.')).toBeTruthy();
  });

  it('says when nobody asked yet, and uses label overrides', () => {
    render(<InterestBoard topics={topics} titleAs="h3" title="T" labels={{ empty: 'Nothing yet' }} animate={false} />);
    expect(screen.getByText('Nothing yet')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
    cleanup();
    render(
      <InterestBoard
        topics={topics}
        counts={{ logs: 1, traces: 1 }}
        minCount={5}
        labels={{ held: (n) => `${n} held`, count: (n) => `n=${n}`, mine: 'me', more: (n) => `+${n}` }}
      />,
    );
    expect(screen.getByText('2 held')).toBeTruthy();
    expect(document.querySelector('[data-slot="interest-board-list"]')).toBeNull();
  });

  it('grows the bars once on mount', () => {
    const animate = vi.fn();
    const proto = HTMLElement.prototype as unknown as { animate?: unknown };
    const before = proto.animate;
    proto.animate = animate;
    try {
      const { rerender } = render(<InterestBoard topics={topics} counts={{ logs: 2, metrics: 1 }} />);
      expect(animate).toHaveBeenCalledTimes(2);
      rerender(<InterestBoard topics={topics} counts={{ logs: 3, metrics: 1 }} />);
      expect(animate).toHaveBeenCalledTimes(2);
    } finally {
      proto.animate = before;
    }
  });
});

describe('CommitmentPicker', () => {
  const options = [
    { id: 'p95', label: 'Add a p95 to one dashboard' },
    { id: 'slo', label: <b>Write one SLO</b>, text: 'Write one SLO' },
  ];

  it('commits on one tap, says when it will ask, and can change', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 2, 18));
    const onValueChange = vi.fn();
    render(
      <CommitmentPicker
        prompt="Pick one thing to try this week"
        options={options}
        onValueChange={onValueChange}
        locale="en-US"
      />,
    );
    expect(document.querySelector('[data-slot="commitment"]')!.getAttribute('data-min-viewport')).toBe(
      String(COMMITMENT_MIN),
    );
    const option = screen.getByRole('button', { name: 'Write one SLO' });
    option.focus();
    fireEvent.click(option);
    expect(onValueChange).toHaveBeenCalledWith({ id: 'slo', text: 'Write one SLO' });
    expect(screen.getByText('Write one SLO')).toBeTruthy();
    expect(screen.getByText('We will ask how it went on Monday, November 9.')).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-slot')).toBe('commitment-summary');
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    act(() => {
      vi.runAllTimers();
    });
    expect(document.activeElement?.textContent).toBe('Add a p95 to one dashboard');
  });

  it('takes the person’s own words', () => {
    const onValueChange = vi.fn();
    render(<CommitmentPicker prompt="Pick one" options={options} allowOwn onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Something else' }));
    const field = screen.getByLabelText('What will you do?');
    expect(document.activeElement).toBe(field);
    const submit = screen.getByRole('button', { name: 'Commit to it' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.submit(field.closest('form')!);
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: '  Read one trace  ' } });
    fireEvent.click(submit);
    expect(onValueChange).toHaveBeenCalledWith({ id: null, text: 'Read one trace' });
    expect(document.querySelector('[data-slot="commitment"]')!.getAttribute('data-state')).toBe('committed');
  });

  it('restores a commitment, controlled, with or without its date', () => {
    const value = { id: 'p95', text: 'Add a p95 to one dashboard' };
    const { rerender } = render(
      <CommitmentPicker prompt="P" options={options} value={value} allowChange={false} labels={{ committed: 'Picked' }} />,
    );
    expect(screen.getByText('We will ask how it went in a week.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    rerender(
      <CommitmentPicker
        prompt="P"
        options={options}
        value={value}
        madeAt={Date.UTC(2026, 10, 2, 18)}
        followUpDays={3}
        locale="en-US"
        labels={{ followUp: (d) => `On ${d}` }}
      />,
    );
    expect(screen.getByText('On Thursday, November 5')).toBeTruthy();
    rerender(<CommitmentPicker prompt="P" options={[{ id: 'n', label: 7 }]} value={null} />);
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    expect(screen.getByText('P')).toBeTruthy();
  });

  it('falls back to the id for a label with no text, and pops the check', () => {
    const animate = vi.fn();
    const proto = HTMLElement.prototype as unknown as { animate?: unknown };
    const before = proto.animate;
    proto.animate = animate;
    try {
      render(<CommitmentPicker prompt="P" options={[{ id: 'icon-only', label: <span aria-label="Star" /> }]} />);
      fireEvent.click(screen.getByRole('button', { name: 'Star' }));
      expect(screen.getByText('icon-only')).toBeTruthy();
      expect(animate).toHaveBeenCalledTimes(1);
    } finally {
      proto.animate = before;
    }
  });
});

describe('CommitmentCheckIn', () => {
  it('asks did you, thanks, and lets the person change the answer', () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    render(<CommitmentCheckIn commitment="Write one SLO" onAnswer={onAnswer} footer="Next session: Thursday" />);
    expect(screen.getByRole('group', { name: 'Did you do it?' })).toBeTruthy();
    const partly = screen.getByRole('button', { name: 'Partly' });
    partly.focus();
    fireEvent.click(partly);
    expect(onAnswer).toHaveBeenCalledWith('partly');
    expect(document.activeElement?.textContent).toBe('A start counts. Thank you for telling us.');
    expect(document.querySelector('[data-slot="commitment-check-in"]')!.getAttribute('data-answer')).toBe('partly');
    fireEvent.click(screen.getByRole('button', { name: 'Change my answer' }));
    expect(onAnswer).toHaveBeenLastCalledWith(null);
    act(() => {
      vi.runAllTimers();
    });
    expect(document.activeElement?.textContent).toBe('Yes');
    expect(screen.getByText('Next session: Thursday')).toBeTruthy();
  });

  it('restores an answer, controlled, with custom words', () => {
    const { rerender } = render(
      <CommitmentCheckIn
        commitment="x"
        answer="done"
        allowChange={false}
        labels={{ thanks: (a) => `thanks:${a}`, question: 'Q', picked: 'You said' }}
      />,
    );
    expect(screen.getByText('thanks:done')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<CommitmentCheckIn commitment="x" answer={'nope' as never} labels={{ done: 'Y', partly: 'P', notYet: 'N' }} />);
    expect(screen.getByRole('button', { name: 'N' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Y' }));
    expect(screen.getByRole('button', { name: 'Y' })).toBeTruthy();
    rerender(<CommitmentCheckIn commitment="x" defaultAnswer="not-yet" />);
  });

  it('starts from an uncontrolled default answer', () => {
    render(<CommitmentCheckIn commitment="x" defaultAnswer="not-yet" />);
    expect(screen.getByText('Thank you for saying so. It is still worth a try.')).toBeTruthy();
  });
});
