/**
 * Points: spend a budget across options, check one person's split, add up a
 * room, and the two parts.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkSplit, nudge, spentOf, totalPoints } from '../src/games/points-model.js';
import { MIN_VIEWPORT, PointsSplit, PointsTotals } from '../src/games/points-split.js';

afterEach(cleanup);

const ids = ['food', 'music', 'tech'];
const options = [
  { id: 'food', label: 'Food' },
  { id: 'music', label: 'Music' },
  { id: 'tech', label: 'Tech' },
];

describe('points-model', () => {
  it('accepts a full split and says why others are refused', () => {
    expect(checkSplit({ food: 60, music: 40 }, ids)).toEqual({ ok: true });
    expect(checkSplit({ food: 60 }, ids)).toEqual({ ok: false, reason: 'under-budget' });
    expect(checkSplit({ food: 60 }, ids, { partial: true })).toEqual({ ok: true });
    expect(checkSplit({ food: 110 }, ids)).toEqual({ ok: false, reason: 'over-budget' });
    expect(checkSplit({ art: 100 }, ids)).toEqual({ ok: false, reason: 'unknown-option' });
    expect(checkSplit({ food: -10, music: 110 }, ids)).toEqual({ ok: false, reason: 'negative' });
    expect(checkSplit({ food: Number.NaN }, ids)).toEqual({ ok: false, reason: 'negative' });
    expect(checkSplit({ food: 55, music: 45 }, ids)).toEqual({ ok: false, reason: 'not-a-step' });
    expect(checkSplit({ food: 55, music: 45 }, ids, { step: 5 })).toEqual({ ok: true });
  });

  it('adds up a room, leaving out bad splits, most points first', () => {
    const { totals, people } = totalPoints(
      {
        a: { food: 50, music: 50 },
        b: { tech: 100, food: 0 },
        c: { music: 30, tech: 70 },
        bad: { food: 1000 },
      },
      ids,
    );
    expect(people).toBe(3);
    expect(totals.map((t) => [t.id, t.points, t.backers])).toEqual([
      ['tech', 170, 2],
      ['music', 80, 2],
      ['food', 50, 1],
    ]);
    expect(totals[0]?.share).toBeCloseTo(170 / 300);
    // Nobody yet: every option at zero, in the given order.
    expect(totalPoints({}, ids).totals.map((t) => [t.id, t.share])).toEqual([
      ['food', 0],
      ['music', 0],
      ['tech', 0],
    ]);
  });

  it('nudges within the budget and never below zero', () => {
    expect(nudge({}, 'food', 10)).toEqual({ food: 10 });
    expect(nudge({ food: 95 }, 'music', 10)).toEqual({ food: 95, music: 5 });
    expect(nudge({ food: 10 }, 'food', -20)).toEqual({ food: 0 });
    expect(spentOf({ a: 20, b: 30 })).toBe(50);
  });

  it('counts a room of 60 the same in any order', () => {
    const splits = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`p${i}`, { [ids[i % 3] as string]: 100 }]));
    const reversed = Object.fromEntries(Object.entries(splits).reverse());
    expect(totalPoints(reversed, ids)).toEqual(totalPoints(splits, ids));
    expect(totalPoints(splits, ids).people).toBe(60);
  });
});

describe('PointsSplit', () => {
  it('spends the budget with named buttons and sends once it is all placed', () => {
    const onSend = vi.fn();
    const { container } = render(
      <PointsSplit question="Where should we spend more time?" options={options} budget={30} onSend={onSend} />,
    );
    expect(container.querySelector('[data-slot="points-split"]')?.getAttribute('data-min-viewport')).toBe(
      String(MIN_VIEWPORT),
    );
    expect(screen.getByRole('group', { name: 'Where should we spend more time?' })).toBeTruthy();
    expect(screen.getByText('30 points left')).toBeTruthy();
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Take 10 points from Food' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add 10 points to Food' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 10 points to Food' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 10 points to Tech' }));
    expect(screen.getByText('0 points left')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Add 10 points to Music' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Take 10 points from Food' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add 10 points to Music' }));
    fireEvent.click(send);
    expect(onSend).toHaveBeenCalledWith({ food: 10, tech: 10, music: 10 });
    expect(screen.getByText('Sent. Thank you.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });

  it('is controlled, can send part of the budget, and takes labels', () => {
    const onChange = vi.fn();
    const onSend = vi.fn();
    render(
      <PointsSplit
        question="Q"
        options={options}
        value={{ food: 20 }}
        partial
        onChange={onChange}
        onSend={onSend}
        labels={{ left: (n) => `${n} übrig`, send: 'Senden' }}
      />,
    );
    expect(screen.getByText('80 übrig')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 10 points to Music' }));
    expect(onChange).toHaveBeenCalledWith({ food: 20, music: 10 });
    expect(screen.getByText('80 übrig')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    expect(onSend).toHaveBeenCalledWith({ food: 20 });
  });

  it('shows the sent state from the parent', () => {
    render(<PointsSplit question="Q" options={options} sent />);
    expect(screen.getByText('Sent. Thank you.')).toBeTruthy();
  });
});

describe('PointsTotals', () => {
  it('reads each row as one line and keys rows for the glide', () => {
    const { totals } = totalPoints({ a: { tech: 70, food: 30 } }, ids);
    const { container } = render(<PointsTotals totals={totals} options={options} size="stage" locale="en-US" />);
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('.sr-only')?.textContent)).toEqual([
      'Tech: 70 points, 70%',
      'Food: 30 points, 30%',
      'Music: 0 points, 0%',
    ]);
    expect([...container.querySelectorAll('[data-flip-id]')].map((el) => el.getAttribute('data-flip-id'))).toEqual([
      'tech',
      'food',
      'music',
    ]);
    cleanup();
    render(
      <PointsTotals
        totals={[{ id: 'gone', points: 0, share: 0, backers: 0 }]}
        options={[]}
        labels={{ row: (r) => `${r.label}=${r.points}` }}
      />,
    );
    expect(screen.getByText('gone=0')).toBeTruthy();
  });
});
