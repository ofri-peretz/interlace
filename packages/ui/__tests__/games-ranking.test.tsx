/**
 * Ranking by preference: the room's order from everyone's, how much they
 * agree, the phone that ranks and the screen that shows the room.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isFullRanking, roomAgreement, tallyRankings } from '../src/games/ranking-model.js';
import { MIN_VIEWPORT, RankChoices, RankResults } from '../src/games/ranking.js';

afterEach(cleanup);

const ids = ['a', 'b', 'c'];
const options = [
  { id: 'a', label: 'Food' },
  { id: 'b', label: 'Music' },
  { id: 'c', label: 'Tech' },
];

describe('ranking-model', () => {
  it('checks that a ranking holds every item once', () => {
    expect(isFullRanking(['c', 'a', 'b'], ids)).toBe(true);
    expect(isFullRanking(['a', 'b'], ids)).toBe(false);
    expect(isFullRanking(['a', 'a', 'b'], ids)).toBe(false);
    expect(isFullRanking(['a', 'b', 'x'], ids)).toBe(false);
  });

  it('tallies places into the room order, leaving bad rankings out', () => {
    const { items, people } = tallyRankings(
      {
        p1: ['b', 'a', 'c'],
        p2: ['b', 'c', 'a'],
        p3: ['a', 'b', 'c'],
        bad: ['c', 'c', 'c'],
      },
      ids,
    );
    expect(people).toBe(3);
    expect(items).toEqual([
      { id: 'b', points: 5, firsts: 2, meanPlace: 4 / 3 },
      { id: 'a', points: 3, firsts: 1, meanPlace: 2 },
      { id: 'c', points: 1, firsts: 0, meanPlace: 8 / 3 },
    ]);
  });

  it('breaks ties by first places, then by the given order', () => {
    // All three tie on 2 points; b was never first, so it goes last; a and c keep the given order.
    expect(tallyRankings({ p: ['a', 'b', 'c'], q: ['c', 'b', 'a'] }, ids).items.map((r) => r.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
    expect(tallyRankings({}, ids).items.map((r) => [r.id, r.meanPlace])).toEqual([
      ['a', 0],
      ['b', 0],
      ['c', 0],
    ]);
  });

  it('says how much the room agrees', () => {
    expect(roomAgreement({ p: ['a', 'b', 'c'], q: ['a', 'b', 'c'] }, ids)).toBe(1);
    expect(roomAgreement({ p: ['a', 'b', 'c'], q: ['c', 'b', 'a'] }, ids)).toBe(0.5);
    expect(roomAgreement({ bad: ['a'] }, ids)).toBeNull();
  });

  it('counts a room of 60 the same in any arrival order', () => {
    const rankings = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`p${i}`, i % 2 ? ['a', 'b', 'c'] : ['c', 'a', 'b']]),
    );
    const reversed = Object.fromEntries(Object.entries(rankings).reverse());
    expect(tallyRankings(reversed, ids)).toEqual(tallyRankings(rankings, ids));
  });
});

describe('RankChoices', () => {
  it('moves rows by button and by key, announces each move, and sends the order', async () => {
    const onSend = vi.fn();
    const onOrderChange = vi.fn();
    const { container } = render(
      <RankChoices
        question="What first?"
        options={options}
        defaultOrder={['a', 'b', 'c']}
        onSend={onSend}
        onOrderChange={onOrderChange}
      />,
    );
    expect(container.querySelector('[data-slot="rank-choices"]')?.getAttribute('data-min-viewport')).toBe(
      String(MIN_VIEWPORT),
    );
    expect(screen.getByRole('list', { name: 'What first?' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Move Food up' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move Food down' }));
    expect(onOrderChange).toHaveBeenLastCalledWith(['b', 'a', 'c']);
    const announce = () => container.querySelector('[data-slot="rank-choices-announce"]')?.textContent;
    expect(announce()).toBe('Food, now 2 of 3');
    const handle = screen.getByRole('button', { name: /^Tech, 3 of 3/ });
    handle.focus();
    await act(async () => {
      fireEvent.keyDown(handle, { key: 'Home' });
    });
    expect(announce()).toBe('Tech, now 1 of 3');
    expect(document.activeElement?.getAttribute('data-handle')).toBe('c');
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'x' });
    // Already last: nothing to move.
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('button', { name: 'Send my order' }));
    expect(onSend).toHaveBeenCalledWith(['b', 'a', 'c']);
    expect(screen.getByText('Sent. Thank you.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Move Food down' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('starts from a seeded order, the same for everyone', () => {
    const order = () =>
      [...document.querySelectorAll('[data-handle]')].map((el) => el.getAttribute('data-handle')).join('');
    render(<RankChoices question="Q" options={options} seed="s1" />);
    const first = order();
    cleanup();
    render(<RankChoices question="Q" options={options} seed="s1" />);
    expect(order()).toBe(first);
    cleanup();
    render(<RankChoices question="Q" options={options} />);
    expect(order()).toHaveLength(3);
  });

  it('is controlled and can be sent from the parent', () => {
    const onOrderChange = vi.fn();
    render(
      <RankChoices
        question="Q"
        options={options}
        order={['c', 'b', 'a']}
        onOrderChange={onOrderChange}
        sent
        labels={{ sent: 'Done' }}
      />,
    );
    expect(screen.getByText('Done')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('button', { name: /^Tech/ }), { key: 'ArrowDown' });
    expect(onOrderChange).not.toHaveBeenCalled();
  });
});

describe('RankResults', () => {
  it('reads each row as one line, in the room order', () => {
    const { items } = tallyRankings({ p: ['b', 'a', 'c'], q: ['b', 'c', 'a'] }, ids);
    const { container } = render(<RankResults items={items} options={options} size="stage" locale="en-US" />);
    expect([...container.querySelectorAll('li .sr-only')].map((el) => el.textContent)).toEqual([
      'Music: place 1, average place 1, first for 2 people',
      'Food: place 2, average place 2.5, first for 0 people',
      'Tech: place 3, average place 2.5, first for 0 people',
    ]);
    cleanup();
    render(
      <RankResults
        items={[{ id: 'z', points: 0, firsts: 1, meanPlace: 1 }]}
        options={[]}
        labels={{ mean: (m) => `ø ${m}` }}
      />,
    );
    expect(screen.getByText('ø 1')).toBeTruthy();
    expect(document.querySelector('li .sr-only')?.textContent).toBe('z: place 1, average place 1, first for 1 person');
  });
});
