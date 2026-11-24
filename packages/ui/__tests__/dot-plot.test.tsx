/**
 * DotPlot: the axis is pure and tested on its own; the plot is tested for
 * what a reader receives: a sentence per row, shape as well as colour, the
 * last value at the end of each row, sorting, and the growth that runs once
 * and never under reduced motion.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DotPlot,
  MIN_VIEWPORT,
  describeDotRow,
  niceTicks,
  thinTicks,
  type DotRow,
  type DotSeries,
} from '../src/charts/dot-plot.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const YEARS: DotSeries[] = [
  { id: 'y1', label: 'Year one' },
  { id: 'y2', label: 'Year two' },
];

const ROWS: DotRow[] = [
  { label: 'Under 30', values: { y1: 0.42, y2: 0.58 }, note: '310 people' },
  { label: '30 to 59', values: { y1: 0.51, y2: 0.55 } },
  { label: '60 and over', values: { y1: 0.66, y2: 0.61 } },
  { label: 'Not asked', values: { y1: null } },
];

const pctFormat: Intl.NumberFormatOptions = { style: 'percent', maximumFractionDigits: 0 };

describe('niceTicks', () => {
  it('rounds the range out to round steps', () => {
    expect(niceTicks(0.42, 0.66)).toEqual([0.4, 0.5, 0.6, 0.7]);
    expect(niceTicks(0.1, 0.3, 2)).toEqual([0.1, 0.2, 0.3]);
    expect(niceTicks(3, 97)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(97, 3)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(0, 7, 4)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(1, 3000, 4)).toEqual([0, 1000, 2000, 3000]);
  });

  it('puts one step either side of a single value, and gives nothing for no range', () => {
    expect(niceTicks(5, 5)).toEqual([4, 5, 6]);
    expect(niceTicks(0, 0)).toEqual([-0.2, 0, 0.2]);
    expect(niceTicks(Number.NaN, 1)).toEqual([]);
  });
});

describe('describeDotRow', () => {
  it('names the row and every value, saying when one is missing', () => {
    expect(describeDotRow(ROWS[3]!, YEARS, String)).toBe('Not asked: Year one no data, Year two no data.');
    expect(describeDotRow(ROWS[0]!, YEARS, String)).toBe('Under 30: Year one 0.42, Year two 0.58.');
  });
});

describe('<DotPlot>', () => {
  const renderPlot = (props: Partial<React.ComponentProps<typeof DotPlot>> = {}) =>
    render(<DotPlot series={YEARS} rows={ROWS} format={pctFormat} locale="en-US" {...props} />);
  const labels = (c: HTMLElement) =>
    [...c.querySelectorAll('[data-slot="dot-plot-row"]')].map((r) => r.querySelector('span span')!.textContent);

  it('declares its slot and minimum viewport, and gives each row a sentence', () => {
    const { container } = renderPlot({ label: 'Support, by age' });
    expect(container.querySelector('[data-slot="dot-plot"]')!.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getByRole('figure', { name: 'Support, by age' })).toBeTruthy();
    expect(screen.getByText('Under 30: Year one 42%, Year two 58%. 310 people.')).toBeTruthy();
  });

  it('draws the first series hollow and the rest filled, joined by a line', () => {
    const { container } = renderPlot();
    const row = container.querySelector('[data-slot="dot-plot-row"]')!;
    const [a, b] = row.querySelectorAll('[data-slot="dot-plot-dot"]');
    expect(a!.getAttribute('class')).toContain('fill-background');
    expect(b!.getAttribute('class')).toContain('fill-chart-2');
    const link = row.querySelector('[data-slot="dot-plot-link"]')!;
    expect(link.getAttribute('x1')).toBe(a!.getAttribute('cx'));
    expect(link.getAttribute('x2')).toBe(b!.getAttribute('cx'));
  });

  it('prints the last value at the end of each row, or a dash', () => {
    const { container } = renderPlot();
    const ends = [...container.querySelectorAll('[data-slot="dot-plot-end"]')].map((e) => e.textContent);
    expect(ends).toEqual(['58%', '55%', '61%', '–']);
  });

  it('draws no line for a row with one value, and no dot for a missing one', () => {
    const { container } = renderPlot({ rows: [{ label: 'One', values: { y2: 0.5 } }, ...ROWS] });
    const one = container.querySelector('[data-slot="dot-plot-row"]')!;
    expect(one.querySelectorAll('[data-slot="dot-plot-dot"]')).toHaveLength(1);
    expect(one.querySelector('[data-slot="dot-plot-link"]')).toBeNull();
  });

  it('sorts by the last value or by the change, missing values last', () => {
    const { container, rerender } = renderPlot({ order: 'descending' });
    expect(labels(container)).toEqual(['60 and over', 'Under 30', '30 to 59', 'Not asked']);
    rerender(<DotPlot series={YEARS} rows={ROWS} order="change" />);
    expect(labels(container)).toEqual(['Under 30', '30 to 59', '60 and over', 'Not asked']);
    rerender(<DotPlot series={YEARS} rows={[{ label: 'A', values: { y2: 1 } }, ...ROWS]} order="change" />);
    expect(labels(container).at(-1)).toBe('Not asked');
    expect(labels(container)[3]).toBe('A');
  });

  it('labels the axis with round ticks, or with the given domain at its ends', () => {
    const { container, rerender } = renderPlot();
    const ticks = () => [...container.querySelectorAll('[data-slot="dot-plot-axis"] text')].map((t) => t.textContent);
    expect(ticks()).toEqual(['40%', '50%', '60%', '70%']);
    rerender(<DotPlot series={YEARS} rows={ROWS} format={pctFormat} locale="en-US" domain={[1, 0]} />);
    expect(ticks()).toEqual(['0%', '20%', '40%', '60%', '80%', '100%']);
    rerender(<DotPlot series={YEARS} rows={ROWS} domain={[2, 2]} />);
    expect(screen.getByText('No values to show yet.')).toBeTruthy();
  });

  it('picks out a series from the legend or a dot, and pins it on click', () => {
    const { container } = renderPlot();
    const end = () => container.querySelector('[data-slot="dot-plot-end"]')!.textContent;
    const yearOne = screen.getByRole('button', { name: 'Year one' });
    fireEvent.focus(yearOne);
    expect(end()).toBe('42%');
    const later = container.querySelector('[data-slot="dot-plot-dot"][data-series="1"]')!;
    expect(later.getAttribute('class')).toContain('opacity-25');
    fireEvent.blur(yearOne);
    expect(end()).toBe('58%');
    fireEvent.pointerEnter(yearOne);
    expect(end()).toBe('42%');
    fireEvent.pointerLeave(yearOne);
    fireEvent.click(yearOne);
    expect(yearOne.getAttribute('aria-pressed')).toBe('true');
    expect(end()).toBe('42%');
    fireEvent.click(yearOne);
    const svg = container.querySelector('[data-slot="dot-plot-row"] svg')!;
    const first = container.querySelector('[data-slot="dot-plot-dot"][data-series="0"]')!;
    fireEvent.pointerMove(first);
    expect(end()).toBe('42%');
    fireEvent.pointerMove(svg);
    expect(end()).toBe('58%');
    fireEvent.pointerMove(first);
    fireEvent.pointerLeave(svg);
    expect(end()).toBe('58%');
  });

  it('gives series their own tones, then the next hues in order', () => {
    const { container } = render(
      <DotPlot
        series={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B', tone: 5 }, { id: 'c', label: 'C' }]}
        rows={[{ label: 'R', values: { a: 1, b: 2, c: 3 } }]}
      />,
    );
    const dots = [...container.querySelectorAll('[data-slot="dot-plot-dot"]')].map((d) => d.getAttribute('class'));
    expect(dots[0]).toContain('stroke-chart-1');
    expect(dots[1]).toContain('fill-chart-5');
    expect(dots[2]).toContain('fill-chart-2');
    cleanup();
    const all = render(
      <DotPlot
        series={[1, 2, 3, 4, 5].map((t) => ({ id: `n${t}`, label: `N${t}`, tone: t as 1 })).concat({ id: 'x', label: 'X' } as never)}
        rows={[{ label: 'R', values: { n1: 1, x: 2 } }]}
      />,
    );
    expect(all.container.querySelectorAll('[data-slot="dot-plot-dot"]')[1]!.getAttribute('class')).toContain('fill-chart-1');
  });

  it('keeps a table of every value behind the picture, shown on request', () => {
    const { container, rerender } = renderPlot({ label: 'Support' });
    const wrap = container.querySelector('[data-slot="dot-plot-table"]')!;
    expect(wrap.className).toContain('sr-only');
    expect(within(wrap as HTMLElement).getByRole('rowheader', { name: 'Not asked' }).parentElement!.textContent).toBe('Not asked––');
    rerender(<DotPlot series={YEARS} rows={ROWS} showTable />);
    expect(container.querySelector('[data-slot="dot-plot-table"]')!.className).not.toContain('sr-only');
    expect(screen.getByText('Values by row')).toBeTruthy();
  });

  it('reserves its box while loading and says so when empty', () => {
    const { container, rerender } = render(<DotPlot series={YEARS} rows={[]} loading />);
    expect(container.querySelector('[data-state="loading"]')).toBeTruthy();
    rerender(<DotPlot series={YEARS} rows={[]} />);
    expect(screen.getByText('No values to show yet.')).toBeTruthy();
    rerender(<DotPlot series={[]} rows={ROWS} order="descending" />);
    expect(screen.getByText('No values to show yet.')).toBeTruthy();
    rerender(<DotPlot series={YEARS} rows={[{ label: 'x', values: {} }]} />);
    expect(screen.getByText('No values to show yet.')).toBeTruthy();
  });

  it('draws the change once on first view, and not under reduced motion or off screen', () => {
    let fire: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          fire = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    // Without the Web Animations API, nothing is hidden.
    const plain = renderPlot();
    expect(plain.container.querySelector<SVGElement>('[data-slot="dot-plot-link"]')!.style.opacity).toBe('');
    plain.unmount();

    const proto = SVGElement.prototype as unknown as { animate?: unknown; getAnimations?: unknown };
    const animate = vi.fn();
    const cancel = vi.fn();
    proto.animate = animate;
    proto.getAnimations = () => [{ cancel }];
    try {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
      const view = renderPlot();
      act(() => fire!([{ isIntersecting: false }]));
      expect(animate).not.toHaveBeenCalled();
      act(() => fire!([{ isIntersecting: true }]));
      // Three lines and three later dots; the row with no values adds neither.
      expect(animate).toHaveBeenCalledTimes(6);
      view.unmount();
      expect(cancel).toHaveBeenCalled();

      const none = render(<DotPlot series={YEARS} rows={[{ label: 'One', values: { y1: 1 } }]} />);
      none.unmount();

      animate.mockClear();
      fire = undefined;
      vi.stubGlobal('matchMedia', (q: string) => ({
        matches: q.includes('reduce'),
        media: q,
        addEventListener() {},
        removeEventListener() {},
      }));
      const reduced = renderPlot();
      expect(fire).toBeUndefined();
      expect(animate).not.toHaveBeenCalled();
      reduced.unmount();
    } finally {
      delete proto.animate;
      delete proto.getAnimations;
    }
  });
});

describe('thinTicks', () => {
  it('keeps both ends and drops inner labels that would touch a neighbour', () => {
    expect(thinTicks([])).toEqual([]);
    expect(thinTicks([[0, 20]])).toEqual([true]);
    // 0–20, 15–35 touches the first, 40–60 fits, 62–80 touches the last (70–90).
    expect(thinTicks([[0, 20], [15, 35], [40, 60], [62, 80], [70, 90]])).toEqual([true, false, true, false, true]);
  });

  it('orders by position, so a mirrored axis thins the same way', () => {
    expect(thinTicks([[70, 90], [40, 60], [0, 20]])).toEqual([true, true, true]);
    expect(thinTicks([[70, 90], [62, 80], [0, 20]])).toEqual([true, false, true]);
  });
});

describe('<DotPlot> axis labels', () => {
  it('hides inner tick labels that would touch, after layout, and again on resize', () => {
    let fit: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          fit = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    let wide = false;
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const i = Array.from(this.parentNode?.children ?? []).indexOf(this);
      const at = i * (wide ? 100 : 10);
      return { left: at, right: at + 30 } as DOMRect;
    });
    const { container, unmount } = render(<DotPlot rows={ROWS} series={YEARS} format={pctFormat} locale="en-US" />);
    const labels = () =>
      Array.from(container.querySelectorAll('[data-slot="dot-plot-axis"] text')).map((t) => t.getAttribute('visibility'));
    const n = labels().length;
    expect(labels()[0]).toBeNull();
    expect(labels()[n - 1]).toBeNull();
    expect(labels().slice(1, -1).every((v) => v === 'hidden')).toBe(true);
    wide = true;
    act(() => fit());
    expect(labels().every((v) => v === null)).toBe(true);
    unmount();
    expect(disconnect).toHaveBeenCalled();
    rect.mockRestore();
  });

  it('measures once where ResizeObserver is missing', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { container } = render(<DotPlot rows={ROWS} series={YEARS} format={pctFormat} locale="en-US" />);
    expect(container.querySelector('[data-slot="dot-plot-axis"] text')).toBeTruthy();
  });
});
