/**
 * SeatChart: the geometry is pure and tested on its own; the rendered chart
 * is tested for what a reader receives: the sentence, counts beside every
 * name, the table behind the picture, vacant seats, and the one-time reveal
 * that never runs under reduced motion.
 */
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MIN_VIEWPORT,
  SeatChart,
  SeatChartCompare,
  describeSeats,
  seatLayout,
  type SeatGroup,
} from '../src/charts/seat-chart.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const GROUPS: SeatGroup[] = [
  { label: 'Group A', seats: 32, tone: 1 },
  { label: 'Group B', seats: 24, tone: 2 },
  { label: 'Group C', seats: 17, tone: 3 },
  { label: 'Group D', seats: 12 },
  { label: 'Others', seats: 35, tone: 'neutral' },
];

describe('seatLayout', () => {
  it('places every seat, on the fewest rows that hold them, left to right', () => {
    for (const total of [1, 2, 7, 61, 120, 450, 650]) {
      const { seats, rows, pitch } = seatLayout(total);
      expect(seats).toHaveLength(total);
      expect(rows).toBeGreaterThan(0);
      expect(pitch).toBeGreaterThan(0);
      for (let i = 1; i < seats.length; i++) {
        expect(seats[i]!.angle).toBeLessThanOrEqual(seats[i - 1]!.angle);
      }
      for (const seat of seats) {
        expect(seat.r).toBeGreaterThan(0);
        expect(seat.r).toBeLessThanOrEqual(1);
        expect(seat.angle).toBeGreaterThanOrEqual(0);
        expect(seat.angle).toBeLessThanOrEqual(Math.PI);
      }
    }
  });

  it('uses 7 rows for 120 seats and never crowds two seats closer than the pitch', () => {
    const { seats, rows, pitch } = seatLayout(120);
    expect(rows).toBe(7);
    const xy = seats.map((s) => [s.r * Math.cos(s.angle), s.r * Math.sin(s.angle)] as const);
    let closest = Infinity;
    for (let i = 0; i < xy.length; i++) {
      for (let j = i + 1; j < xy.length; j++) {
        closest = Math.min(closest, Math.hypot(xy[i]![0] - xy[j]![0], xy[i]![1] - xy[j]![1]));
      }
    }
    expect(closest).toBeGreaterThanOrEqual(pitch * 0.84);
  });

  it('is symmetric, so the seat a majority must reach is at the top centre', () => {
    const { seats } = seatLayout(120);
    const middle = seats.slice(55, 66).map((s) => s.angle);
    expect(Math.min(...middle)).toBeLessThan(Math.PI / 2 + 0.2);
    expect(Math.max(...middle)).toBeGreaterThan(Math.PI / 2 - 0.2);
  });

  it('has nothing to place for no seats', () => {
    expect(seatLayout(0)).toEqual({ seats: [], rows: 0, pitch: 0 });
    expect(seatLayout(-3).seats).toHaveLength(0);
  });
});

describe('describeSeats', () => {
  it('names the total, each group, vacancies and the distance to a majority', () => {
    expect(describeSeats(GROUPS, 120, 61)).toBe(
      '120 seats. Group A 32, Group B 24, Group C 17, Group D 12, Others 35. A majority is 61. The largest group, Others, is 26 seats short.',
    );
    expect(describeSeats([{ label: 'A', seats: 70 }], 120, 61)).toBe(
      '120 seats. A 70. 50 seats vacant. A majority is 61. A holds a majority on its own.',
    );
    expect(describeSeats([{ label: 'A', seats: 60 }], 61, 31)).toContain('A holds a majority');
    expect(describeSeats([{ label: 'A', seats: 1 }], 1)).toBe('1 seat. A 1.');
    expect(describeSeats([], 2, 2)).toBe('2 seats. 2 seats vacant. A majority is 2.');
  });
});

describe('SeatChart', () => {
  it('draws one seat per seat, coloured by group in order, with the sentence on the picture', () => {
    const { container } = render(<SeatChart groups={GROUPS} majority={61} label="2026" />);
    const root = container.querySelector<HTMLElement>('[data-slot="seat-chart"]')!;
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(root.tagName).toBe('FIGURE');
    const seats = container.querySelectorAll('[data-slot="seat-chart-seat"]');
    expect(seats).toHaveLength(120);
    expect(seats[0]!.getAttribute('data-group')).toBe('0');
    expect(seats[0]!.getAttribute('class')).toContain('fill-chart-1');
    expect(seats[119]!.getAttribute('class')).toContain('fill-muted-foreground');
    // Group D has no tone: it takes the next palette slot by position.
    expect(container.querySelector('[data-group="3"]')!.getAttribute('class')).toContain('fill-chart-4');

    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toContain('A majority is 61.');
    expect(screen.getByRole('figure', { name: '2026' })).toBe(root);
    expect(container.querySelector('[data-slot="seat-chart-majority"]')).not.toBeNull();
  });

  it('prints every count next to its name, so colour is never the only channel', () => {
    render(<SeatChart groups={GROUPS} majority={61} />);
    const legend = screen.getAllByRole('list')[0]!;
    const items = within(legend).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Group A32', 'Group B24', 'Group C17', 'Group D12', 'Others35']);
    expect(screen.getByText('61 for a majority', { exact: false })).toBeTruthy();
  });

  it('keeps a table of groups, seats and shares behind the picture', () => {
    const { container, rerender } = render(<SeatChart groups={GROUPS} label="2022" />);
    const wrap = container.querySelector('[data-slot="seat-chart-table"]')!;
    expect(wrap.className).toContain('sr-only');
    const table = screen.getByRole('table', { name: '2022: seats by group' });
    expect(within(table).getByRole('rowheader', { name: 'Group A' })).toBeTruthy();
    expect(within(table).getByText('26.7%')).toBeTruthy();
    expect(within(table).getByText('120')).toBeTruthy();

    rerender(<SeatChart groups={GROUPS} label={<span>2022</span>} showTable majority={61} />);
    expect(container.querySelector('[data-slot="seat-chart-table"]')!.className).toContain('overflow-x-auto');
    expect(screen.getByRole('table', { name: 'Seats by group' })).toBeTruthy();
    expect(screen.getByText('Majority 61')).toBeTruthy();
  });

  it('draws seats no group holds as outlines and counts them as vacant', () => {
    const { container } = render(<SeatChart groups={[{ label: 'A', seats: 3 }]} total={5} seatsLabel="mandates" />);
    const vacant = container.querySelectorAll('[data-group="-1"]');
    expect(vacant).toHaveLength(2);
    expect(vacant[0]!.getAttribute('class')).toContain('fill-none');
    expect(screen.getAllByText('Vacant')).toHaveLength(2);
    expect(screen.getByText('5 mandates')).toBeTruthy();
    expect(container.querySelector('[data-slot="seat-chart-majority"]')).toBeNull();
  });

  it('never draws fewer seats than the groups hold', () => {
    const { container } = render(<SeatChart groups={[{ label: 'A', seats: 4 }, { label: 'B', seats: -2 }]} total={2} />);
    expect(container.querySelectorAll('[data-slot="seat-chart-seat"]')).toHaveLength(4);
    expect(screen.getByText('4 seats')).toBeTruthy();
  });

  it('says so when there are no seats, and reserves its box while loading', () => {
    const { container, rerender } = render(<SeatChart groups={[]} />);
    expect(screen.getByText('No seats to show yet.')).toBeTruthy();
    expect(container.querySelector('[data-slot="seat-chart-empty"]')).not.toBeNull();
    rerender(<SeatChart groups={GROUPS} loading />);
    expect(container.querySelector('[data-slot="seat-chart"]')!.getAttribute('data-min-viewport')).toBe('320');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('draws the seats without a legend when no group holds any', () => {
    const { container } = render(<SeatChart groups={[]} total={10} />);
    expect(container.querySelectorAll('[data-group="-1"]')).toHaveLength(10);
    expect(container.querySelector('[data-slot="seat-chart-legend"]')).toBeNull();
  });

  it('shows one seat as one seat', () => {
    render(<SeatChart groups={[{ label: 'Solo', seats: 1 }]} />);
    expect(screen.getByText('1 seat')).toBeTruthy();
  });
});

describe('SeatChart reveal', () => {
  let callback: IntersectionObserverCallback | undefined;
  const animate = vi.fn();

  beforeEach(() => {
    callback = undefined;
    animate.mockReset();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    (SVGElement.prototype as unknown as { animate: unknown }).animate = animate;
  });
  afterEach(() => {
    delete (SVGElement.prototype as unknown as { animate?: unknown }).animate;
  });

  const view = (isIntersecting: boolean) =>
    act(() => callback?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));

  it('hides the seats until the first view, then fills them in once, left to right', () => {
    const { container, unmount } = render(<SeatChart groups={GROUPS} />);
    const seats = container.querySelectorAll<SVGElement>('[data-slot="seat-chart-seat"]');
    expect(seats[0]!.style.opacity).toBe('0');
    view(false);
    expect(animate).not.toHaveBeenCalled();
    view(true);
    expect(animate).toHaveBeenCalledTimes(120);
    const delays = animate.mock.calls.map((call) => (call[1] as KeyframeAnimationOptions).delay as number);
    expect(delays[0]).toBe(0);
    expect(delays[119]).toBeGreaterThan(delays[60]!);
    expect(Math.max(...delays) + (animate.mock.calls[0]![1] as KeyframeAnimationOptions).duration!).toBeLessThan(1000);
    expect(seats[0]!.style.opacity).toBe('');
    // Leaving mid-reveal cancels what is still running.
    const cancel = vi.fn();
    const proto = SVGElement.prototype as unknown as { getAnimations?: unknown };
    proto.getAnimations = () => [{ cancel }];
    unmount();
    delete proto.getAnimations;
    expect(cancel).toHaveBeenCalledTimes(120);
  });

  it('leaves the seats in place where the browser cannot animate them', () => {
    delete (SVGElement.prototype as unknown as { animate?: unknown }).animate;
    const { container } = render(<SeatChart groups={GROUPS} />);
    expect(container.querySelector<SVGElement>('[data-slot="seat-chart-seat"]')!.style.opacity).toBe('');
  });

  it('does nothing under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }));
    const { container } = render(<SeatChart groups={GROUPS} />);
    expect(container.querySelector<SVGElement>('[data-slot="seat-chart-seat"]')!.style.opacity).toBe('');
    expect(callback).toBeUndefined();
  });
});

describe('SeatChartCompare', () => {
  it('stacks, then sets charts side by side by its own width', () => {
    const { container, rerender } = render(
      <SeatChartCompare data-testid="c">
        <SeatChart groups={GROUPS} label="2022" />
        <SeatChart groups={GROUPS} label="2026" />
      </SeatChartCompare>,
    );
    const root = container.querySelector('[data-slot="seat-chart-compare"]')!;
    expect(root.className).toContain('@container/compare');
    expect(screen.getByTestId('c').className).toContain('@2xl/compare:grid-cols-2');
    expect(screen.getAllByRole('figure')).toHaveLength(2);
    rerender(<SeatChartCompare data-testid="c" columns={3} className="mt-4" />);
    expect(screen.getByTestId('c').className).toContain('@4xl/compare:grid-cols-3');
    expect(container.querySelector('[data-slot="seat-chart-compare"]')!.className).toContain('mt-4');
  });
});
