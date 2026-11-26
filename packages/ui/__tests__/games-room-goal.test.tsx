/**
 * RoomGoal: one shared meter. Contributions count once per person per
 * round, a cap keeps it shared, milestones are said once, and the streak
 * counts rounds in a row.
 */
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { roomStreak, tallyRoomGoal } from '../src/games/room-goal-model.js';
import { MIN_VIEWPORT, RoomGoal } from '../src/games/room-goal.js';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

afterEach(() => {
  cleanup();
  reduced.value = false;
  vi.restoreAllMocks();
});

const milestones = [
  { at: 500, label: 'Group photo' },
  { at: 200, label: 'Bonus round' },
];

describe('room-goal-model', () => {
  it('counts each person once per round, drops bad input, and caps one person', () => {
    const events = [
      { by: 'a', round: 'r1', points: 100 },
      { by: 'a', round: 'r1', points: 100 },
      { by: 'a', round: 'r2', points: 100 },
      { by: 'b', round: 'r1', points: 150 },
      { by: 'c', round: 'r1', points: -5 },
      { by: 'c', round: 'r1', points: Number.NaN },
      null as never,
      { by: 7 as never, round: 'r1', points: 10 },
    ];
    expect(tallyRoomGoal(events, { target: 600, milestones })).toEqual({
      total: 350,
      people: 2,
      reached: [{ at: 200, label: 'Bonus round' }],
      next: { at: 500, label: 'Group photo' },
      done: false,
    });
    expect(tallyRoomGoal(events, { target: 300, capPerPerson: 150 })).toMatchObject({
      total: 300,
      done: true,
      next: null,
    });
    expect(tallyRoomGoal([], { target: 0 }).done).toBe(false);
  });

  it('is the same in any order and with every message twice', () => {
    const events = Array.from({ length: 60 }, (_, i) => ({
      by: `p${i % 30}`,
      round: `r${i % 2}`,
      points: 10 + (i % 7),
    }));
    const once = tallyRoomGoal(events, { target: 1000, milestones });
    expect(tallyRoomGoal([...events].reverse(), { target: 1000, milestones })).toEqual(once);
    expect(tallyRoomGoal([...events, ...events], { target: 1000, milestones })).toEqual(once);
  });

  it('counts rounds in a row above the bar', () => {
    const rounds = [
      { right: 8, answered: 10 },
      { right: 9, answered: 10 },
      { right: 2, answered: 10 },
      { right: 7, answered: 10 },
      { right: 0, answered: 0 },
      { right: 10, answered: 10 },
      { right: 10, answered: 10 },
    ];
    expect(roomStreak(rounds)).toEqual({ current: 2, best: 2 });
    expect(roomStreak(rounds, { threshold: 0.1 })).toEqual({ current: 2, best: 4 });
    expect(roomStreak([])).toEqual({ current: 0, best: 0 });
  });
});

describe('RoomGoal', () => {
  it('is a labelled meter with milestones as a list', () => {
    const { container } = render(
      <RoomGoal label="Our goal" value={350} target={600} milestones={milestones} streak={3} locale="en-US" />,
    );
    expect(container.querySelector('[data-slot="room-goal"]')?.getAttribute('data-min-viewport')).toBe(
      String(MIN_VIEWPORT),
    );
    const meter = screen.getByRole('meter', { name: 'Our goal' });
    expect(meter.getAttribute('aria-valuetext')).toBe('350 of 600');
    expect(meter.getAttribute('aria-valuenow')).toBe('350');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Bonus round200, reached',
      'Group photo500',
    ]);
    expect(screen.getByText('3 rounds in a row')).toBeTruthy();
  });

  it('says a milestone once when it is passed, lifts it, and marks the goal', () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const { container, rerender } = render(<RoomGoal label="G" value={100} target={600} milestones={milestones} />);
    const announce = () => container.querySelector('[data-slot="room-goal-announce"]')?.textContent;
    expect(announce()).toBe('');
    rerender(<RoomGoal label="G" value={520} target={600} milestones={milestones} />);
    expect(announce()).toBe('Milestone reached: Bonus round Milestone reached: Group photo');
    expect(animate).toHaveBeenCalledTimes(2);
    // The same total again says nothing new and lifts nothing.
    rerender(<RoomGoal label="G" value={520} target={600} milestones={milestones} />);
    expect(animate).toHaveBeenCalledTimes(2);
    rerender(<RoomGoal label="G" value={700} target={600} milestones={milestones} />);
    expect(announce()).toBe('Goal reached.');
    expect(container.querySelector('[data-slot="room-goal"]')?.getAttribute('data-state')).toBe('done');
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('600');
    expect(animate).toHaveBeenCalledTimes(3);
    // Going down says nothing.
    rerender(<RoomGoal label="G" value={10} target={600} milestones={milestones} />);
    expect(announce()).toBe('Goal reached.');
  });

  it('keeps still under reduced motion, hides a short streak, and takes labels', () => {
    reduced.value = true;
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const { container, rerender } = render(
      <RoomGoal
        label="G"
        value={0}
        target={100}
        milestones={[
          { at: 100, label: 'Done' },
          { at: 400, label: 'Off the end' },
        ]}
        streak={1}
        size="stage"
        labels={{ value: (v, t) => `${v}/${t}`, reached: (l) => `Geschafft: ${l}`, streak: (n) => `${n}x` }}
      />,
    );
    expect(container.querySelector('[data-slot="room-goal-streak"]')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    rerender(
      <RoomGoal
        label="G"
        value={100}
        target={100}
        milestones={[{ at: 100, label: 'Done' }]}
        streak={2}
        labels={{ reached: (l) => `Geschafft: ${l}`, streak: (n) => `${n}x` }}
      />,
    );
    expect(container.querySelector('[data-slot="room-goal-announce"]')?.textContent).toBe('Geschafft: Done');
    expect(screen.getByText('2x')).toBeTruthy();
    expect(animate).not.toHaveBeenCalled();
    cleanup();
    render(<RoomGoal label="G" value={Number.NaN} target={0} />);
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('0 of 0');
  });
});
