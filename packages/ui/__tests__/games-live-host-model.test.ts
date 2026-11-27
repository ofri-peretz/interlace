/**
 * The picture reveal and the room goal: the host's alone, on a room.
 */
import { describe, expect, it } from 'vitest';

import {
  GOAL_KEY, MAX_GOAL_ROUNDS, REVEAL_KEY, goalActivity, readGoal, readReveal, revealActivity, type GoalState, type RevealState,
} from '../src/games/live-host-model.js';

const players = ['p1', 'p2'].map((id) => ({ id, name: id, connected: true }));
const ctx = (playerId: string, host = false) => ({ playerId, host, at: 1, players });
const room = (key: string, slice: unknown, scores: Record<string, number> = {}, ids = ['p1', 'p2']) => ({
  shared: { [key]: slice },
  scores,
  players: ids.map((id) => ({ id, name: id, connected: true })),
});

describe('picture reveal', () => {
  const run = (slice: unknown, action: unknown, who = 'host', host = true) => revealActivity(slice, action, ctx(who, host));
  const start = () => (run(null, { type: 'start', steps: 6, seed: 'haifa-1' }) as { slice: RevealState }).slice;

  it('starts covered, with the steps and the seed the host chose', () => {
    expect(start()).toEqual({ steps: 6, seed: 'haifa-1', step: 0, revealed: false });
    for (const bad of [{ steps: 1, seed: 'a' }, { steps: 13, seed: 'a' }, { steps: 2.5, seed: 'a' }, { steps: 'x', seed: 'a' }, { steps: 6, seed: 'a b' }, { steps: 6, seed: '' }, { steps: 6, seed: 'x'.repeat(41) }, { steps: 6 }]) {
      expect(run(null, { type: 'start', ...bad })).toEqual({ refuse: 'bad-action' });
    }
  });

  it('is the host\'s alone: a phone cannot start, step, reveal or cover', () => {
    for (const action of [{ type: 'start', steps: 6, seed: 'a' }, { type: 'step', step: 1 }, { type: 'reveal' }, { type: 'cover' }]) {
      expect(run(start(), action, 'p1', false)).toEqual({ refuse: 'not-host' });
    }
  });

  it('shows more or fewer steps, all of it, and covers it again', () => {
    const s = start();
    expect(run(s, { type: 'step', step: 3 })).toMatchObject({ slice: { step: 3, revealed: false } });
    expect(run(s, { type: 'step', step: 6 })).toMatchObject({ slice: { step: 6 } });
    expect(run(s, { type: 'step', step: 0 })).toMatchObject({ slice: { step: 0 } });
    for (const step of [-1, 7, 2.5, 'x']) expect(run(s, { type: 'step', step })).toEqual({ refuse: 'bad-action' });
    const shown = (run(s, { type: 'reveal' }) as { slice: RevealState }).slice;
    expect(shown).toMatchObject({ step: 6, revealed: true });
    expect(run(shown, { type: 'cover' })).toMatchObject({ slice: { step: 0, revealed: false } });
    expect(run(shown, { type: 'step', step: 2 })).toMatchObject({ slice: { revealed: false } });
  });

  it('refuses a move before it starts and what is not the shape of one', () => {
    expect(run(null, { type: 'step', step: 1 })).toEqual({ refuse: 'wrong-phase' });
    for (const action of [null, 'start', 3, [], {}, { type: 5 }, { type: 'dance' }]) expect(run(start(), action)).toEqual({ refuse: 'bad-action' });
  });

  it('reads the room as untrusted', () => {
    expect(readReveal(null)).toBeNull();
    expect(readReveal({ shared: {}, players: [], scores: {} })).toBeNull();
    for (const bad of [5, { steps: 6, seed: 'a', step: 7 }, { steps: 6, seed: 'a', step: -1 }, { steps: 6, seed: 'a', step: 'x' }, { steps: 1, seed: 'a', step: 0 }, { steps: 6, seed: 'a b', step: 0 }]) {
      expect(readReveal(room(REVEAL_KEY, bad))).toBeNull();
    }
    expect(readReveal(room(REVEAL_KEY, { steps: 6, seed: 'a', step: 2, revealed: true }))).toEqual({ steps: 6, seed: 'a', step: 2, revealed: true });
    expect(readReveal(room(REVEAL_KEY, { steps: 6, seed: 'a', step: 2, revealed: 'yes' }))?.revealed).toBe(false);
  });
});

describe('room goal', () => {
  const run = (slice: unknown, action: unknown, who = 'host', host = true) => goalActivity(slice, action, ctx(who, host));
  const start = (extra: Record<string, unknown> = {}) =>
    (run(null, { type: 'start', label: 'Room goal', target: 100, milestones: [{ at: 25, label: 'Warm' }, { at: 60, label: 'Hot' }], ...extra }) as { slice: GoalState }).slice;

  it('starts with a label, a target and milestones inside the target', () => {
    expect(start()).toEqual({ label: 'Room goal', target: 100, milestones: [{ at: 25, label: 'Warm' }, { at: 60, label: 'Hot' }], rounds: [] });
    expect(start({ milestones: undefined }).milestones).toEqual([]);
    expect(start({ milestones: [{ at: 500, label: 'Too far' }, { at: 0, label: 'Zero' }, { at: 10, label: '' }, { at: 'x', label: 'x' }, null, { at: 10, label: 'Ok' }] }).milestones).toEqual([{ at: 10, label: 'Ok' }]);
    expect(start({ milestones: Array.from({ length: 12 }, (_, i) => ({ at: i + 1, label: `M${i}` })) }).milestones).toHaveLength(8);
    for (const bad of [{ label: '' }, { label: 'x'.repeat(61) }, { target: 0 }, { target: 'x' }, { target: 2_000_000 }, { milestones: 'x' }]) {
      expect(run(null, { type: 'start', label: 'G', target: 10, ...bad })).toEqual({ refuse: 'bad-action' });
    }
  });

  it('is the host\'s alone', () => {
    for (const action of [{ type: 'start', label: 'G', target: 10 }, { type: 'round', right: 1, answered: 2 }, { type: 'clear' }]) expect(run(start(), action, 'p1', false)).toEqual({ refuse: 'not-host' });
  });

  it('keeps each round\'s result for the streak, the latest sixty', () => {
    let s = start();
    for (const r of [{ right: 8, answered: 10 }, { right: 9, answered: 10 }]) s = (run(s, { type: 'round', ...r }) as { slice: GoalState }).slice;
    expect(s.rounds).toEqual([{ right: 8, answered: 10 }, { right: 9, answered: 10 }]);
    for (const bad of [{ right: 3, answered: 2 }, { right: -1, answered: 2 }, { right: 1.5, answered: 2 }, { right: 'x', answered: 2 }, {}]) expect(run(s, { type: 'round', ...bad })).toEqual({ refuse: 'bad-action' });
    const many = { ...s, rounds: Array.from({ length: MAX_GOAL_ROUNDS }, () => ({ right: 1, answered: 1 })) };
    expect((run(many, { type: 'round', right: 0, answered: 5 }) as { slice: GoalState }).slice.rounds).toHaveLength(MAX_GOAL_ROUNDS);
    expect(run(s, { type: 'clear' })).toMatchObject({ slice: { rounds: [] } });
    expect(run(null, { type: 'round', right: 1, answered: 1 })).toEqual({ refuse: 'wrong-phase' });
    expect(run(null, { type: 'clear' })).toEqual({ refuse: 'wrong-phase' });
    for (const action of [null, 'round', 3, [], {}, { type: 5 }, { type: 'dance' }]) expect(run(s, action)).toEqual({ refuse: 'bad-action' });
  });

  it('shows the room\'s own points, without anyone who left, and the streak', () => {
    let s = start();
    for (const r of [{ right: 3, answered: 10 }, { right: 9, answered: 10 }, { right: 8, answered: 10 }]) s = (run(s, { type: 'round', ...r }) as { slice: GoalState }).slice;
    const view = readGoal(room(GOAL_KEY, s, { p1: 30, p2: 35, gone: 500, p3: 0 }, ['p1', 'p2']))!;
    expect(view).toMatchObject({ value: 65, target: 100, streak: 2, label: 'Room goal' });
    expect(view.tally.reached.map((m) => m.label)).toEqual(['Warm', 'Hot']);
    expect(view.tally.done).toBe(false);
    expect(readGoal(room(GOAL_KEY, s, {}))?.value).toBe(0);
    // A good run that then broke is a streak of nothing now, though the best run was two.
    let broken = start();
    for (const r of [{ right: 9, answered: 10 }, { right: 9, answered: 10 }, { right: 2, answered: 10 }]) broken = (run(broken, { type: 'round', ...r }) as { slice: GoalState }).slice;
    expect(readGoal(room(GOAL_KEY, broken))?.streak).toBe(0);
    expect(readGoal({ shared: { [GOAL_KEY]: s }, players, scores: undefined as never })?.value).toBe(0);
    expect(readGoal(room(GOAL_KEY, s, { p1: 200 }))?.tally.done).toBe(true);
  });

  it('reads the room as untrusted', () => {
    expect(readGoal(null)).toBeNull();
    expect(readGoal({ shared: {}, players: [], scores: {} })).toBeNull();
    for (const bad of [5, { label: 'G', target: 10, milestones: 'x', rounds: [] }, { label: 'G', target: 10, milestones: [], rounds: 'x' }, { label: '', target: 10, milestones: [], rounds: [] }, { label: 'G', target: -1, milestones: [], rounds: [] }]) {
      expect(readGoal(room(GOAL_KEY, bad))).toBeNull();
    }
    const s = { label: 'G', target: 10, milestones: [], rounds: [{ right: 1, answered: 1 }, { right: 5, answered: 1 }, null] };
    expect(readGoal(room(GOAL_KEY, s))?.streak).toBe(1);
  });
});
