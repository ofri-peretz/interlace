/**
 * Streak: what a player is told and what assistive tech reads, in each state.
 */
import * as React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MIN_VIEWPORT, Streak } from '../src/games/streak.js';
import { dayKey } from '../src/games/daily.js';

afterEach(cleanup);

const PLAYED = ['2026-11-19', '2026-11-20', '2026-11-22', '2026-11-23'];

describe('Streak', () => {
  it('shows the run, today’s status, a labelled strip and the best run', () => {
    const { container } = render(
      <Streak played={PLAYED} today="2026-11-24" rest={{ weekdays: [6] }} locale="en-US" />,
    );
    const root = container.querySelector('[data-slot="streak"]')!;
    expect(root.getAttribute('data-status')).toBe('pending');
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Play today to keep your streak.')).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Recent days' });
    const days = within(list).getAllByRole('listitem');
    expect(days.map((d) => d.getAttribute('data-state'))).toEqual([
      'missed',
      'played',
      'played',
      'rest',
      'played',
      'played',
      'open',
    ]);
    expect(days[6]!.getAttribute('aria-current')).toBe('date');
    expect(days[3]!.textContent).toContain('Saturday, November 21: rest day');
    expect(screen.getByText('Best: 4 days')).toBeTruthy();
  });

  it('marks today played and says so', () => {
    const { container } = render(
      <Streak played={[...PLAYED, '2026-11-24']} today="2026-11-24" rest={{ weekdays: [6] }} after={2} />,
    );
    expect(container.querySelector('[data-slot="streak"]')!.getAttribute('data-status')).toBe('played');
    expect(screen.getByText('Played today. See you tomorrow.')).toBeTruthy();
    expect(container.querySelectorAll('[data-state="future"]')).toHaveLength(2);
    expect(container.querySelector('[data-today] svg')).toBeTruthy();
  });

  it('takes its words from labels', () => {
    render(
      <Streak
        played={['2026-11-23']}
        today="2026-11-24"
        length={3}
        labels={{
          unit: 'jours de suite',
          status: { pending: 'Jouez aujourd’hui.' },
          best: (n) => `Record : ${n}`,
          days: 'Derniers jours',
          state: { missed: 'manqué' },
        }}
      />,
    );
    expect(screen.getByText('jours de suite')).toBeTruthy();
    expect(screen.getByText('Jouez aujourd’hui.')).toBeTruthy();
    expect(screen.getByText('Record : 1')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Derniers jours' }).textContent).toContain('manqué');
  });

  it('hides the best run when asked, or when there is none', () => {
    const { rerender } = render(<Streak played={[]} today="2026-11-24" />);
    expect(screen.queryByText(/Best/)).toBeNull();
    expect(screen.getByText('Play today to start a streak.')).toBeTruthy();
    rerender(<Streak played={['2026-11-24']} today="2026-11-24" showBest={false} />);
    expect(screen.queryByText(/Best/)).toBeNull();
    rerender(<Streak played={['2026-11-24']} today="2026-11-24" />);
    expect(screen.getByText('Best: 1 day')).toBeTruthy();
  });

  it('falls back to today on the clock', () => {
    const today = dayKey(new Date(), 'UTC');
    const { container } = render(<Streak played={[today]} timeZone="UTC" />);
    expect(container.querySelector('[data-slot="streak"]')!.getAttribute('data-status')).toBe('played');
  });

  it('compact: one chip with the whole sentence for assistive tech', () => {
    const { container, rerender } = render(
      <Streak variant="compact" played={PLAYED} today="2026-11-23" />,
    );
    const chip = container.querySelector('[data-slot="streak"]')!;
    expect(chip.getAttribute('data-variant')).toBe('compact');
    expect(chip.textContent).toBe('22 day streak. Played today. See you tomorrow.');
    expect(chip.querySelector('[data-slot="streak-days"]')).toBeNull();
    rerender(<Streak variant="compact" played={[]} today="2026-11-23" />);
    expect(container.querySelector('[data-slot="streak"]')!.getAttribute('data-status')).toBe('none');
  });
});
