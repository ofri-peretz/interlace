/**
 * RecallCard locks: the answer stays inert until revealed, reveal moves
 * focus to it, ratings appear only after the reveal and say the pick in
 * words, the controlled props win, and the no-JS fallback holds the answer.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RecallCard } from '../src/games/recall-card.js';

afterEach(cleanup);

const card = (props: Partial<React.ComponentProps<typeof RecallCard>> = {}) => (
  <RecallCard
    prompt="What does a lighthouse keeper do in fog?"
    answer={<a href="#s">Sounds the fog signal at a fixed interval.</a>}
    {...props}
  />
);

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement | null;

describe('RecallCard', () => {
  it('keeps the answer inert and the ratings out until the reveal', () => {
    render(card());
    expect(slot('recall-card-answer')!.hasAttribute('inert')).toBe(true);
    expect(slot('recall-card-ratings')).toBeNull();
    expect(slot('recall-card')!.dataset.state).toBe('asking');
    const reveal = screen.getByRole('button', { name: 'Show the answer' });
    expect(reveal.getAttribute('aria-expanded')).toBe('false');
    expect(reveal.getAttribute('aria-controls')).toBe(
      screen.getByRole('region', { hidden: true, name: 'The answer' }).id,
    );
  });

  it('reveal opens the answer, moves focus to it and calls onReveal once', () => {
    const onReveal = vi.fn();
    render(card({ onReveal }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Show the answer' })));
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(slot('recall-card-answer')!.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'The answer' }));
    expect(screen.queryByRole('button', { name: 'Show the answer' })).toBeNull();
    expect(slot('recall-card')!.dataset.state).toBe('revealed');
  });

  it('rates in a labelled group, marks the pick pressed and says it in words', () => {
    const onRate = vi.fn();
    render(card({ defaultRevealed: true, onRate }));
    const group = screen.getByRole('group', { name: 'How did you do?' });
    expect(group.querySelectorAll('button')).toHaveLength(2);
    act(() => fireEvent.click(screen.getByRole('button', { name: /Not yet/ })));
    expect(onRate).toHaveBeenCalledWith('not-yet');
    expect(screen.getByRole('button', { name: /Not yet/ }).getAttribute('aria-pressed')).toBe('true');
    expect(slot('recall-card-status')!.textContent).toBe('Marked to come back to.');
    expect(slot('recall-card')!.dataset.state).toBe('rated');
    // The same pick again changes nothing.
    act(() => fireEvent.click(screen.getByRole('button', { name: /Not yet/ })));
    expect(onRate).toHaveBeenCalledTimes(1);
    // A changed mind is allowed.
    act(() => fireEvent.click(screen.getByRole('button', { name: /I had it/ })));
    expect(onRate).toHaveBeenLastCalledWith('had-it');
  });

  it('follows controlled props and takes custom ratings and labels', () => {
    const { rerender } = render(
      card({
        revealed: false,
        ratings: [
          { id: 'easy', label: 'Easy' },
          { id: 'hard', label: 'Hard' },
          { id: 'again', label: 'Again' },
        ],
        labels: { reveal: 'Check', rate: 'How was it?' },
      }),
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Check' })));
    // Controlled and not flipped by the parent: still closed.
    expect(slot('recall-card-answer')!.hasAttribute('inert')).toBe(true);
    rerender(
      card({
        revealed: true,
        rating: 'hard',
        ratings: [
          { id: 'easy', label: 'Easy' },
          { id: 'hard', label: 'Hard' },
          { id: 'again', label: 'Again' },
        ],
        labels: { reveal: 'Check', rate: 'How was it?' },
      }),
    );
    expect(screen.getByRole('group', { name: 'How was it?' }).querySelectorAll('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Hard/ }).getAttribute('aria-pressed')).toBe('true');
    expect(slot('recall-card-status')!.textContent).toBe('Hard');
  });

  it('server HTML carries the prompt, the answer and a no-JS details fallback', () => {
    const html = renderToStaticMarkup(card());
    expect(html).toContain('data-slot="recall-card-fallback"');
    expect(html.match(/Sounds the fog signal/g)).toHaveLength(2);
    expect(html).toContain('data-min-viewport="320"');
  });
});
