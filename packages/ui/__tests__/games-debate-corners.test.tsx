/**
 * Debate corners: the pure model and room rule, and the part people stand on.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CORNERS_KEY,
  cleanCorners,
  cornersActivity,
  createCorners,
  readCorners,
  tallyCorners,
  type CornersState,
} from '../src/games/debate-corners-model.js';
import { DebateCorners, MIN_VIEWPORT } from '../src/games/debate-corners.js';

// jsdom has no PointerEvent; Base UI's radio makes one on click.
if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}

afterEach(cleanup);

const CORNERS = [
  { id: 'a', label: 'Agree strongly' },
  { id: 'b', label: 'Agree a little' },
  { id: 'c', label: 'Disagree a little' },
  { id: 'd', label: 'Disagree strongly' },
];
const players = ['p1', 'p2', 'p3'].map((id) => ({ id, name: id, connected: true }));
const ctx = (playerId: string, host = false) => ({ playerId, host, at: 1, players });
const started = () => createCorners('Mornings are best.', CORNERS) as CornersState;

describe('debate-corners-model', () => {
  it('takes two to four corners with their own ids and plain labels, and nothing else', () => {
    expect(cleanCorners(CORNERS)).toEqual(CORNERS);
    expect(cleanCorners([{ id: 'a', label: '  Yes   please ' }, { id: 'b', label: 'No' }])?.[0]?.label).toBe('Yes please');
    expect(cleanCorners(CORNERS.slice(0, 1))).toBeNull();
    expect(cleanCorners([...CORNERS, { id: 'e', label: 'Fifth' }])).toBeNull();
    expect(cleanCorners('nope')).toBeNull();
    expect(cleanCorners([{ id: 'a', label: 'One' }, { id: 'a', label: 'Two' }])).toBeNull();
    expect(cleanCorners([{ id: 'a', label: 'One' }, { id: 'has space', label: 'Two' }])).toBeNull();
    expect(cleanCorners([{ id: 'a', label: 'One' }, { id: '__proto__', label: 'Two' }])).toBeNull();
    expect(cleanCorners([{ id: 'a', label: 'One' }, { id: 'b', label: '   ' }])).toBeNull();
    expect(cleanCorners([{ id: 'a', label: 'One' }, { id: 'b', label: 'x'.repeat(61) }])).toBeNull();
    expect(cleanCorners([{ id: 'a', label: 'One' }, null])).toBeNull();
    expect(cleanCorners([{ id: 'a', label: 'One' }, { id: 'b', label: 5 }])).toBeNull();
  });

  it('starts a round only from a usable statement and corners', () => {
    expect(started()).toMatchObject({ statement: 'Mornings are best.', picks: {}, open: true, speaking: null });
    expect(createCorners('', CORNERS)).toBeNull();
    expect(createCorners('x'.repeat(201), CORNERS)).toBeNull();
    expect(createCorners('Fine', [])).toBeNull();
  });

  it('counts each corner, the shares and the leader; a pick for a corner that is not there counts nowhere', () => {
    const empty = tallyCorners({ corners: CORNERS, picks: {}, speaking: null });
    expect(empty).toMatchObject({ total: 0, leading: null });
    expect(empty.corners.every((c) => c.count === 0 && c.share === 0)).toBe(true);
    const t = tallyCorners({ corners: CORNERS, picks: { p1: 'a', p2: 'b', p3: 'b', p4: 'zzz' }, speaking: 'b' });
    expect(t.total).toBe(3);
    expect(t.leading).toBe('b');
    expect(t.corners.map((c) => c.count)).toEqual([1, 2, 0, 0]);
    expect(t.corners[1]).toMatchObject({ share: 2 / 3, speaking: true });
    expect(t.corners[0]?.speaking).toBe(false);
    expect(tallyCorners({ corners: CORNERS, picks: { p1: 'c', p2: 'd' }, speaking: null }).leading).toBe('c'); // level: the first
  });

  describe('the room rule', () => {
    const run = (slice: unknown, action: unknown, who = 'p1', host = false) => cornersActivity(slice, action, ctx(who, host));

    it('lets only the host start, and only with usable corners', () => {
      expect(run(null, { type: 'start', statement: 'S', corners: CORNERS }, 'p1')).toEqual({ refuse: 'not-host' });
      expect(run(null, { type: 'start', statement: 'S', corners: CORNERS }, 'host', true)).toMatchObject({ slice: { open: true } });
      expect(run(null, { type: 'start', statement: 'S', corners: [] }, 'host', true)).toEqual({ refuse: 'bad-action' });
    });

    it('lets a player pick and move, never the host, never a corner that is not there', () => {
      const first = run(started(), { type: 'pick', corner: 'a' }) as { slice: CornersState };
      expect(first.slice.picks).toEqual({ p1: 'a' });
      const moved = run(first.slice, { type: 'pick', corner: 'c' }) as { slice: CornersState };
      expect(moved.slice.picks).toEqual({ p1: 'c' });
      expect(run(started(), { type: 'pick', corner: 'zzz' })).toEqual({ refuse: 'bad-action' });
      expect(run(started(), { type: 'pick', corner: 7 })).toEqual({ refuse: 'bad-action' });
      expect(run(started(), { type: 'pick', corner: 'a' }, 'host', true)).toEqual({ refuse: 'bad-action' });
      expect(run(null, { type: 'pick', corner: 'a' })).toEqual({ refuse: 'wrong-phase' });
      expect(run({ junk: true }, { type: 'pick', corner: 'a' })).toEqual({ refuse: 'wrong-phase' });
    });

    it('stops moving once the host locks it, and lets it move again when unlocked', () => {
      const locked = run(started(), { type: 'lock', on: true }, 'host', true) as { slice: CornersState };
      expect(locked.slice.open).toBe(false);
      expect(run(locked.slice, { type: 'pick', corner: 'a' })).toEqual({ refuse: 'wrong-phase' });
      const open = run(locked.slice, { type: 'lock', on: false }, 'host', true) as { slice: CornersState };
      expect(run(open.slice, { type: 'pick', corner: 'a' })).toMatchObject({ slice: { picks: { p1: 'a' } } });
      expect(run(started(), { type: 'lock', on: 'yes' }, 'host', true)).toEqual({ refuse: 'bad-action' });
      expect(run(started(), { type: 'lock', on: true })).toEqual({ refuse: 'not-host' });
      expect(run(null, { type: 'lock', on: true }, 'host', true)).toEqual({ refuse: 'wrong-phase' });
    });

    it('lets only the host call a corner to defend, or put it down', () => {
      const called = run(started(), { type: 'call', corner: 'b' }, 'host', true) as { slice: CornersState };
      expect(called.slice.speaking).toBe('b');
      expect((run(called.slice, { type: 'call', corner: null }, 'host', true) as { slice: CornersState }).slice.speaking).toBeNull();
      expect(run(started(), { type: 'call', corner: 'zzz' }, 'host', true)).toEqual({ refuse: 'bad-action' });
      expect(run(started(), { type: 'call', corner: 4 }, 'host', true)).toEqual({ refuse: 'bad-action' });
      expect(run(started(), { type: 'call', corner: 'a' })).toEqual({ refuse: 'not-host' });
    });

    it('clears the picks and the speaker, keeping the corners, only for the host', () => {
      const withPicks = { ...started(), picks: { p1: 'a' }, speaking: 'a', open: false };
      expect(run(withPicks, { type: 'clear' }, 'host', true)).toMatchObject({ slice: { picks: {}, speaking: null, open: true, corners: CORNERS } });
      expect(run(withPicks, { type: 'clear' })).toEqual({ refuse: 'not-host' });
    });

    it('refuses what is not the shape of a move', () => {
      for (const action of [null, 'pick', 5, [], {}, { type: 7 }, { type: 'dance' }]) expect(run(started(), action)).toEqual({ refuse: 'bad-action' });
    });
  });

  describe('reading what the room holds', () => {
    const room = (slice: unknown, ids = ['p1', 'p2']) => ({ shared: { [CORNERS_KEY]: slice }, players: ids.map((id) => ({ id, name: id, connected: true })) });

    it('is null before the host starts, or for something that is not a round', () => {
      expect(readCorners(null)).toBeNull();
      expect(readCorners({ shared: {}, players: [] })).toBeNull();
      expect(readCorners(room(5))).toBeNull();
      expect(readCorners(room({ ...started(), picks: 'x' }))).toBeNull();
      expect(readCorners(room({ ...started(), corners: [] }))).toBeNull();
      expect(readCorners(room({ ...started(), statement: '' }))).toBeNull();
    });

    it('drops picks of anyone no longer in the room, and anything off the shape', () => {
      const slice = { ...started(), picks: { p1: 'a', p2: 'zzz', gone: 'b', __proto__x: 'a', [''] : 'a' }, speaking: 'ghost', open: false };
      const read = readCorners(room(slice)) as CornersState;
      expect(read.picks).toEqual({ p1: 'a' });
      expect(read.speaking).toBeNull();
      expect(read.open).toBe(false);
      const hostile = JSON.parse('{"statement":"S","corners":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"picks":{"__proto__":"a","p1":"b"},"open":true,"speaking":"a"}');
      expect(readCorners(room(hostile))?.picks).toEqual({ p1: 'b' });
      expect(Object.getPrototypeOf((readCorners(room(hostile)) as CornersState).picks)).toBe(Object.prototype);
    });
  });
});

describe('DebateCorners', () => {
  const counts = { a: 3, b: 5, c: 1, d: 1 };

  it('names each corner by a letter, a word and a count, and does not show the spread before the viewer picks', () => {
    const { container } = render(<DebateCorners statement="Mornings are best." corners={CORNERS} counts={counts} />);
    expect(container.querySelector('[data-slot="debate-corners"]')?.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getByRole('radiogroup', { name: 'Mornings are best.' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(container.querySelector('[data-slot="debate-corners-count"]')).toBeNull();
    expect(container.querySelector('[data-slot="debate-corners"]')?.getAttribute('data-state')).toBe('choosing');
    expect(['A', 'B', 'C', 'D'].every((l) => screen.getByText(l))).toBe(true);
  });

  it('picks once, then shows the spread and says in words where the viewer is', () => {
    const onPick = vi.fn();
    const { container } = render(<DebateCorners statement="S" corners={CORNERS} counts={counts} onPick={onPick} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Agree a little' }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith('b');
    expect(container.querySelector('[data-slot="debate-corners-status"]')?.textContent).toBe('You are in Agree a little. 5 of 10 are there with you.');
    expect(container.querySelectorAll('[data-slot="debate-corners-count"]')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Agree a little' }).getAttribute('aria-describedby')).toBeTruthy();
    expect(container.querySelector('[data-slot="debate-corners"]')?.getAttribute('data-state')).toBe('picked');
    fireEvent.click(screen.getByRole('radio', { name: 'Agree a little' })); // the same corner again: not a move
    expect(onPick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('radio', { name: 'Disagree strongly' }));
    expect(onPick).toHaveBeenLastCalledWith('d');
  });

  it('is moved from the keyboard alone', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<DebateCorners statement="S" corners={CORNERS} counts={counts} defaultValue="a" onPick={onPick} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Agree strongly' }));
    await user.keyboard('{ArrowDown}');
    expect(onPick).toHaveBeenLastCalledWith('b');
    await user.keyboard('{ArrowDown}');
    expect(onPick).toHaveBeenLastCalledWith('c');
  });

  it('hides the spread until enough have picked, and says so', () => {
    const { container } = render(<DebateCorners statement="S" corners={CORNERS} counts={{ a: 1 }} defaultValue="a" minResponses={8} />);
    expect(container.querySelector('[data-slot="debate-corners-count"]')).toBeNull();
    expect(container.querySelector('[data-slot="debate-corners-status"]')?.textContent).toBe('Thanks. The room shows once 8 people have picked.');
  });

  it('marks the corner being defended with the word, and announces it', () => {
    const { container, rerender } = render(<DebateCorners statement="S" corners={CORNERS} counts={counts} defaultValue="a" />);
    expect(container.querySelector('[data-slot="debate-corners-speaking"]')).toBeNull();
    rerender(<DebateCorners statement="S" corners={CORNERS} counts={counts} defaultValue="a" speaking="c" />);
    expect(container.querySelector('[data-slot="debate-corners-speaking"]')?.textContent).toBe('Defending');
    expect(container.querySelector('[data-speaking]')?.textContent).toContain('Disagree a little');
    expect(container.querySelector('[data-slot="debate-corners-status"]')?.textContent).toContain('Disagree a little is defending its position.');
    expect(container.querySelector('[data-slot="debate-corners-status"]')?.getAttribute('aria-live')).toBe('polite');
  });

  it('cannot be moved once locked, and says it is locked', () => {
    const onPick = vi.fn();
    const { container } = render(<DebateCorners statement="S" corners={CORNERS} counts={counts} defaultValue="a" locked onPick={onPick} />);
    expect(container.querySelector('[data-slot="debate-corners"]')?.getAttribute('data-state')).toBe('locked');
    fireEvent.click(screen.getByRole('radio', { name: 'Disagree strongly' }));
    expect(onPick).not.toHaveBeenCalled();
    expect(container.querySelector('[data-slot="debate-corners-status"]')?.textContent).toContain('The corners are locked.');
  });

  it('follows a controlled value and takes its words from labels', () => {
    const { container } = render(
      <DebateCorners
        statement="S"
        corners={CORNERS}
        counts={{ a: 1, b: 1 }}
        value="b"
        labels={{ count: (n) => `${n} here`, status: ({ corner }) => `Standing in ${corner}`, defending: 'Speaking', locked: 'Shut', speaking: (c) => `${c} speaks` }}
        speaking="a"
        locked
      />,
    );
    expect(container.querySelector('[data-slot="debate-corners-status"]')?.textContent).toBe('Standing in Agree a little Agree strongly speaks Shut');
    expect(container.querySelector('[data-slot="debate-corners-count"]')?.textContent).toBe('1 here');
    expect(container.querySelector('[data-slot="debate-corners-speaking"]')?.textContent).toBe('Speaking');
  });

  it('draws bars that need no motion', () => {
    const { container } = render(<DebateCorners statement="S" corners={CORNERS} counts={{ a: 0, b: 0 }} defaultValue="a" />);
    // Nobody has a count: nothing divides by zero.
    const bar = container.querySelector('[data-slot="debate-corners-bar"]') as HTMLElement | null;
    expect(bar?.style.inlineSize ?? '0%').toMatch(/^0/);
  });
});
