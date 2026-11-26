/**
 * Spectrum: the room's spread a server can repeat, and the part a person uses.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { binOf, cleanValues, spectrumShift, summarizeSpectrum } from '../src/games/spectrum-model.js';
import { MIN_VIEWPORT, Spectrum } from '../src/games/spectrum.js';

afterEach(cleanup);

describe('spectrum-model', () => {
  it('bins, finds the middle and the mean', () => {
    const s = summarizeSpectrum([0, 10, 20, 50, 100]);
    expect(s.count).toBe(5);
    expect(s.bins).toEqual([1, 1, 1, 0, 0, 1, 0, 0, 0, 1]);
    expect(s.peak).toBe(1);
    expect(s.median).toBe(20);
    expect(s.mean).toBe(36);
    expect(s.middle).toEqual([10, 50]);
    expect(summarizeSpectrum([25, 75], { bins: 2 }).bins).toEqual([1, 1]);
    expect(summarizeSpectrum([1, 2, 3, 4]).median).toBe(2.5);
  });

  it('cleans junk and handles an empty room', () => {
    expect(cleanValues([-5, 120, Number.NaN, 40])).toEqual([0, 100, 40]);
    expect(summarizeSpectrum([])).toEqual({
      count: 0,
      bins: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      peak: 0,
      mean: null,
      median: null,
      middle: null,
    });
    expect(summarizeSpectrum([5], { bins: 0, min: 5, max: 5 }).bins).toEqual([1]);
  });

  it('measures the shift and finds bins', () => {
    expect(spectrumShift([20, 30, 40], [40, 50, 60])).toBe(20);
    expect(spectrumShift([], [1])).toBeNull();
    expect(spectrumShift([1], [])).toBeNull();
    expect(binOf(0)).toBe(0);
    expect(binOf(100)).toBe(9);
    expect(binOf(55)).toBe(5);
    expect(binOf(-3, { bins: 4 })).toBe(0);
    expect(binOf(7, { bins: 0, min: 7, max: 7 })).toBe(0);
  });
});

describe('Spectrum', () => {
  const poles = ['Not at all', 'Very much'] as const;

  it('places a dot once and shows the room in words', () => {
    const onPlace = vi.fn();
    const { container } = render(
      <Spectrum statement="How much do you agree?" poles={poles} values={[80, 90, 70]} onPlace={onPlace} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(root.getAttribute('data-state')).toBe('placing');
    const thumb = screen.getByRole('slider');
    expect(thumb.getAttribute('aria-valuetext')).toBe('In the middle');
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(thumb.getAttribute('aria-valuetext')).toBe('Closer to Not at all');
    fireEvent.click(screen.getByRole('button', { name: 'Place my dot' }));
    expect(onPlace).toHaveBeenCalledWith(0);
    expect(root.getAttribute('data-state')).toBe('placed');
    expect(screen.queryByRole('slider')).toBeNull();
    expect(
      screen.getByText("4 people placed a dot. Yours: Closer to Not at all. The room's middle: Closer to Very much."),
    ).toBeTruthy();
    const bars = container.querySelectorAll('[data-slot="spectrum-bar"]');
    expect(bars).toHaveLength(10);
    expect(bars[0]?.hasAttribute('data-mine')).toBe(true);
  });

  it('holds the room back below minResponses, and draws the earlier round', () => {
    const { rerender, container } = render(
      <Spectrum statement="S" poles={poles} values={[50]} defaultValue={50} minResponses={5} />,
    );
    expect(screen.getByText('Thanks. The room shows once 5 people have placed a dot.')).toBeTruthy();
    expect(container.querySelector('[data-slot="spectrum-chart"]')).toBeNull();
    rerender(
      <Spectrum statement="S" poles={poles} values={[50, 60, 70]} valuesIncludeOwn value={60} before={[20, 30, 40]} />,
    );
    expect(container.querySelector('[data-slot="spectrum-before"]')).toBeTruthy();
    expect(screen.getByText(/It moved \+30 points since before\./)).toBeTruthy();
    expect(screen.getByText(/^3 people/)).toBeTruthy();
  });
});
