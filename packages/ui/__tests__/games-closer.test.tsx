/**
 * Closer: the scoring a server can repeat, and the game a player sees.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fromPosition, scoreGuess, snap, toPosition } from '../src/games/closer-model.js';
import { CloserGame, MIN_VIEWPORT } from '../src/games/closer-game.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const R = { min: 0, max: 1000, step: 10 };

describe('closer-model', () => {
  it('maps values to positions and back, linear and log', () => {
    expect(toPosition(250, R)).toBe(0.25);
    expect(toPosition(-5, R)).toBe(0);
    expect(fromPosition(0.257, R)).toBe(260);
    const log = { min: 1, max: 1_000_000, scale: 'log' as const };
    expect(toPosition(1000, log)).toBeCloseTo(0.5);
    expect(toPosition(0, log)).toBe(0);
    expect(fromPosition(0.5, log)).toBe(1000);
    expect(fromPosition(2, log)).toBe(1_000_000);
  });

  it('snaps to the step and cleans float tails', () => {
    expect(snap(0.30000000000000004, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
    expect(snap(12.345, { min: 0, max: 100, step: 0 })).toBe(12.35);
    expect(snap(5000, R)).toBe(1000);
  });

  it('rejects ranges it cannot score', () => {
    expect(() => toPosition(1, { min: 5, max: 5 })).toThrow(RangeError);
    expect(() => fromPosition(1, { min: 0, max: 10, scale: 'log' })).toThrow(RangeError);
  });

  it('scores by share of the range, in bands', () => {
    expect(scoreGuess(500, 500, R)).toMatchObject({ band: 'exact', points: 100, direction: 'exact', error: 0 });
    expect(scoreGuess(504, 500, R).band).toBe('exact'); // within half a step
    expect(scoreGuess(450, 500, R)).toMatchObject({ band: 'close', points: 90, direction: 'higher', distance: 50 });
    expect(scoreGuess(600, 500, R)).toMatchObject({ band: 'near', points: 80, direction: 'lower' });
    expect(scoreGuess(0, 900, R)).toMatchObject({ band: 'far', points: 0 });
    expect(scoreGuess(0, 900, R, { zeroAt: 1, maxPoints: 10 }).points).toBe(1);
    expect(scoreGuess(450, 500, R, { tolerance: 50 }).band).toBe('exact');
    expect(scoreGuess(450, 500, R, { bands: { close: 0.01, near: 0.02 } }).band).toBe('far');
    expect(scoreGuess(450, 500, { min: 0, max: 1000 }).band).toBe('close');
  });

  it('scores log ranges by ratio', () => {
    const log = { min: 1, max: 1_000_000, scale: 'log' as const };
    expect(scoreGuess(900, 1000, log).error).toBeCloseTo(scoreGuess(900_000, 1_000_000, log).error);
  });
});

describe('CloserGame', () => {
  it('locks in a slider value, scores it once and reveals the answer', () => {
    const onGuess = vi.fn();
    const { container } = render(
      <CloserGame
        question="How many steps?"
        answer={500}
        range={R}
        defaultValue={450}
        onGuess={onGuess}
        explanation="Counted in 2025."
        locale="en-US"
      />,
    );
    const root = container.querySelector('[data-slot="closer-game"]')!;
    expect(root.getAttribute('data-state')).toBe('guessing');
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('450');
    expect(container.querySelector('[data-slot="closer-game-explanation"]')!.hasAttribute('inert')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    expect(onGuess).toHaveBeenCalledTimes(1);
    expect(onGuess.mock.calls[0]![0]).toMatchObject({ guess: 450, band: 'close', points: 90 });
    expect(root.getAttribute('data-state')).toBe('revealed');
    expect(root.getAttribute('data-band')).toBe('close');
    expect(screen.getByText('You said 450. The answer is 500, 50 off. Close. 90 points.')).toBeTruthy();
    expect(container.querySelector('[data-slot="closer-game-answer"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="closer-game-form"]')).toBeNull();
    expect(container.querySelector('[data-slot="closer-game-explanation"]')!.hasAttribute('inert')).toBe(false);
  });

  it('takes a typed value, snapped and clamped, and ignores junk', () => {
    const onGuess = vi.fn();
    render(<CloserGame question="Q" answer={500} range={R} onGuess={onGuess} />);
    const input = screen.getByLabelText('Or type it') as HTMLInputElement;
    expect(input.value).toBe('500');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(input.value).toBe('500');
    fireEvent.change(input, { target: { value: '503' } });
    fireEvent.submit(input.closest('form')!);
    expect(onGuess.mock.calls[0]![0]).toMatchObject({ guess: 500, band: 'exact' });
    expect(screen.getByText('You said 500. The answer is 500. Spot on. 100 points.')).toBeTruthy();
  });

  it('restores a stored guess and stays put when controlled', () => {
    const onGuess = vi.fn();
    const { container, rerender } = render(
      <CloserGame question="Q" answer={500} range={R} guess={null} onGuess={onGuess} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    expect(onGuess).toHaveBeenCalledTimes(1);
    // The parent has not stored it yet: still guessing.
    expect(container.querySelector('[data-slot="closer-game"]')!.getAttribute('data-state')).toBe('guessing');
    rerender(<CloserGame question="Q" answer={500} range={R} guess={800} onGuess={onGuess} />);
    expect(screen.getByText(/You said 800/)).toBeTruthy();
    // Clearing the guess (a replay) opens the door again.
    rerender(<CloserGame question="Q" answer={500} range={R} guess={null} onGuess={onGuess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
    expect(onGuess).toHaveBeenCalledTimes(2);
  });

  it('moves on a log scale and formats with Intl', () => {
    const onGuess = vi.fn();
    render(
      <CloserGame
        question="How many people?"
        answer={1_000_000}
        range={{ min: 1000, max: 100_000_000, scale: 'log' }}
        defaultGuess={null}
        onGuess={onGuess}
        format={{ notation: 'compact' }}
        locale="en-US"
        labels={{
          guess: 'Population',
          submit: 'Go',
          type: 'Exact',
          answer: 'Here',
          band: { near: 'Warm.' },
          result: ({ band, points }) => `${band} ${points}`,
        }}
      />,
    );
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuetext')).toBe('316K');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider.getAttribute('aria-valuetext')).toBe('100M');
    fireEvent.change(screen.getByLabelText('Exact'), { target: { value: '400000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onGuess.mock.calls[0]![0].band).toBe('near');
    expect(screen.getByText(/^Warm\. \d+$/)).toBeTruthy();
    expect(screen.getByText('Here')).toBeTruthy();
  });

  it('animates the reveal unless motion is reduced', () => {
    const animate = vi.fn();
    const original = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = animate as never;
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    try {
      render(<CloserGame question="Q" answer={900} range={R} defaultValue={100} />);
      fireEvent.click(screen.getByRole('button', { name: 'Lock in' }));
      expect(animate).toHaveBeenCalledTimes(2);
    } finally {
      HTMLElement.prototype.animate = original;
    }
  });

  it('renders revealed from the start without animating or a form', () => {
    const { container } = render(<CloserGame question="Q" answer={100} range={R} defaultGuess={900} />);
    expect(container.querySelector('[data-slot="closer-game"]')!.getAttribute('data-band')).toBe('far');
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('900');
  });
});
