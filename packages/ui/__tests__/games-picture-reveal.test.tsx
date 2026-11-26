/**
 * PictureReveal: a seeded, spread order; tiles off by step; points that
 * favour an early guess; clues for screen readers; no alt until the reveal.
 */
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { guessPoints, revealOrder, tilesAt } from '../src/games/picture-reveal-model.js';
import { MIN_VIEWPORT, PictureReveal } from '../src/games/picture-reveal.js';

afterEach(cleanup);

describe('picture-reveal-model', () => {
  it('orders every tile once, the same for the same seed', () => {
    const a = revealOrder(12, 'round-3');
    expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect(revealOrder(12, 'round-3')).toEqual(a);
    expect(revealOrder(12, 'round-4')).not.toEqual(a);
    expect(revealOrder(-2, 1)).toEqual([]);
  });

  it('spreads tiles over the steps, all at the last', () => {
    expect([0, 1, 2, 4, 8, 9].map((s) => tilesAt(s, 8, 12))).toEqual([0, 2, 3, 6, 12, 12]);
    expect(tilesAt(-1, 8, 12)).toBe(0);
    expect(tilesAt(1, 0, 4)).toBe(4);
  });

  it('pays an early guess more, down to the floor', () => {
    expect(guessPoints(0, 8)).toBe(1000);
    expect(guessPoints(4, 8)).toBe(600);
    expect(guessPoints(8, 8)).toBe(200);
    expect(guessPoints(12, 8, { max: 100, floor: 0.5 })).toBe(50);
    expect(guessPoints(1, 1, { floor: 2 })).toBe(1000);
  });
});

const tilesOff = (c: HTMLElement) => c.querySelectorAll('[data-slot="picture-reveal-tiles"] [data-off]').length;

describe('PictureReveal', () => {
  it('hides the answer until the reveal and keeps clues in step', () => {
    const clues = ['It is outdoors.', 'It is very old.', 'It is made of stone.'];
    const props = { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'A stone bridge', seed: 'r1', clues };
    const { container, rerender } = render(<PictureReveal {...props} step={0} steps={4} />);
    const root = container.querySelector('[data-slot="picture-reveal"]') as HTMLElement;
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(root.getAttribute('data-state')).toBe('hidden');
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(tilesOff(container)).toBe(0);
    expect(container.querySelector('[data-slot="picture-reveal-status"]')?.textContent).toBe('');

    rerender(<PictureReveal {...props} step={2} steps={4} />);
    expect(root.getAttribute('data-state')).toBe('revealing');
    expect(tilesOff(container)).toBe(6);
    expect(screen.getByRole('list', { name: 'Clues' }).textContent).toBe('1.It is outdoors.2.It is very old.');
    expect(container.querySelector('[data-slot="picture-reveal-status"]')?.textContent).toBe(
      '6 of 12 tiles off. Clue: It is very old.',
    );
    // Tiles leaving together are staggered.
    const delays = [...container.querySelectorAll<HTMLElement>('[data-off]')].map((t) => t.style.transitionDelay);
    expect(delays.filter(Boolean).length).toBeGreaterThan(0);
    expect(screen.queryByText('A stone bridge')).toBeNull();

    rerender(<PictureReveal {...props} step={2} steps={4} revealed answer="The old bridge" />);
    expect(root.getAttribute('data-state')).toBe('revealed');
    expect(tilesOff(container)).toBe(12);
    expect(screen.getByRole('img', { name: 'A stone bridge' })).toBeTruthy();
    expect(screen.getByText('The old bridge')).toBeTruthy();
    expect(screen.getByRole('list').textContent).toContain('It is made of stone.');
    expect(container.querySelector('[data-slot="picture-reveal-status"]')?.textContent).toBe(
      'The answer: A stone bridge',
    );
  });

  it('takes labels, a grid size and no clues', () => {
    const { container } = render(
      <PictureReveal
        src="x.png"
        alt="A lighthouse"
        seed={7}
        step={1}
        steps={2}
        cols={2}
        rows={2}
        size="stage"
        labels={{ status: (o, t) => `${o}/${t}` }}
      />,
    );
    expect(container.querySelectorAll('[data-slot="picture-reveal-tiles"] span')).toHaveLength(4);
    expect(container.querySelector('[data-slot="picture-reveal-clues"]')).toBeNull();
    expect(container.querySelector('[data-slot="picture-reveal-status"]')?.textContent).toBe('2/4');
    expect((container.querySelector('[data-slot="picture-reveal-frame"]') as HTMLElement).style.aspectRatio).toBe(
      '2 / 2',
    );
  });
});
