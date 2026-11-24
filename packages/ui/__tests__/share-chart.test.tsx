/**
 * ShareChart: the geometry is pure and tested on its own; the rendered chart
 * is tested for what a reader receives: a sentence per row, named categories,
 * the table behind the picture, the shared zero line, and the one-time
 * growth that never runs under reduced motion.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MIN_VIEWPORT,
  ShareChart,
  describeShareRow,
  shareFills,
  shareLayout,
  shareOf,
  type ShareCategory,
  type ShareRow,
} from '../src/charts/share-chart.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SCALE: ShareCategory[] = [
  { id: 'sd', label: 'Strongly disagree' },
  { id: 'd', label: 'Disagree' },
  { id: 'n', label: 'Neither' },
  { id: 'a', label: 'Agree' },
  { id: 'sa', label: 'Strongly agree' },
];

const ROWS: ShareRow[] = [
  { label: 'Group one', values: { sd: 10, d: 20, n: 20, a: 30, sa: 20 }, note: 'n = 400' },
  { label: 'Group two', values: { sd: 30, d: 30, n: 10, a: 20, sa: 10 } },
  { label: 'Group three', values: { sd: 5, d: 10, n: 10, a: 40, sa: 35 } },
];

const USE: ShareCategory[] = [
  { id: 'bike', label: 'Bike' },
  { id: 'bus', label: 'Bus' },
  { id: 'walk', label: 'Walk' },
];

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('shareOf', () => {
  it('divides by the sum, or by a larger given total', () => {
    expect(shareOf({ label: 'x', values: { bike: 1, bus: 1, walk: 2 } }, USE)).toEqual([0.25, 0.25, 0.5]);
    expect(shareOf({ label: 'x', values: { bike: 40, bus: 40 }, total: 100 }, USE)).toEqual([0.4, 0.4, 0]);
  });

  it('never lets a total smaller than the sum push shares past 100%', () => {
    const shares = shareOf({ label: 'x', values: { bike: 60, bus: 60 }, total: 100 }, USE);
    close(shares.reduce((a, b) => a + b, 0), 1);
  });

  it('counts missing, negative and non-finite values as 0, and an empty row as all 0', () => {
    expect(shareOf({ label: 'x', values: { bike: -3, bus: Number.NaN, walk: 2 } }, USE)).toEqual([0, 0, 1]);
    expect(shareOf({ label: 'x', values: {} }, USE)).toEqual([0, 0, 0]);
  });
});

describe('shareLayout', () => {
  it('stacks each row from 0 to 100%', () => {
    const { zero, rows } = shareLayout([{ label: 'x', values: { bike: 1, bus: 1, walk: 2 } }], USE, 'stacked');
    expect(zero).toBe(0);
    expect(rows[0]!.segments.map((s) => s.x)).toEqual([0, 0.25, 0.5]);
    close(rows[0]!.end, 1);
  });

  it('puts one zero line under every diverging row, with the neutral across it', () => {
    const { zero, rows } = shareLayout(ROWS, SCALE, 'diverging', { neutral: 2 });
    // Widest start reach: group two, 30 + 30 + 10/2 = 65%. Widest end: group three, 75 + 5 = 80%.
    close(zero, 0.65 / 1.45);
    for (const row of rows) {
      const middle = row.segments[2]!;
      close(middle.x + middle.width / 2, zero);
      const first = row.segments[0]!;
      const last = row.segments.at(-1)!;
      expect(first.x).toBeGreaterThanOrEqual(-1e-9);
      expect(last.x + last.width).toBeLessThanOrEqual(1 + 1e-9);
    }
    close(rows[1]!.start, 0.6);
    close(rows[2]!.end, 0.75);
  });

  it('splits at half without a neutral, and the sides meet at zero', () => {
    const four = SCALE.filter((c) => c.id !== 'n');
    const { zero, rows } = shareLayout(ROWS, four, 'diverging');
    for (const row of rows) close(row.segments[2]!.x, zero);
  });
});

describe('shareFills', () => {
  it('runs the stacked hues in order, honouring a given tone', () => {
    const fills = shareFills([...USE, { id: 'other', label: 'Other', tone: 'neutral' }], 'stacked');
    expect(fills).toEqual(['fill-chart-1', 'fill-chart-2', 'fill-chart-3', 'fill-muted-foreground']);
  });

  it('gives each diverging side its pole, strongest at the ends, and greys the neutral', () => {
    const fills = shareFills(SCALE, 'diverging', { neutral: 2 });
    expect(fills[0]).toBe('fill-chart-1');
    expect(fills[4]).toBe('fill-chart-3');
    expect(fills[1]).toContain('--chart-1');
    expect(fills[1]).not.toBe(fills[0]);
    expect(fills[3]).toContain('--chart-3');
    expect(fills[2]).toContain('--muted-foreground');
  });

  it('takes other poles', () => {
    const fills = shareFills(SCALE, 'diverging', { neutral: 2, poles: [4, 5] });
    expect(fills[0]).toBe('fill-chart-4');
    expect(fills[4]).toBe('fill-chart-5');
  });
});

describe('edge cases', () => {
  it('lays out an all-empty diverging chart without dividing by zero', () => {
    const { zero, rows } = shareLayout([{ label: 'x', values: {} }], SCALE, 'diverging', { neutral: 2 });
    expect(zero).toBe(0);
    expect(rows[0]!.segments.every((s) => s.width === 0)).toBe(true);
  });

  it('greys a sixth stacked category', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, label: id }));
    expect(shareFills(six, 'stacked')[5]).toBe('fill-muted-foreground');
  });

  it('splits a diverging chart without a neutral where told, and sides follow the split', () => {
    const four = SCALE.filter((c) => c.id !== 'n');
    const { container } = render(
      <ShareChart categories={four} rows={ROWS.slice(0, 1)} layout="diverging" split={1} locale="en-US" />,
    );
    expect(container.querySelector('[data-slot="share-chart-start"]')!.textContent).toBe('13%');
    fireEvent.focus(screen.getByRole('button', { name: 'Disagree' }));
    expect(container.querySelector('[data-slot="share-chart-end"]')!.textContent).toBe('25%');
    cleanup();
    const half = render(<ShareChart categories={four} rows={ROWS.slice(0, 1)} layout="diverging" locale="en-US" />);
    expect(half.container.querySelector('[data-slot="share-chart-start"]')!.textContent).toBe('38%');
  });

  it('splits diverging colours at half, or where told, without a neutral', () => {
    const four = SCALE.filter((c) => c.id !== 'n');
    expect(shareFills(four, 'diverging')).toEqual([
      'fill-chart-1',
      expect.stringContaining('--chart-1'),
      expect.stringContaining('--chart-3'),
      'fill-chart-3',
    ]);
    const lopsided = shareFills(four, 'diverging', { split: 1 });
    expect(lopsided[0]).toBe('fill-chart-1');
    expect(lopsided.slice(1).every((f) => f.includes('chart-3'))).toBe(true);
  });
});

describe('describeShareRow', () => {
  it('names the row and every share', () => {
    expect(describeShareRow({ label: 'Here', values: { bike: 1, bus: 3 } }, USE, (s) => `${s * 100}%`)).toBe(
      'Here: Bike 25%, Bus 75%, Walk 0%.',
    );
  });
});

describe('<ShareChart>', () => {
  it('declares its slot, layout and minimum viewport', () => {
    const { container } = render(<ShareChart categories={USE} rows={[{ label: 'A', values: { bike: 1 } }]} />);
    const root = container.querySelector('[data-slot="share-chart"]')!;
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(root.getAttribute('data-layout')).toBe('stacked');
  });

  it('gives every row a sentence with every share', () => {
    render(<ShareChart categories={SCALE} rows={ROWS} layout="diverging" neutral="n" locale="en-US" />);
    expect(
      screen.getByText(
        'Group one: Strongly disagree 10%, Disagree 20%, Neither 20%, Agree 30%, Strongly agree 20%.',
        { exact: false },
      ),
    ).toBeTruthy();
  });

  it('prints each side total of a diverging row, the neutral left out', () => {
    const { container } = render(
      <ShareChart categories={SCALE} rows={ROWS} layout="diverging" neutral="n" locale="en-US" />,
    );
    const first = container.querySelector('[data-slot="share-chart-row"]')!;
    expect(first.querySelector('[data-slot="share-chart-start"]')!.textContent).toBe('30%');
    expect(first.querySelector('[data-slot="share-chart-end"]')!.textContent).toBe('50%');
    expect(container.querySelectorAll('[data-slot="share-chart-zero"]')).toHaveLength(ROWS.length);
    const end = first.querySelector('[data-slot="share-chart-end"]')!;
    const start = first.querySelector('[data-slot="share-chart-start"]')!;
    fireEvent.focus(screen.getByRole('button', { name: 'Disagree' }));
    expect([start.textContent, end.textContent]).toEqual(['20%', '']);
    fireEvent.focus(screen.getByRole('button', { name: 'Neither' }));
    expect([start.textContent, end.textContent]).toEqual(['', '20%']);
  });

  it('sorts rows largest first when asked, by a named category', () => {
    const { container } = render(
      <ShareChart categories={SCALE} rows={ROWS} order="descending" sortBy="sd" locale="en-US" />,
    );
    const labels = [...container.querySelectorAll('[data-slot="share-chart-row-label"]')].map(
      (el) => el.firstChild!.textContent,
    );
    expect(labels).toEqual(['Group two', 'Group one', 'Group three']);
  });

  it('sorts by the end side when diverging, by the first category when stacked, and ignores an unknown id', () => {
    const labels = (c: HTMLElement) =>
      [...c.querySelectorAll('[data-slot="share-chart-row-label"]')].map((el) => el.firstChild!.textContent);
    const { container, rerender } = render(
      <ShareChart categories={SCALE} rows={ROWS} layout="diverging" neutral="n" order="descending" />,
    );
    expect(labels(container)).toEqual(['Group three', 'Group one', 'Group two']);
    rerender(<ShareChart categories={SCALE} rows={ROWS} order="descending" />);
    expect(labels(container)).toEqual(['Group two', 'Group one', 'Group three']);
    const tied: ShareRow[] = [
      { label: 'P', values: { bike: 1 } },
      { label: 'Q', values: { bike: 1 } },
      { label: 'R', values: {} },
    ];
    rerender(<ShareChart categories={USE} rows={tied} order="descending" sortBy="nope" />);
    expect(labels(container)).toEqual(['P', 'Q', 'R']);
  });

  it('labels the two sides above a diverging chart', () => {
    render(<ShareChart categories={SCALE} rows={ROWS} layout="diverging" neutral="n" sideLabels={['Against', 'For']} />);
    expect(screen.getByText('Against')).toBeTruthy();
    expect(screen.getByText('For')).toBeTruthy();
  });

  it('follows the pointer over segments and legend entries', () => {
    const { container } = render(<ShareChart categories={USE} rows={[{ label: 'A', values: { bike: 1, bus: 3 } }]} locale="en-US" />);
    const end = () => container.querySelector('[data-slot="share-chart-end"]')!.textContent;
    const bar = container.querySelector('[data-slot="share-chart-bar"]')!;
    const bike = container.querySelector('[data-slot="share-chart-segment"][data-category="0"]')!;
    fireEvent.pointerMove(bike);
    expect(end()).toBe('25%');
    fireEvent.pointerMove(bar);
    expect(end()).toBe('');
    fireEvent.pointerMove(bike);
    fireEvent.pointerLeave(bar);
    expect(end()).toBe('');
    const legend = screen.getByRole('button', { name: 'Bus' });
    fireEvent.pointerEnter(legend);
    expect(end()).toBe('75%');
    fireEvent.pointerLeave(legend);
    expect(end()).toBe('');
  });

  it('shows the bars as they are where the browser cannot animate or the chart is off screen', () => {
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
    const { container, unmount } = render(<ShareChart categories={USE} rows={[{ label: 'A', values: { bike: 1 } }]} />);
    expect(fire).toBeUndefined();
    expect(container.querySelector<SVGGElement>('[data-slot="share-chart-grow"]')!.style.opacity).toBe('');
    unmount();

    const proto = SVGElement.prototype as unknown as { animate?: unknown; getAnimations?: unknown };
    const animate = vi.fn();
    proto.animate = animate;
    proto.getAnimations = () => [];
    try {
      const view = render(<ShareChart categories={USE} rows={[{ label: 'A', values: { bike: 1 } }]} />);
      act(() => fire!([{ isIntersecting: false }]));
      expect(animate).not.toHaveBeenCalled();
      expect(view.container.querySelector<SVGGElement>('[data-slot="share-chart-grow"]')!.style.opacity).toBe('0');
      view.unmount();
    } finally {
      delete proto.animate;
      delete proto.getAnimations;
    }
  });

  it('highlights a category from the legend, prints its share on every row, and pins on click', () => {
    const { container } = render(<ShareChart categories={USE} rows={[{ label: 'A', values: { bike: 1, bus: 3 } }]} locale="en-US" />);
    const bus = screen.getByRole('button', { name: 'Bus' });
    fireEvent.focus(bus);
    expect(container.querySelector('[data-slot="share-chart-end"]')!.textContent).toBe('75%');
    const bike = container.querySelector('[data-slot="share-chart-segment"][data-category="0"]')!;
    expect(bike.getAttribute('class')).toContain('opacity-25');
    fireEvent.blur(bus);
    expect(container.querySelector('[data-slot="share-chart-end"]')!.textContent).toBe('');
    fireEvent.click(bus);
    expect(bus.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-slot="share-chart-end"]')!.textContent).toBe('75%');
    fireEvent.click(bus);
    expect(bus.getAttribute('aria-pressed')).toBe('false');
  });

  it('draws no segment for a zero share', () => {
    const { container } = render(<ShareChart categories={USE} rows={[{ label: 'A', values: { bike: 1, walk: 1 } }]} />);
    expect(container.querySelectorAll('[data-slot="share-chart-segment"]')).toHaveLength(2);
  });

  it('keeps a table of every value behind the picture, and shows it on request', () => {
    const { container, rerender } = render(<ShareChart categories={USE} rows={[{ label: 'A', values: { bike: 1 } }]} label="Getting to work" />);
    const wrap = container.querySelector('[data-slot="share-chart-table"]')!;
    expect(wrap.className).toContain('sr-only');
    const table = within(wrap as HTMLElement).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Walk' })).toBeTruthy();
    expect(within(table).getByRole('rowheader', { name: 'A' })).toBeTruthy();
    rerender(<ShareChart categories={USE} rows={[{ label: 'A', values: { bike: 1 } }]} showTable />);
    expect(container.querySelector('[data-slot="share-chart-table"]')!.className).not.toContain('sr-only');
  });

  it('reserves its box while loading and says so when empty', () => {
    const { container, rerender } = render(<ShareChart categories={USE} rows={[]} loading />);
    expect(container.querySelector('[data-state="loading"]')).toBeTruthy();
    rerender(<ShareChart categories={USE} rows={[]} />);
    expect(screen.getByText('No answers to show yet.')).toBeTruthy();
    rerender(<ShareChart categories={[]} rows={ROWS} order="descending" />);
    expect(screen.getByText('No answers to show yet.')).toBeTruthy();
  });

  it('grows the bars once on first view, and not at all under reduced motion', () => {
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
    const animate = vi.fn(() => ({ cancel() {} }));
    const proto = SVGElement.prototype as unknown as { animate?: unknown; getAnimations?: unknown };
    const saved = { animate: proto.animate, getAnimations: proto.getAnimations };
    proto.animate = animate;
    const cancel = vi.fn();
    proto.getAnimations = () => [{ cancel }];
    try {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
      const { unmount } = render(<ShareChart categories={SCALE} rows={ROWS} layout="diverging" neutral="n" />);
      act(() => fire!([{ isIntersecting: true }]));
      expect(animate).toHaveBeenCalledTimes(ROWS.length);
      unmount();
      expect(cancel).toHaveBeenCalled();

      animate.mockClear();
      fire = undefined;
      vi.stubGlobal('matchMedia', (q: string) => ({
        matches: q.includes('reduce'),
        media: q,
        addEventListener() {},
        removeEventListener() {},
      }));
      render(<ShareChart categories={SCALE} rows={ROWS} />);
      if (fire) act(() => fire!([{ isIntersecting: true }]));
      expect(animate).not.toHaveBeenCalled();
    } finally {
      proto.animate = saved.animate;
      proto.getAnimations = saved.getAnimations;
    }
  });
});
