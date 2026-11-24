/**
 * ChoroplethMap: classing is pure and tested on its own; the map is tested
 * for what a reader receives: the sentence, a legend of classes, missing
 * data drawn as missing, the keyboard path through every area, and the
 * table behind the picture.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ChoroplethMap,
  MAX_BINS,
  MIN_VIEWPORT,
  binOf,
  describeMap,
  mapBins,
  shadeSteps,
  type MapArea,
} from '../src/charts/choropleth-map.js';

afterEach(cleanup);

// Four invented squares in a 2 × 2 grid.
const square = (x: number, y: number) => `M${x} ${y}h10v10h-10z`;
const AREAS: MapArea[] = [
  { id: 'n', label: 'North', d: square(0, 0) },
  { id: 'e', label: 'East', d: square(10, 0) },
  { id: 's', label: 'South', d: square(0, 10) },
  { id: 'w', label: 'West', d: square(10, 10) },
];
const VALUES = { n: 10, e: 40, s: 20, w: null };

describe('mapBins', () => {
  it('cuts quantiles so each class holds about as many values', () => {
    expect(mapBins([1, 2, 3, 4, 5, 6, 7, 8], { bins: 4 }).edges).toEqual([1, 3, 5, 7, 8]);
  });

  it('cuts equal intervals on request', () => {
    expect(mapBins([0, 5, 100], { bins: 4, binning: 'equal' }).edges).toEqual([0, 25, 50, 75, 100]);
  });

  it('takes given breaks inside the range, sorted, ignoring the rest', () => {
    expect(mapBins([0, 100], { breaks: [50, 10, 200, -5] }).edges).toEqual([0, 10, 50, 100]);
  });

  it('merges classes that coincide, so no class is empty', () => {
    expect(mapBins([1, 1, 1, 1, 9], { bins: 4 }).edges).toEqual([1, 9]);
  });

  it('keeps one class for a single value, none for no values, and caps the class count', () => {
    expect(mapBins([3, 3]).edges).toEqual([3, 3]);
    expect(mapBins([null, undefined, Number.NaN]).edges).toEqual([]);
    const many = Array.from({ length: 100 }, (_, i) => i);
    expect(mapBins(many, { bins: 20 }).edges).toHaveLength(MAX_BINS + 1);
    expect(mapBins(many, { bins: 0 }).edges).toEqual([0, 99]);
  });
});

describe('binOf', () => {
  const bins = { edges: [0, 10, 20, 30] };
  it('puts a value in the class whose lower edge it reaches, the top class closed', () => {
    expect([0, 9.9, 10, 25, 30, 99].map((v) => binOf(v, bins))).toEqual([0, 0, 1, 2, 2, 2]);
  });
  it('gives no class to a missing value or to empty classes', () => {
    expect(binOf(null, bins)).toBe(-1);
    expect(binOf(5, { edges: [] })).toBe(-1);
  });
});

describe('shadeSteps', () => {
  it('spreads classes over the ladder, light to dark', () => {
    expect(shadeSteps(1)).toEqual([5]);
    expect(shadeSteps(2)).toEqual([0, 5]);
    expect(shadeSteps(6)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(shadeSteps(MAX_BINS)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('never gives two classes the same shade', () => {
    for (let n = 1; n <= MAX_BINS; n++) expect(new Set(shadeSteps(n)).size).toBe(n);
  });
});

describe('describeMap', () => {
  const f = (v: number) => String(v);
  it('names the highest and lowest areas and counts the missing', () => {
    expect(describeMap(AREAS, VALUES, f)).toBe('Map of 4 areas. Highest: East, 40. Lowest: North, 10. No data for 1.');
    expect(describeMap(AREAS.slice(0, 2), VALUES, f)).toBe('Map of 2 areas. Highest: East, 40. Lowest: North, 10.');
    expect(describeMap(AREAS, {}, f)).toBe('Map of 4 areas. No data.');
  });
});

describe('<ChoroplethMap>', () => {
  const renderMap = (props: Partial<React.ComponentProps<typeof ChoroplethMap>> = {}) =>
    render(<ChoroplethMap areas={AREAS} values={VALUES} viewBox="0 0 20 20" bins={3} locale="en-US" {...props} />);

  it('declares its slot and minimum viewport, and describes itself in a sentence', () => {
    const { container } = renderMap({ label: 'Rainfall' });
    expect(container.querySelector('[data-slot="choropleth-map"]')!.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Highest: East, 40.');
    expect(screen.getByRole('figure', { name: 'Rainfall' })).toBeTruthy();
  });

  it('draws missing data hatched, never in a class, and says so in the legend', () => {
    const { container } = renderMap();
    const west = container.querySelector('[data-slot="choropleth-map-area"][data-index="3"]')!;
    expect(west.getAttribute('data-bin')).toBe('-1');
    expect(west.getAttribute('fill')).toMatch(/^url\(#.+-hatch\)$/);
    const legend = container.querySelector('[data-slot="choropleth-map-legend"]') as HTMLElement;
    expect(within(legend).getByText('No data')).toBeTruthy();
    const north = container.querySelector('[data-slot="choropleth-map-area"][data-index="0"]')!;
    expect(north.getAttribute('fill')).toBeNull();
  });

  it('labels each class with its range, formatted', () => {
    renderMap({ format: { style: 'unit', unit: 'millimeter', maximumFractionDigits: 0 } });
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '10 mm–20 mm',
      '20 mm–40 mm',
    ]);
  });

  it('leaves "No data" out of the legend when every area has a value', () => {
    renderMap({ values: { n: 10, e: 40, s: 20, w: 30 } });
    expect(screen.queryByText('No data')).toBeNull();
  });

  it('steps through areas in name order from the keyboard and lets go on Escape', () => {
    const { container } = renderMap();
    const map = screen.getByRole('img');
    const readout = () => container.querySelector('[data-slot="choropleth-map-readout"]')!.textContent;
    expect(readout()).toContain('arrow keys');
    fireEvent.keyDown(map, { key: 'ArrowRight' });
    expect(readout()).toBe('East: 40 (20–40)');
    fireEvent.keyDown(map, { key: 'ArrowDown' });
    expect(readout()).toBe('North: 10 (10–20)');
    fireEvent.keyDown(map, { key: 'End' });
    expect(readout()).toBe('West: no data');
    fireEvent.keyDown(map, { key: 'ArrowRight' });
    expect(readout()).toBe('East: 40 (20–40)');
    fireEvent.keyDown(map, { key: 'ArrowLeft' });
    expect(readout()).toBe('West: no data');
    fireEvent.keyDown(map, { key: 'Home' });
    fireEvent.keyDown(map, { key: 'ArrowUp' });
    expect(readout()).toBe('West: no data');
    expect(container.querySelector('[data-slot="choropleth-map-active"]')).toBeTruthy();
    expect(fireEvent.keyDown(map, { key: 'Escape' })).toBe(false);
    expect(container.querySelector('[data-slot="choropleth-map-active"]')).toBeNull();
    // Nothing left to let go of, so Escape passes through to whatever holds the map.
    expect(fireEvent.keyDown(map, { key: 'Escape' })).toBe(true);
    fireEvent.keyDown(map, { key: 'ArrowLeft' });
    expect(readout()).toBe('West: no data');
    fireEvent.keyDown(map, { key: 'a' });
    expect(readout()).toBe('West: no data');
    fireEvent.blur(map);
    expect(readout()).toContain('arrow keys');
  });

  it('follows the pointer', () => {
    const { container } = renderMap();
    const map = screen.getByRole('img');
    const south = container.querySelector('[data-slot="choropleth-map-area"][data-index="2"]')!;
    fireEvent.pointerMove(south);
    expect(container.querySelector('[data-slot="choropleth-map-readout"]')!.textContent).toBe('South: 20 (20–40)');
    fireEvent.pointerMove(map);
    expect(container.querySelector('[data-slot="choropleth-map-active"]')).toBeNull();
    fireEvent.pointerMove(south);
    fireEvent.pointerLeave(map);
    expect(container.querySelector('[data-slot="choropleth-map-active"]')).toBeNull();
  });

  it('picks out a class from the legend, and pins it on click', () => {
    const { container } = renderMap();
    const [low] = screen.getAllByRole('button');
    const east = () => container.querySelector('[data-slot="choropleth-map-area"][data-index="1"]')!.getAttribute('class');
    fireEvent.pointerEnter(low!);
    expect(east()).toContain('opacity-25');
    fireEvent.pointerLeave(low!);
    expect(east()).not.toContain('opacity-25');
    fireEvent.focus(low!);
    expect(east()).toContain('opacity-25');
    fireEvent.blur(low!);
    fireEvent.click(low!);
    expect(low!.getAttribute('aria-pressed')).toBe('true');
    expect(east()).toContain('opacity-25');
    fireEvent.click(low!);
    expect(low!.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps a table of every area by name behind the picture, shown on request', () => {
    const { container, rerender } = renderMap({ label: 'Rainfall', legendLabel: 'Rain in a year' });
    const wrap = container.querySelector('[data-slot="choropleth-map-table"]')!;
    expect(wrap.className).toContain('sr-only');
    const rows = within(wrap as HTMLElement).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['East40', 'North10', 'South20', 'WestNo data']);
    expect(within(wrap as HTMLElement).getByRole('columnheader', { name: 'Rain in a year' })).toBeTruthy();
    rerender(<ChoroplethMap areas={AREAS} values={VALUES} viewBox="0 0 20 20" showTable />);
    expect(container.querySelector('[data-slot="choropleth-map-table"]')!.className).not.toContain('sr-only');
    expect(screen.getByText('Values by area')).toBeTruthy();
  });

  it('takes another tone, and draws a map with no values at all', () => {
    const { container } = render(<ChoroplethMap areas={AREAS} values={{}} viewBox="0 0 20 20" tone={3} />);
    expect(container.querySelector('[data-slot="choropleth-map"]')!.className).toContain('--chart-3');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('[data-slot="choropleth-map-readout"]')!.textContent).toBe('');
  });

  it('reserves its box while loading and says so when empty', () => {
    const { container, rerender } = render(<ChoroplethMap areas={[]} values={{}} viewBox="0 0 1 1" loading />);
    expect(container.querySelector('[data-state="loading"]')).toBeTruthy();
    rerender(<ChoroplethMap areas={[]} values={{}} viewBox="0 0 1 1" />);
    expect(screen.getByText('No areas to show yet.')).toBeTruthy();
  });
});
