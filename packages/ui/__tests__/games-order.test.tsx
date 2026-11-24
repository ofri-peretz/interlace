/**
 * Order game: the deal and score a server can repeat, and the moves a
 * player makes with buttons, keys and the pointer.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { dealOrder, moveItem, scoreOrder } from '../src/games/order-model.js';
import { OrderGame, MIN_VIEWPORT } from '../src/games/order-game.js';

afterEach(cleanup);

// jsdom has no PointerEvent; a MouseEvent with a pointerId is enough here.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventShim;
}

describe('order-model', () => {
  it('scores places and pairs', () => {
    const right = ['a', 'b', 'c', 'd'];
    expect(scoreOrder(right, right)).toMatchObject({ inPlace: 4, pairs: 1, points: 100, perfect: true });
    // One item moved from the end to the front: no item in place, most pairs still right.
    const r = scoreOrder(['d', 'a', 'b', 'c'], right);
    expect(r.inPlace).toBe(0);
    expect(r.places).toEqual([false, false, false, false]);
    expect(r.pairs).toBe(0.5);
    expect(r.points).toBe(50);
    expect(scoreOrder(['d', 'c', 'b', 'a'], right, { maxPoints: 10 }).points).toBe(0);
    expect(scoreOrder(['a'], ['a']).pairs).toBe(1);
  });

  it('refuses orders that are not the same items', () => {
    expect(() => scoreOrder(['a', 'b'], ['a', 'c'])).toThrow(RangeError);
    expect(() => scoreOrder(['a'], ['a', 'b'])).toThrow(RangeError);
    expect(() => scoreOrder(['a', 'a'], ['a', 'a'])).toThrow(RangeError);
  });

  it('deals the same order for the same seed, never already solved', () => {
    const right = ['a', 'b', 'c', 'd', 'e'];
    expect(dealOrder(right, 'day-1')).toEqual(dealOrder(right, 'day-1'));
    expect([...dealOrder(right, 7)].sort()).toEqual(right);
    for (let s = 0; s < 40; s++) expect(dealOrder(['a', 'b'], s)).toEqual(['b', 'a']);
    expect(dealOrder(['a'], 1)).toEqual(['a']);
  });

  it('moves an item and clamps', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, -5)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b'], 9, 0)).toEqual(['a', 'b']);
  });
});

const ITEMS = [
  { id: 'a', label: 'First', value: 1900 },
  { id: 'b', label: 'Second', value: 1950 },
  { id: 'c', label: <i>Third</i>, text: 'Third', value: 2000 },
];

const names = () => within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.getAttribute('data-id'));

describe('OrderGame', () => {
  it('deals, moves with buttons and keys, announces, then reveals', () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <OrderGame question="Oldest first" items={ITEMS} seed="s" ends={['Earliest', 'Latest']} onSubmit={onSubmit} explanation="Dates." />,
    );
    expect(container.firstElementChild?.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getByRole('list', { name: 'Oldest first' })).toBeTruthy();
    expect(screen.getByText('Earliest')).toBeTruthy();
    const start = names();
    expect(start).not.toEqual(['a', 'b', 'c']);

    // Put "First" at the top with Home on its handle.
    const handle = screen.getByRole('button', { name: 'Reorder First' });
    handle.focus();
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(names()[0]).toBe('a');
    expect(screen.getByText('First, place 1 of 3')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reorder First' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder First' }), { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder First' }), { key: 'x' });
    expect(names()[0]).toBe('a');

    // Make sure "Third" ends last using its buttons; the disabled one is skipped.
    const third = () => screen.getByRole('button', { name: 'Move Third down' }) as HTMLButtonElement;
    if (!third().disabled) {
      third().focus();
      fireEvent.click(third());
      expect(document.activeElement?.getAttribute('data-control')).toBe('handle');
    }
    expect(names()).toEqual(['a', 'b', 'c']);
    fireEvent.click(screen.getByRole('button', { name: 'Move Second up' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Second' }), { key: 'End' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Third' }), { key: 'ArrowDown' });

    const lock = screen.getByRole('button', { name: 'Lock in' });
    lock.focus();
    fireEvent.click(lock);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const result = onSubmit.mock.calls[0]?.[0];
    expect(screen.getByText(new RegExp(`${result.inPlace} of 3 in the right place|All 3 in the right place`))).toBeTruthy();
    expect(names()).toEqual(['a', 'b', 'c']);
    expect(screen.getByText('1900')).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-slot')).toBe('order-game-result');
    expect(screen.queryByRole('button', { name: 'Lock in' })).toBeNull();
  });

  it('restores a stored round and words each place', () => {
    const stored = scoreOrder(['b', 'a', 'c'], ['a', 'b', 'c']);
    render(<OrderGame question="Q" items={ITEMS} defaultResult={stored} labels={{ right: 'Yes' }} />);
    expect(screen.getByText('You had it 2nd')).toBeTruthy();
    expect(screen.getByText('You had it 1st')).toBeTruthy();
    expect(screen.getByText('Yes')).toBeTruthy();
    expect(screen.getByText('1 of 3 in the right place. 67 points.')).toBeTruthy();
  });

  it('controlled: the parent keeps the result; a perfect round says so', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<OrderGame question="Q" items={ITEMS.slice(0, 2)} result={null} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    rerender(<OrderGame question="Q" items={ITEMS.slice(0, 2)} result={scoreOrder(['a', 'b'], ['a', 'b'])} />);
    expect(screen.getByText('All 2 in the right place. 100 points.')).toBeTruthy();
    rerender(<OrderGame question="Q" items={ITEMS.slice(0, 2)} result={null} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('drags a row by its handle past a neighbour', () => {
    const animate = vi.fn();
    const orig = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = animate as unknown as typeof orig;
    render(<OrderGame question="Q" items={ITEMS} seed="s" />);
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    // jsdom has no layout: give each row a top and a height.
    rows.forEach((row, i) => {
      Object.defineProperty(row, 'offsetHeight', { configurable: true, value: 40 });
      Object.defineProperty(row, 'offsetTop', { configurable: true, get: () => names().indexOf(row.getAttribute('data-id')) * 48 });
    });
    const firstId = names()[0] as string;
    const handle = within(rows[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement;
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 10 });
    expect((rows[0] as HTMLElement).getAttribute('data-dragging')).toBe('');
    fireEvent.pointerMove(handle, { pointerId: 2, clientY: 200 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 20 });
    expect(names()[0]).toBe(firstId);
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 70 });
    expect(names()[1]).toBe(firstId);
    fireEvent.pointerUp(handle, { pointerId: 2 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(screen.getByText(new RegExp(`place 2 of 3`))).toBeTruthy();
    fireEvent.pointerDown(handle, { pointerId: 3, button: 2, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 3, clientY: 90 });
    expect(names()[1]).toBe(firstId);
    HTMLElement.prototype.animate = orig;
  });
});
