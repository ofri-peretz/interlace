/**
 * Groups: pairs, small groups and teams from one model, the phone card and
 * the shared screen.
 */
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { groupOf, joinGroups, leaveGroups, makeGroups, repeatedPairs, teamTotals } =
  await import('../src/games/groups-model.js');
const { GroupCard, GroupGrid, MIN_VIEWPORT } = await import('../src/games/groups.js');

afterEach(() => {
  cleanup();
  reduced.value = false;
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

const people = (n: number) => Array.from({ length: n }, (_, i) => `p${String(i + 1).padStart(2, '0')}`);
const sizes = (groups: string[][]) => groups.map((g) => g.length).sort((a, b) => a - b);

describe('groups-model', () => {
  it('pairs a room, turning an odd one out into a trio', () => {
    const even = makeGroups(people(10), { seed: 1 });
    expect(sizes(even)).toEqual([2, 2, 2, 2, 2]);
    const odd = makeGroups(people(7), { seed: 1 });
    expect(sizes(odd)).toEqual([2, 2, 3]);
    expect(odd.flat().sort()).toEqual(people(7));
  });

  it('makes balanced teams and small groups', () => {
    expect(sizes(makeGroups(people(31), { count: 4, seed: 'x' }))).toEqual([7, 8, 8, 8]);
    expect(sizes(makeGroups(people(14), { size: 4, seed: 'x' }))).toEqual([4, 5, 5]);
    // More teams than people: one person each, no empty teams.
    expect(sizes(makeGroups(people(2), { count: 5, seed: 'x' }))).toEqual([1, 1]);
    expect(makeGroups(['solo'], { seed: 1 })).toEqual([['solo']]);
    expect(makeGroups([], { seed: 1 })).toEqual([]);
  });

  it('gives the same groups for the same seed, whatever the order or duplicates', () => {
    const a = makeGroups(people(12), { seed: 'round-1' });
    const b = makeGroups([...people(12)].reverse().concat('p01'), { seed: 'round-1' });
    expect(b).toEqual(a);
    expect(makeGroups(people(12), { seed: 'round-2' })).not.toEqual(a);
  });

  it('avoids putting the same people together again', () => {
    const room = people(12);
    const first = makeGroups(room, { seed: 1 });
    const again = makeGroups(room, { seed: 2, avoid: first });
    expect(repeatedPairs(again, first)).toBe(0);
    expect(repeatedPairs(first, first)).toBe(6);
    // Small rooms too, whatever the seed.
    const four = people(4);
    const before = [
      ['p01', 'p02'],
      ['p03', 'p04'],
    ];
    for (let seed = 0; seed < 20; seed++)
      expect(repeatedPairs(makeGroups(four, { seed, avoid: before }), before)).toBe(0);
    // When every arrangement repeats, it still returns one.
    expect(makeGroups(people(3), { count: 1, seed: 1, avoid: [people(3)] })[0]?.sort()).toEqual(people(3));
    // With one try, it takes what it gets.
    expect(makeGroups(room, { seed: 1, avoid: first, tries: 1 })).toEqual(first);
  });

  it('adds a late joiner to the smallest group and takes a leaver out', () => {
    const groups = [
      ['a', 'b', 'c'],
      ['d', 'e'],
      ['f', 'g'],
    ];
    const joined = joinGroups(groups, 'h');
    expect(joined).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'h'],
      ['f', 'g'],
    ]);
    expect(joinGroups(joined, 'h')).toEqual(joined);
    expect(joinGroups([], 'z')).toEqual([['z']]);
    expect(groupOf(joined, 'h')).toBe(1);
    expect(groupOf(joined, 'nobody')).toBe(-1);
    expect(leaveGroups([['a'], ['b', 'c']], 'a')).toEqual([['b', 'c']]);
  });

  it('totals team scores by sum or by mean', () => {
    const groups = [['a', 'b', 'c'], ['d', 'e'], []];
    const scores = { a: 10, b: 20, c: 0, d: 30, e: 5 };
    expect(teamTotals(groups, scores)).toEqual([
      { id: 'team-0', name: 'Team 1', score: 30 },
      { id: 'team-1', name: 'Team 2', score: 35 },
      { id: 'team-2', name: 'Team 3', score: 0 },
    ]);
    expect(teamTotals(groups, scores, { mode: 'mean', name: (i) => ['Red', 'Blue', 'Green'][i] as string })).toEqual([
      { id: 'team-0', name: 'Red', score: 10 },
      { id: 'team-1', name: 'Blue', score: 17.5 },
      { id: 'team-2', name: 'Green', score: 0 },
    ]);
    expect(teamTotals([['x']], {})[0]?.score).toBe(0);
  });
});

describe('GroupCard', () => {
  it('says who you are with, as a list and in one sentence', () => {
    const { container } = render(
      <GroupCard label="Your pair" members={['Dana', 'Sam']} prompt="What surprised you?" locale="en-US" />,
    );
    expect(container.querySelector('[data-slot="group-card"]')?.getAttribute('data-min-viewport')).toBe(
      String(MIN_VIEWPORT),
    );
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Dana', 'Sam']);
    expect(container.querySelector('[data-slot="group-card-announce"]')?.textContent).toBe("You're with Dana and Sam.");
    expect(screen.getByText('What surprised you?')).toBeTruthy();
    expect(screen.queryByRole('timer')).toBeNull();
  });

  it('waits for a partner, and shows a timer when there is a deadline', () => {
    const { container } = render(<GroupCard label="Your pair" members={[]} deadline={null} seconds={90} />);
    expect(container.querySelector('[data-state="waiting"]')).toBeTruthy();
    expect(screen.getByText('Waiting for someone to join you.')).toBeTruthy();
    expect(screen.getByRole('timer', { name: 'Time to talk' })).toBeTruthy();
  });

  it('rises in with the names following, and stays still under reduced motion', () => {
    const animate = vi.fn(() => ({ cancel: () => undefined }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const { rerender } = render(<GroupCard label="Team 2" members={['A', 'B', 'C']} />);
    // The card, then three names spread over 150ms.
    expect(animate).toHaveBeenCalledTimes(4);
    expect(animate.mock.calls.map((c) => (c as unknown[])[1])).toEqual([
      expect.objectContaining({ duration: 200 }),
      expect.objectContaining({ delay: 0 }),
      expect.objectContaining({ delay: 75 }),
      expect.objectContaining({ delay: 150 }),
    ]);
    rerender(<GroupCard label="Team 2" members={['A', 'B', 'C']} />);
    expect(animate).toHaveBeenCalledTimes(4);
    rerender(<GroupCard label="Team 2" members={['D']} labels={{ with: (n) => `Mit ${n}` }} />);
    expect(animate).toHaveBeenCalledTimes(6);
    expect(screen.getByText('Mit D')).toBeTruthy();
    cleanup();
    animate.mockClear();
    reduced.value = true;
    render(<GroupCard label="Team 2" members={['A']} />);
    expect(animate).not.toHaveBeenCalled();
  });
});

describe('GroupGrid', () => {
  it('lists every group, marks the viewer’s, and keys each name for the glide', () => {
    const { container } = render(
      <GroupGrid
        current="g2"
        size="stage"
        groups={[
          { id: 'g1', label: 'Team 1', members: [{ id: 'a', name: 'Ada' }] },
          {
            id: 'g2',
            label: 'Team 2',
            members: [
              { id: 'b', name: 'Ben' },
              { id: 'c', name: 'Cy' },
            ],
          },
        ]}
      />,
    );
    const groups = container.querySelectorAll('[data-slot="group-grid-group"]');
    expect(groups).toHaveLength(2);
    expect(groups[1]?.getAttribute('aria-current')).toBe('true');
    expect(groups[0]?.hasAttribute('aria-current')).toBe(false);
    expect([...container.querySelectorAll('[data-flip-id]')].map((el) => el.getAttribute('data-flip-id'))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
