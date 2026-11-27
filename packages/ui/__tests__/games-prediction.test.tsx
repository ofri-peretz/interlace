/**
 * Prediction: calling an outcome before it happens, and what the room
 * called once it is settled.
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

const { predictionPoints, settlePredictions } = await import('../src/games/prediction-model.js');
const { Prediction, MIN_VIEWPORT } = await import('../src/games/prediction.js');

afterEach(() => {
  cleanup();
  reduced.value = false;
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

const IDS = ['a', 'b', 'c'];
const OPTIONS = [
  { id: 'a', label: 'Team A' },
  { id: 'b', label: 'Team B' },
  { id: 'c', label: 'A tie' },
];

describe('prediction-model', () => {
  it('counts calls, drops unknown options and pays whoever called it', () => {
    const r = settlePredictions({ ann: 'a', bo: 'b', cy: 'a', dee: 'zzz' }, IDS, 'a');
    expect(r.counts).toEqual({ a: 2, b: 1, c: 0 });
    expect(r.total).toBe(3);
    expect(r.outcome).toBe('a');
    expect(r.winners).toEqual(['ann', 'cy']);
    expect(r.share).toBeCloseTo(2 / 3);
    expect(r.points).toEqual({ ann: 500, bo: 0, cy: 500 });
  });

  it('pays nobody when the outcome is not an option, or not in yet', () => {
    for (const outcome of [null, undefined, 'zzz']) {
      const r = settlePredictions({ ann: 'a' }, IDS, outcome);
      expect(r.outcome).toBeNull();
      expect(r.winners).toEqual([]);
      expect(r.points).toEqual({ ann: 0 });
    }
    expect(settlePredictions({}, IDS, 'a')).toMatchObject({ total: 0, share: 0, winners: [] });
  });

  it('gives the same result whatever order the calls arrive in', () => {
    const one = settlePredictions({ zed: 'b', ann: 'b', mo: 'c' }, IDS, 'b');
    const two = settlePredictions({ mo: 'c', ann: 'b', zed: 'b' }, IDS, 'b');
    expect(one).toEqual(two);
    expect(one.winners).toEqual(['ann', 'zed']);
  });

  it('pays a rare right call more when the reward is bold', () => {
    expect(predictionPoints(0.5)).toBe(500);
    expect(predictionPoints(1, { reward: 'bold' })).toBe(500);
    expect(predictionPoints(0, { reward: 'bold' })).toBe(1000);
    expect(predictionPoints(0.25, { reward: 'bold', points: 100 })).toBe(175);
    expect(predictionPoints(Number.NaN, { reward: 'bold' })).toBe(500);
    expect(predictionPoints(-1, { reward: 'bold' })).toBe(1000);
    expect(predictionPoints(0.5, { points: -5 })).toBe(0);
    const r = settlePredictions({ ann: 'c', bo: 'a', cy: 'a', dee: 'a' }, IDS, 'c', { reward: 'bold' });
    expect(r.points.ann).toBe(875);
  });
});

describe('Prediction', () => {
  it('locks in one call, once, and then waits', () => {
    const onLock = vi.fn();
    const { container } = render(<Prediction question="Who wins the next round?" options={OPTIONS} onLock={onLock} />);
    const root = container.querySelector('[data-slot="prediction"]') as HTMLElement;
    expect(root.dataset.state).toBe('choosing');
    expect(root.dataset.minViewport).toBe(String(MIN_VIEWPORT));
    const lock = screen.getByRole('button', { name: 'Lock it in' }) as HTMLButtonElement;
    expect(lock.disabled).toBe(true);
    expect(screen.getByRole('radiogroup', { name: 'Who wins the next round?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Team B' }));
    fireEvent.click(lock);
    expect(onLock).toHaveBeenCalledWith('b');
    expect(root.dataset.state).toBe('locked');
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('Locked in: Team B. Waiting for the result.')).toBeTruthy();
    // The room's spread stays hidden until the outcome.
    expect(container.querySelector('[data-slot="prediction-spread"]')).toBeNull();
  });

  it('presses the chosen option when motion is allowed, and not when reduced', () => {
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    const { unmount } = render(<Prediction question="Q" options={OPTIONS} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Team A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock it in' }));
    expect(animate).toHaveBeenCalledTimes(1);
    unmount();
    animate.mockClear();
    reduced.value = true;
    render(<Prediction question="Q" options={OPTIONS} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Team A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock it in' }));
    expect(animate).not.toHaveBeenCalled();
  });

  it('says so when calls close before the viewer made one', () => {
    const { container } = render(<Prediction question="Q" options={OPTIONS} closed />);
    expect((container.querySelector('[data-slot="prediction"]') as HTMLElement).dataset.state).toBe('closed');
    expect(screen.getByText('Calls are closed.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('settles a right call with points, the spread and focus on the sentence', () => {
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    const { container, rerender } = render(
      <Prediction question="Q" options={OPTIONS} defaultValue="c" counts={{ a: 3, b: 0, c: 0 }} reward="bold" />,
    );
    rerender(
      <Prediction
        question="Q"
        options={OPTIONS}
        defaultValue="c"
        counts={{ a: 3, b: 0, c: 0 }}
        reward="bold"
        outcome="c"
      />,
    );
    const root = container.querySelector('[data-slot="prediction"]') as HTMLElement;
    expect(root.dataset.state).toBe('settled');
    const result = container.querySelector('[data-slot="prediction-result"]') as HTMLElement;
    // One of four called it: 500 × (2 − 0.25).
    expect(result.textContent).toBe('You called it. +875 points.');
    expect(result.dataset.right).toBe('');
    expect(document.activeElement).toBe(result);
    const spread = screen.getByRole('region', { name: 'How the room called it' });
    expect(spread.textContent).toContain('Outcome');
    expect(spread.textContent).toContain('Your answer');
    expect(animate).toHaveBeenCalled();
  });

  it('names the outcome for a wrong call, and for no call', () => {
    const { container, rerender } = render(
      <Prediction question="Q" options={OPTIONS} value="a" counts={{ a: 1 }} countsIncludeOwn outcome="b" />,
    );
    expect(container.querySelector('[data-slot="prediction-result"]')?.textContent).toBe(
      'Not this time. It was Team B.',
    );
    rerender(<Prediction question="Q" options={OPTIONS} value={null} outcome="b" />);
    expect(container.querySelector('[data-slot="prediction-result"]')?.textContent).toBe('It was Team B.');
  });

  it('draws an outcome already set on mount in place, without moving focus', () => {
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    const { container } = render(<Prediction question="Q" options={OPTIONS} value="a" outcome="a" />);
    expect(container.querySelector('[data-slot="prediction-result"]')?.textContent).toBe('You called it. +500 points.');
    expect(document.activeElement).toBe(document.body);
    expect(animate.mock.calls.filter(([k]) => JSON.stringify(k).includes('translateY'))).toHaveLength(0);
  });

  it('ignores an outcome or a call that is not an option', () => {
    const { container } = render(<Prediction question="Q" options={OPTIONS} value="zzz" outcome="nope" />);
    expect((container.querySelector('[data-slot="prediction"]') as HTMLElement).dataset.state).toBe('choosing');
  });

  it('leaves focus where the viewer put it elsewhere on the page, and skips motion when reduced', () => {
    reduced.value = true;
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    const { rerender } = render(
      <>
        <button type="button">Elsewhere</button>
        <Prediction question="Q" options={OPTIONS} value="a" />
      </>,
    );
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    rerender(
      <>
        <button type="button">Elsewhere</button>
        <Prediction question="Q" options={OPTIONS} value="a" outcome="a" labels={{ called: (p) => `Yes, ${p}` }} />
      </>,
    );
    expect(document.activeElement).toBe(elsewhere);
    expect(screen.getByText('Yes, 500')).toBeTruthy();
    expect(animate).not.toHaveBeenCalled();
  });
});
