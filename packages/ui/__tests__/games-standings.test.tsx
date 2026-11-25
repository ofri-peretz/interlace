import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Standings } from '../src/games/standings.js';

// Blake overtakes Avery this round; Casey stays third.
const ROUND = [
  { id: 'a', name: 'Avery', score: 1500, gained: 0 },
  { id: 'b', name: 'Blake', score: 1900, gained: 900 },
  { id: 'c', name: 'Casey', score: 800, gained: 300 },
];

const names = (c: HTMLElement) =>
  [...c.querySelectorAll('[data-slot="standings-name"]')].map((n) => n.textContent?.replace('You', '').trim());

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Standings', () => {
  it('starts in the old order, then takes the new one after the count', () => {
    vi.useFakeTimers();
    const { container } = render(<Standings caption="After round 2" entries={ROUND} countMs={900} locale="en-US" />);
    const root = container.querySelector('[data-slot="standings"]')!;
    expect(root.getAttribute('data-phase')).toBe('before');
    expect(names(container)).toEqual(['Avery', 'Blake', 'Casey']);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(root.getAttribute('data-phase')).toBe('after');
    expect(names(container)).toEqual(['Blake', 'Avery', 'Casey']);
    const blake = container.querySelector('[data-flip-id="b"]')!;
    expect(blake.getAttribute('data-moved')).toBe('up');
    expect(blake.textContent).toContain('up 1 place');
    expect(blake.textContent).toContain('900 points this round');
    expect(container.querySelector('[data-flip-id="a"]')!.textContent).toContain('down 1 place');
  });

  it('is in its final order at once without motion, and names itself', () => {
    const { container, getByRole } = render(
      <Standings caption="Standings" showCaption={false} entries={ROUND} animate={false} currentId="c" />,
    );
    expect(getByRole('region', { name: 'Standings' })).toBeTruthy();
    expect(names(container)).toEqual(['Blake', 'Avery', 'Casey']);
    expect(container.querySelector('[data-current]')!.getAttribute('data-flip-id')).toBe('c');
    expect(container.querySelector('[data-flip-id="b"] [data-slot="standings-score"]')!.textContent).toContain('1,900');
  });

  it('keeps the viewer below the limit, and shares a place on a tie', () => {
    const many = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, score: 1000 - i * 10 })),
      { id: 'me', name: 'Me', score: 10 },
      { id: 'tie', name: 'Tie', score: 1000 },
    ];
    const { container } = render(
      <Standings caption="Standings" entries={many} animate={false} limit={3} currentId="me" />,
    );
    expect(names(container)).toEqual(['P0', 'Tie', 'P1', 'Me']);
    expect(container.querySelector('[data-flip-id="tie"] [data-slot="standings-rank"]')!.textContent).toBe('=1');
  });
});
