/**
 * Rating: a scale question, what a room's answers say, and the part people
 * answer on.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// jsdom has no PointerEvent; Base UI's radio makes one on click.
if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { cleanRatings, ratingShift, ratingSteps, summarizeRatings } = await import('../src/games/rating-model.js');
const { Rating, MIN_VIEWPORT } = await import('../src/games/rating.js');

afterEach(() => {
  cleanup();
  reduced.value = false;
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

describe('rating-model', () => {
  it('lists the steps and drops answers off the scale', () => {
    expect(ratingSteps()).toEqual([1, 2, 3, 4, 5]);
    expect(ratingSteps({ min: 0, max: 10 })).toHaveLength(11);
    expect(cleanRatings([1, 2.5, 6, 0, Number.NaN, 5])).toEqual([1, 5]);
  });

  it('counts, averages and finds the middle', () => {
    expect(summarizeRatings([1, 2, 2, 5])).toEqual({
      count: 4,
      counts: [1, 2, 0, 0, 1],
      peak: 2,
      mean: 2.5,
      median: 2,
      recommend: null,
    });
    expect(summarizeRatings([3]).median).toBe(3);
    expect(summarizeRatings([])).toEqual({
      count: 0,
      counts: [0, 0, 0, 0, 0],
      peak: 0,
      mean: null,
      median: null,
      recommend: null,
    });
  });

  it('gives a recommend score on a 0 to 10 scale', () => {
    // 3 at 9 to 10, 1 at 7 to 8, 2 at 0 to 6: (3 - 2) / 6.
    expect(summarizeRatings([10, 9, 9, 8, 6, 0], { min: 0, max: 10 }).recommend).toBe(17);
  });

  it('says how far the average moved', () => {
    expect(ratingShift([1, 2], [4, 5])).toBe(3);
    expect(ratingShift([], [4])).toBeNull();
    expect(ratingShift([4], [])).toBeNull();
  });

  it('holds up with a room of 60, answers repeated, and junk mixed in', () => {
    const room = Array.from({ length: 60 }, (_, i) => (i % 5) + 1);
    expect(summarizeRatings([...room, 99, -1, 2.2]).count).toBe(60);
    expect(summarizeRatings([...room].reverse())).toEqual(summarizeRatings(room));
  });
});

describe('Rating', () => {
  it('picks a step with the keyboard, sends once, and reads the room in one sentence', () => {
    const onRate = vi.fn();
    const animate = vi.fn(() => ({ cancel: () => undefined }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const { container } = render(
      <Rating question="How familiar is this?" ends={['Not at all', 'Very']} values={[2, 4, 4]} onRate={onRate} />,
    );
    expect(container.querySelector('[data-slot="rating"]')?.getAttribute('data-min-viewport')).toBe(
      String(MIN_VIEWPORT),
    );
    expect(screen.getByRole('radiogroup', { name: 'How familiar is this?' })).toBeTruthy();
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(send);
    expect(onRate).toHaveBeenCalledWith(4);
    const result = container.querySelector('[data-slot="rating-result"]');
    expect(result?.textContent).toBe("4 people answered. Yours: 4. The room's average: 3.5.");
    expect(document.activeElement).toBe(result);
    expect(container.querySelector('[data-mine]')).toBeTruthy();
    expect(animate).toHaveBeenCalled();
    expect(screen.getByText('Very')).toBeTruthy();
  });

  it('shows faces with names, a before round and the recommend score', () => {
    const icon = <svg aria-hidden />;
    const faces = [
      { icon, name: 'Low' },
      { icon, name: 'Okay' },
      { icon, name: 'Good' },
    ];
    const { container, rerender } = render(
      <Rating question="Mood?" min={1} max={3} faces={faces} values={[3, 3]} before={[1, 2]} defaultValue={2} />,
    );
    expect(container.querySelector('[data-slot="rating-result"]')?.textContent).toBe(
      "3 people answered. Yours: Okay. The room's average: Good. Before: Okay.",
    );
    expect(container.querySelectorAll('[data-slot="rating-before"]')).toHaveLength(3);
    rerender(<Rating question="Recommend?" min={0} max={10} value={9} values={[10, 3]} valuesIncludeOwn />);
    expect(container.querySelector('[data-slot="rating-result"]')?.textContent).toContain('Recommend score: 0.');
  });

  it('keeps the room private until enough have answered, and stays still under reduced motion', () => {
    reduced.value = true;
    const animate = vi.fn(() => ({ cancel: () => undefined }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const { container } = render(<Rating question="Q" values={[3]} minResponses={5} labels={{ send: 'Go' }} />);
    fireEvent.click(screen.getByRole('radio', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(container.querySelector('[data-slot="rating-chart"]')).toBeNull();
    expect(screen.getByText('Thanks. The room shows once 5 people have answered.')).toBeTruthy();
    expect(animate).not.toHaveBeenCalled();
  });

  it('is controlled when value is passed', () => {
    const onRate = vi.fn();
    const { container } = render(<Rating question="Q" value={null} onRate={onRate} />);
    fireEvent.click(screen.getByRole('radio', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onRate).toHaveBeenCalledWith(5);
    // Still choosing until the parent passes the value back.
    expect(container.querySelector('[data-state="choosing"]')).toBeTruthy();
  });
});
