/**
 * DailyPuzzle: the frame around a daily game, and its countdown.
 */
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DailyPuzzle, DailyPuzzleCountdown, MIN_VIEWPORT, formatLeft } from '../src/games/daily-puzzle.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DailyPuzzle', () => {
  it('names the game, its number and date, and the round in play', () => {
    const { container } = render(
      <DailyPuzzle title="Sample game" number={42} day="2026-11-24" rounds={3} round={2} aside={<span>chip</span>} locale="en-US">
        <p>Round body</p>
      </DailyPuzzle>,
    );
    const section = screen.getByRole('region', { name: 'Sample game' });
    expect(section.getAttribute('data-state')).toBe('playing');
    expect(section.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getByRole('heading', { level: 2, name: 'Sample game' })).toBeTruthy();
    expect(container.querySelector('[data-slot="daily-puzzle-meta"]')!.textContent).toBe('No. 42 · Tuesday, November 24');
    expect(container.querySelector('time')!.getAttribute('dateTime')).toBe('2026-11-24');
    expect(screen.getByText('Round 2 of 3')).toBeTruthy();
    expect([...container.querySelectorAll('ol li')].map((li) => li.getAttribute('data-state'))).toEqual([
      'done',
      'current',
      'next',
    ]);
    expect(screen.getByText('chip')).toBeTruthy();
    expect(screen.getByText('Round body')).toBeTruthy();
  });

  it('sets the title at the page-title step when it is the page title, and at h3 inside a page', () => {
    const { rerender } = render(<DailyPuzzle title="Sample game">x</DailyPuzzle>);
    const title = () => screen.getByRole('heading', { name: 'Sample game' });
    expect(title().className).toContain('text-h3');
    expect(screen.getByRole('region').getAttribute('data-size')).toBe('default');
    // A page whose whole content is the puzzle titles it like any other page.
    rerender(
      <DailyPuzzle title="Sample game" size="page" headingLevel={1}>
        x
      </DailyPuzzle>,
    );
    expect(title().className).toContain('text-section');
    expect(title().className).not.toContain('text-h3');
    expect(screen.getByRole('region').getAttribute('data-size')).toBe('page');
  });

  it('says when today is done, with labels and a heading level', () => {
    const { container, rerender } = render(
      <DailyPuzzle
        title="T"
        headingLevel={1}
        number={7}
        rounds={3}
        done
        labels={{ number: (n) => `#${n}`, done: 'Fini', progress: (r, of) => `${r}/${of}` }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(container.querySelector('[data-slot="daily-puzzle-meta"]')!.textContent).toBe('#7');
    expect(screen.getByText('Fini')).toBeTruthy();
    expect(container.querySelectorAll('li[data-state="done"]')).toHaveLength(3);
    rerender(<DailyPuzzle title="T" rounds={3} round={9} labels={{ progress: (r, of) => `${r}/${of}` }} />);
    expect(screen.getByText('3/3')).toBeTruthy();
  });

  it('a one-round game shows only the date, and the done line when finished', () => {
    const { container, rerender } = render(<DailyPuzzle title="T" day="2026-11-24" locale="en-US" />);
    expect(container.querySelector('[data-slot="daily-puzzle-meta"]')!.textContent).toBe('Tuesday, November 24');
    expect(container.querySelector('[data-slot="daily-puzzle-progress"]')).toBeNull();
    rerender(<DailyPuzzle title="T" done />);
    expect(container.querySelector('[data-slot="daily-puzzle-meta"]')).toBeNull();
    expect(screen.getByText('All done for today')).toBeTruthy();
  });
});

describe('formatLeft', () => {
  it('uses hours and minutes, then seconds in the last minute', () => {
    expect(formatLeft(5 * 3_600_000 + 12 * 60_000, 'en-US')).toBe('5 hr 12 min');
    expect(formatLeft(3 * 3_600_000, 'en-US')).toBe('3 hr');
    expect(formatLeft(12 * 60_000 - 1, 'en-US')).toBe('12 min');
    expect(formatLeft(45_000, 'en-US')).toBe('45 sec');
    expect(formatLeft(-5, 'en-US')).toBe('0 sec');
  });
});

describe('DailyPuzzleCountdown', () => {
  it('counts down in the zone and turns at midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 24, 23, 58, 30));
    const onNextDay = vi.fn();
    const { container } = render(<DailyPuzzleCountdown timeZone="UTC" onNextDay={onNextDay} locale="en-US" />);
    const p = container.querySelector('[data-slot="daily-puzzle-countdown"]')!;
    const shown = p.firstElementChild!;
    const status = p.querySelector('[data-slot="daily-puzzle-countdown-status"]')!;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(shown.textContent).toBe('Next puzzle in 2 min');
    expect(status.textContent).toBe('');
    act(() => vi.advanceTimersByTime(40_000));
    expect(shown.textContent).toBe('Next puzzle in 51 sec');
    expect(status.textContent).toBe('');
    act(() => vi.advanceTimersByTime(60_000));
    // Only the day turning is announced, and the visible copy steps aside so it is read once.
    expect(status.textContent).toBe('A new puzzle is ready');
    expect(shown.getAttribute('aria-hidden')).toBe('true');
    expect(p.getAttribute('data-state')).toBe('ready');
    expect(onNextDay).toHaveBeenCalledTimes(1);
  });

  it('takes its words from labels', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 24, 20, 0, 0));
    render(<DailyPuzzleCountdown timeZone="UTC" locale="en-US" labels={{ nextIn: (t) => `Encore ${t}` }} />);
    expect(screen.getByText('Encore 4 hr')).toBeTruthy();
  });
});
