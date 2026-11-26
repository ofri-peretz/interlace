/**
 * TextWall: newest first, a cap, a spotlight lifted out of the list, the
 * count, and motion only for what arrives after load.
 */
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

import { MIN_VIEWPORT, TextWall } from '../src/games/text-wall.js';

afterEach(() => {
  cleanup();
  reduced.value = false;
  vi.restoreAllMocks();
});

const posts = [
  { id: 'a', text: 'What do you eat for breakfast?', at: 1 },
  { id: 'b', text: 'Which music do you listen to?', at: 3 },
  { id: 'c', text: 'How do you get to school?', at: 2 },
];

const texts = (c: HTMLElement) => [...c.querySelectorAll('[data-slot="text-wall-post"]')].map((li) => li.textContent);

describe('TextWall', () => {
  it('shows newest first with a count, and declares its viewport', () => {
    const { container } = render(<TextWall posts={posts} locale="en-US" />);
    expect(container.querySelector('[data-slot="text-wall"]')?.getAttribute('data-min-viewport')).toBe(
      String(MIN_VIEWPORT),
    );
    expect(texts(container)).toEqual([
      'Which music do you listen to?',
      'How do you get to school?',
      'What do you eat for breakfast?',
    ]);
    expect(screen.getByText('3 answers')).toBeTruthy();
    expect(screen.getByRole('list')).toBeTruthy();
    // Keyed for the glide when a new post pushes the rest along.
    expect([...container.querySelectorAll('[data-flip-id]')].map((el) => el.getAttribute('data-flip-id'))).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('lifts the spotlight out of the list and caps the rest', () => {
    const { container } = render(<TextWall posts={posts} spotlight="c" max={1} />);
    expect(container.querySelector('[data-slot="text-wall-spotlight"] blockquote')?.textContent).toBe(
      'How do you get to school?',
    );
    expect(texts(container)).toEqual(['Which music do you listen to?']);
    // The count is the whole room, not what fits.
    expect(screen.getByText('3 answers')).toBeTruthy();
  });

  it('ignores a spotlight id that is not on the wall', () => {
    const { container } = render(<TextWall posts={posts} spotlight="gone" />);
    expect(container.querySelector('[data-slot="text-wall-spotlight"]')).toBeNull();
    expect(texts(container)).toHaveLength(3);
  });

  it('says when it is empty and takes labels', () => {
    render(<TextWall posts={[]} labels={{ empty: 'Noch nichts.' }} />);
    expect(screen.getByText('Noch nichts.')).toBeTruthy();
    cleanup();
    render(<TextWall posts={posts.slice(0, 1)} />);
    expect(screen.getByText('1 answer')).toBeTruthy();
    cleanup();
    render(<TextWall posts={posts} labels={{ count: (n, f) => `${f}/${n} Antworten` }} />);
    expect(screen.getByText('3/3 Antworten')).toBeTruthy();
  });

  it('animates only posts that arrive after load', () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const kinds = () =>
      animate.mock.calls
        .map(([frames]) => String((frames as Keyframe[])[0]?.transform))
        .filter((t) => t !== 'undefined');
    const rises = () => kinds().filter((t) => t.startsWith('translateY(12px)')).length;
    const scales = () => kinds().filter((t) => t.startsWith('scale(')).length;
    const { container, rerender } = render(<TextWall posts={posts} />);
    expect(rises() + scales()).toBe(0);
    rerender(<TextWall posts={[...posts, { id: 'd', text: 'Do you have a pet?', at: 4 }]} />);
    expect(rises()).toBe(1);
    expect(texts(container)[0]).toBe('Do you have a pet?');
    // A repeated render with the same posts does not replay it.
    rerender(<TextWall posts={[...posts, { id: 'd', text: 'Do you have a pet?', at: 4 }]} />);
    expect(rises()).toBe(1);
    // Moving a post into the spotlight scales it in.
    rerender(<TextWall posts={[...posts, { id: 'd', text: 'Do you have a pet?', at: 4 }]} spotlight="d" />);
    expect(scales()).toBe(1);
    expect(rises()).toBe(1);
  });

  it('keeps still under reduced motion', () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    reduced.value = true;
    const { rerender } = render(<TextWall posts={posts} />);
    rerender(<TextWall posts={[...posts, { id: 'd', text: 'New', at: 4 }]} spotlight="d" />);
    expect(animate).not.toHaveBeenCalled();
  });

  it('holds a room of 60, capped at 40 by default', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ id: `p${i}`, text: `Post ${i}`, at: i }));
    const { container } = render(<TextWall posts={many} size="stage" />);
    expect(texts(container)).toHaveLength(40);
    expect(texts(container)[0]).toBe('Post 59');
    expect(screen.getByText('60 answers')).toBeTruthy();
  });
});
