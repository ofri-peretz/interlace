/**
 * Check-in: the room's mood as numbers, the room rule, and the faces people tap.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHECK_IN_KEY,
  DEFAULT_MOODS,
  checkInActivity,
  cleanMoods,
  currentRound,
  moodShift,
  readCheckIn,
  summarizeMoods,
  type CheckInState,
} from '../src/games/check-in-model.js';
import { CheckIn, MIN_VIEWPORT } from '../src/games/check-in.js';

if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}
afterEach(cleanup);

const players = ['p1', 'p2'].map((id) => ({ id, name: id, connected: true }));
const ctx = (playerId: string, host = false) => ({ playerId, host, at: 1, players });
const run = (slice: unknown, action: unknown, who = 'p1', host = false) => checkInActivity(slice, action, ctx(who, host));
const started = () => (run(null, { type: 'start' }, 'host', true) as { slice: CheckInState }).slice;

describe('check-in-model: the numbers', () => {
  it('ships five moods from -2 to 2', () => {
    expect(DEFAULT_MOODS.map((m) => m.value)).toEqual([2, 1, 0, -1, -2]);
    expect(cleanMoods([...DEFAULT_MOODS])).toEqual(DEFAULT_MOODS);
  });

  it('counts each mood, the average and the top one; a mood that is not there counts nowhere', () => {
    const s = summarizeMoods(DEFAULT_MOODS, { p1: 'great', p2: 'good', p3: 'good', p4: 'nope' });
    expect(s.count).toBe(3);
    expect(s.mean).toBeCloseTo(4 / 3);
    expect(s.top).toBe('good');
    expect(s.counts.map((c) => c.count)).toEqual([1, 2, 0, 0, 0]);
    expect(summarizeMoods(DEFAULT_MOODS, {})).toMatchObject({ count: 0, mean: null, top: null });
    expect(summarizeMoods(DEFAULT_MOODS, { a: 'okay', b: 'low' }).top).toBe('okay'); // level: the first
  });

  it('measures how far the room moved, or null when either round is empty', () => {
    expect(moodShift(DEFAULT_MOODS, { a: 'low', b: 'low' }, { a: 'good', b: 'okay' })).toBe(1.5);
    expect(moodShift(DEFAULT_MOODS, {}, { a: 'good' })).toBeNull();
    expect(moodShift(DEFAULT_MOODS, { a: 'good' }, {})).toBeNull();
  });

  it('takes two to six well-formed moods', () => {
    const ok = [{ id: 'a', label: 'A', value: 0 }, { id: 'b', label: 'B', value: 2 }];
    expect(cleanMoods(ok)).toEqual(ok);
    expect(cleanMoods(ok.slice(0, 1))).toBeNull();
    expect(cleanMoods('x')).toBeNull();
    expect(cleanMoods(Array.from({ length: 7 }, (_, i) => ({ id: `m${i}`, label: 'L', value: 0 })))).toBeNull();
    expect(cleanMoods([ok[0], { ...ok[0] }])).toBeNull();
    expect(cleanMoods([ok[0], { id: 'b', label: 'B', value: 3 }])).toBeNull();
    expect(cleanMoods([ok[0], { id: 'b', label: 'B', value: 'x' }])).toBeNull();
    expect(cleanMoods([ok[0], { id: 'b', label: '', value: 0 }])).toBeNull();
    expect(cleanMoods([ok[0], { id: 'b', label: 'x'.repeat(25), value: 0 }])).toBeNull();
    expect(cleanMoods([ok[0], null])).toBeNull();
  });
});

describe('check-in-model: the room rule', () => {
  it('starts with five moods and one round, only for the host', () => {
    expect(started()).toMatchObject({ rounds: ['start'], picks: { start: {} }, open: true });
    expect(started().moods).toEqual(DEFAULT_MOODS);
    expect(run(null, { type: 'start' })).toEqual({ refuse: 'not-host' });
    expect(run(null, { type: 'start', round: 'arrive', moods: [{ id: 'a', label: 'A', value: 0 }, { id: 'b', label: 'B', value: 1 }] }, 'host', true)).toMatchObject({ slice: { rounds: ['arrive'] } });
    expect(run(null, { type: 'start', moods: [] }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(null, { type: 'start', round: 'bad round' }, 'host', true)).toEqual({ refuse: 'bad-action' });
  });

  it('lets a player pick and change their mind, never the host or a mood that is not there', () => {
    const a = run(started(), { type: 'pick', mood: 'good' }) as { slice: CheckInState };
    expect(a.slice.picks.start).toEqual({ p1: 'good' });
    expect((run(a.slice, { type: 'pick', mood: 'low' }) as { slice: CheckInState }).slice.picks.start).toEqual({ p1: 'low' });
    expect(run(started(), { type: 'pick', mood: 'zzz' })).toEqual({ refuse: 'bad-action' });
    expect(run(started(), { type: 'pick', mood: 9 })).toEqual({ refuse: 'bad-action' });
    expect(run(started(), { type: 'pick', mood: 'good' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(null, { type: 'pick', mood: 'good' })).toEqual({ refuse: 'wrong-phase' });
  });

  it('asks again as a new round that keeps the old one, and picks go to the newest', () => {
    const a = run(started(), { type: 'pick', mood: 'low' }) as { slice: CheckInState };
    const b = run(a.slice, { type: 'round', id: 'end' }, 'host', true) as { slice: CheckInState };
    expect(b.slice.rounds).toEqual(['start', 'end']);
    expect(currentRound(b.slice)).toBe('end');
    expect(b.slice.picks.start).toEqual({ p1: 'low' });
    const c = run(b.slice, { type: 'pick', mood: 'great' }) as { slice: CheckInState };
    expect(c.slice.picks).toEqual({ start: { p1: 'low' }, end: { p1: 'great' } });
    expect(run(b.slice, { type: 'round', id: 'end' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(b.slice, { type: 'round', id: 'bad id' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(b.slice, { type: 'round', id: 'x' })).toEqual({ refuse: 'not-host' });
    let s = started();
    for (const id of ['r2', 'r3', 'r4']) s = (run(s, { type: 'round', id }, 'host', true) as { slice: CheckInState }).slice;
    expect(run(s, { type: 'round', id: 'r5' }, 'host', true)).toEqual({ refuse: 'bad-action' }); // at most four
  });

  it('closes and reopens, and clears only the open round', () => {
    const closed = run(started(), { type: 'open', on: false }, 'host', true) as { slice: CheckInState };
    expect(run(closed.slice, { type: 'pick', mood: 'good' })).toEqual({ refuse: 'wrong-phase' });
    expect(run(started(), { type: 'open', on: 'x' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(started(), { type: 'open', on: false })).toEqual({ refuse: 'not-host' });
    expect(run(null, { type: 'open', on: false }, 'host', true)).toEqual({ refuse: 'wrong-phase' });
    const two = { ...started(), rounds: ['start', 'end'], picks: { start: { p1: 'low' }, end: { p1: 'good' } }, open: false };
    expect(run(two, { type: 'clear' }, 'host', true)).toMatchObject({ slice: { picks: { start: { p1: 'low' }, end: {} }, open: true } });
    expect(run(two, { type: 'clear' })).toEqual({ refuse: 'not-host' });
  });

  it('refuses what is not the shape of a move', () => {
    for (const action of [null, 'pick', 4, [], {}, { type: 2 }, { type: 'dance' }]) expect(run(started(), action)).toEqual({ refuse: 'bad-action' });
  });

  it('reads the room as untrusted, and drops people who left', () => {
    const room = (slice: unknown, ids = ['p1']) => ({ shared: { [CHECK_IN_KEY]: slice }, players: ids.map((id) => ({ id, name: id, connected: true })) });
    expect(readCheckIn(null)).toBeNull();
    expect(readCheckIn({ shared: {}, players: [] })).toBeNull();
    for (const bad of [3, { ...started(), rounds: [] }, { ...started(), rounds: ['a', 'a'] }, { ...started(), rounds: ['a b'] }, { ...started(), rounds: Array.from({ length: 5 }, (_, i) => `r${i}`) }, { ...started(), moods: [] }, { ...started(), picks: 1 }]) {
      expect(readCheckIn(room(bad))).toBeNull();
    }
    const slice = { ...started(), picks: { start: { p1: 'good', gone: 'low', p2: 'zzz', '': 'good' } } };
    expect(readCheckIn(room(slice, ['p1', 'p2']))?.picks).toEqual({ start: { p1: 'good' } });
    expect(readCheckIn(room({ ...started(), picks: {} }))?.picks).toEqual({ start: {} }); // a round with no entry
    expect(readCheckIn(room({ ...started(), picks: { start: 'oops' } }))?.picks).toEqual({ start: {} });
    expect(readCheckIn(room({ ...slice, open: false }))?.open).toBe(false);
  });
});

describe('CheckIn', () => {
  const picks = { a: 'great', b: 'good', c: 'good', d: 'low' };

  it('shows every mood as a named choice and no spread before the viewer picks', () => {
    const { container } = render(<CheckIn prompt="How are you arriving?" moods={DEFAULT_MOODS} picks={picks} faces={{ great: <svg data-face /> }} />);
    expect(container.querySelector('[data-slot="check-in"]')?.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getByRole('radiogroup', { name: 'How are you arriving?' })).toBeTruthy();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Great', 'Good', 'Okay', 'Low', 'Rough']);
    expect(container.querySelector('[data-face]')?.closest('[aria-hidden]')).toBeTruthy();
    expect(container.querySelector('[data-slot="check-in-spread"]')).toBeNull();
    expect(container.querySelector('[data-slot="check-in"]')?.getAttribute('data-state')).toBe('choosing');
  });

  it('says plainly, before the pick, that the host can see who chose what, and can be told otherwise', () => {
    const { container, rerender } = render(<CheckIn prompt="Q" moods={DEFAULT_MOODS} />);
    expect(container.querySelector('[data-slot="check-in-privacy"]')?.textContent).toBe('The host can see who chose which face.');
    fireEvent.click(screen.getByRole('radio', { name: 'Good' }));
    expect(container.querySelector('[data-slot="check-in-privacy"]')).toBeNull(); // they have read it; the room now speaks
    rerender(<CheckIn prompt="Q" moods={DEFAULT_MOODS} labels={{ privacy: 'Counted by the organiser only.' }} defaultValue={null} value={null} />);
    expect(container.querySelector('[data-slot="check-in-privacy"]')?.textContent).toBe('Counted by the organiser only.');
    rerender(<CheckIn prompt="Q" moods={DEFAULT_MOODS} labels={{ privacy: '' }} value={null} />);
    expect(container.querySelector('[data-slot="check-in-privacy"]')).toBeNull();
  });

  it('picks, shows the spread, and says in one sentence what the room chose', () => {
    const onPick = vi.fn();
    const { container } = render(<CheckIn prompt="Q" moods={DEFAULT_MOODS} picks={picks} onPick={onPick} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Low' }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith('low');
    expect(container.querySelector('[data-slot="check-in-status"]')?.textContent).toBe('4 checked in. Most chose Good. You chose Low.');
    expect(container.querySelector('[data-slot="check-in-status"]')?.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelectorAll('[data-slot="check-in-bar"]')).toHaveLength(5);
    expect(container.querySelector('[data-mine]')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Low' }));
    expect(onPick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('radio', { name: 'Great' }));
    expect(onPick).toHaveBeenLastCalledWith('great');
  });

  it('says how the mood moved since the earlier round', () => {
    const { container } = render(<CheckIn prompt="Q" moods={DEFAULT_MOODS} picks={{ a: 'good', b: 'great' }} before={{ a: 'low', b: 'okay' }} defaultValue="good" />);
    expect(container.querySelector('[data-slot="check-in-status"]')?.textContent).toContain("The room's mood moved +2 since before.");
    const none = render(<CheckIn prompt="Q" moods={DEFAULT_MOODS} picks={{ a: 'good' }} before={{}} defaultValue="good" />);
    expect(none.container.querySelector('[data-slot="check-in-status"]')?.textContent).not.toContain('moved');
  });

  it('hides the spread until enough have picked', () => {
    const { container } = render(<CheckIn prompt="Q" moods={DEFAULT_MOODS} picks={{ a: 'good' }} defaultValue="good" minResponses={6} />);
    expect(container.querySelector('[data-slot="check-in-spread"]')).toBeNull();
    expect(container.querySelector('[data-slot="check-in-status"]')?.textContent).toBe('Thanks. The room shows once 6 people have checked in.');
  });

  it('cannot change once closed, and says so', () => {
    const onPick = vi.fn();
    const { container } = render(<CheckIn prompt="Q" moods={DEFAULT_MOODS} picks={picks} defaultValue="good" closed onPick={onPick} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Low' }));
    expect(onPick).not.toHaveBeenCalled();
    expect(container.querySelector('[data-slot="check-in"]')?.getAttribute('data-state')).toBe('closed');
    expect(container.querySelector('[data-slot="check-in-status"]')?.textContent).toContain('The check-in is closed.');
  });

  it('follows a controlled value, takes its words from labels, and is moved by the keyboard', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const { container } = render(
      <CheckIn prompt="Q" moods={DEFAULT_MOODS} picks={{ a: 'good' }} value="good" onPick={onPick} labels={{ status: ({ mine }) => `Yours: ${mine}` }} />,
    );
    expect(container.querySelector('[data-slot="check-in-status"]')?.textContent).toBe('Yours: Good');
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(onPick).toHaveBeenLastCalledWith('okay');
  });
});
