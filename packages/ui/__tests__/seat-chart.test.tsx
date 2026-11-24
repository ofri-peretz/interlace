/**
 * SeatChart: the geometry is pure and tested on its own; the rendered chart
 * is tested for what a reader receives: the sentence, counts beside every
 * name, the table behind the picture, vacant seats, and the one-time reveal
 * that never runs under reduced motion.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MIN_VIEWPORT,
  placeGroups,
  SeatChart,
  SeatChartCompare,
  describeSeats,
  seatLayout,
  type SeatGroup,
  type SeatSide,
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
    // Negative or fractional counts read as the chart draws them.
    expect(describeSeats([{ label: 'A', seats: -5 }, { label: 'B', seats: 2.7 }], 4)).toBe('4 seats. A 0, B 2. 2 seats vacant.');
    expect(describeSeats([{ label: 'A', seats: -5, side: 's' }, { label: 'B', seats: 2.7, side: 's' }], 4, undefined, [{ id: 's', label: 'S', tone: 1 }])).toContain('S 2: A 0, B 2.');
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
    expect(items.map((li) => li.textContent)).toEqual([
      'Group A32 seats',
      'Group B24 seats',
      'Group C17 seats',
      'Group D12 seats',
      'Others35 seats',
    ]);
    expect(screen.getByText('61 needed for a majority')).toBeTruthy();
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

  it('uses the singular noun for a count of one', () => {
    render(<SeatChart groups={[{ label: 'A', seats: 1 }]} seatsLabel="mandates" seatLabel="mandate" />);
    expect(screen.getByText('1 mandate')).toBeTruthy();
    expect(screen.getByText('mandate', { exact: false, selector: '.sr-only' })).toBeTruthy();
  });

  it('never draws fewer seats than the groups hold', () => {
    const { container } = render(<SeatChart groups={[{ label: 'A', seats: 4 }, { label: 'B', seats: -2 }]} total={2} />);
    expect(container.querySelectorAll('[data-slot="seat-chart-seat"]')).toHaveLength(4);
    expect(screen.getByText('4 seats')).toBeTruthy();
  });

  it('says so when there are no seats, and reserves its box while loading', () => {
    const { container, rerender } = render(<SeatChart groups={[]} />);
    expect(screen.getByText('No seats to show yet.')).toBeTruthy();
    expect(container.querySelector('[data-slot="seat-chart"][data-state="empty"]')).not.toBeNull();
    const ref = React.createRef<HTMLElement>();
    rerender(<SeatChart ref={ref} groups={GROUPS} loading id="busy" className="mt-2" />);
    const root = container.querySelector('[data-slot="seat-chart"]')!;
    expect(root.getAttribute('data-min-viewport')).toBe('320');
    expect(root.getAttribute('data-state')).toBe('loading');
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.id).toBe('busy');
    expect(root.className).toContain('mt-2');
    expect(ref.current).toBe(root);
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
    const root = screen.getByTestId('c');
    expect(root.getAttribute('data-slot')).toBe('seat-chart-compare');
    expect(root.className).toContain('@container/compare');
    const grid = () => container.querySelector('[data-slot="seat-chart-compare-grid"]')!;
    expect(grid().className).toContain('@2xl/compare:grid-cols-2');
    expect(screen.getAllByRole('figure')).toHaveLength(2);
    rerender(<SeatChartCompare data-testid="c" columns={3} className="mt-4" />);
    expect(grid().className).toContain('@4xl/compare:grid-cols-3');
    expect(screen.getByTestId('c').className).toContain('mt-4');
  });
});

const SIDES: SeatSide[] = [
  { id: 'gov', label: 'Coalition', tone: 3 },
  { id: 'opp', label: 'Opposition', tone: 1 },
];

const SIDED: SeatGroup[] = [
  { label: 'North', seats: 30, side: 'gov' },
  { label: 'East', seats: 20, side: 'opp' },
  { label: 'South', seats: 25, side: 'gov' },
  { label: 'West', seats: 30, side: 'opp' },
  { label: 'Free', seats: 5 },
  { label: 'Centre', seats: 10, side: 'gov' },
];

describe('placeGroups', () => {
  it('runs the first side from the left, the last from the right, the rest between', () => {
    const order = placeGroups(SIDED, SIDES).map((g) => g.label);
    expect(order).toEqual(['North', 'South', 'Centre', 'Free', 'West', 'East']);
  });

  it('shades each group of a side from that side’s tone, in turn', () => {
    const placed = placeGroups(SIDED, SIDES);
    const of = (label: string) => placed.find((g) => g.label === label)!;
    expect([of('North').tone, of('South').tone, of('Centre').tone]).toEqual([3, 3, 3]);
    expect([of('North').shade, of('South').shade, of('Centre').shade]).toEqual([0, 1, 2]);
    expect([of('East').shade, of('West').shade]).toEqual([0, 1]);
    // No side, no tone: it takes the palette by position.
    expect(of('Free').tone).toBe(5);
  });

  it('puts middle sides in their order and groups with no side after them', () => {
    const three: SeatSide[] = [...SIDES.slice(0, 1), { id: 'mid', label: 'Middle', tone: 2 }, SIDES[1]!];
    const order = placeGroups(
      [
        { label: 'Loose', seats: 1 },
        { label: 'M', seats: 1, side: 'mid' },
        { label: 'G', seats: 1, side: 'gov' },
        { label: 'O', seats: 1, side: 'opp' },
      ],
      three,
    ).map((g) => g.label);
    expect(order).toEqual(['G', 'M', 'Loose', 'O']);
    // One side: it starts at the left, the rest follow.
    expect(placeGroups([{ label: 'X', seats: 1 }, { label: 'Y', seats: 1, side: 'gov' }], SIDES.slice(0, 1)).map((g) => g.label)).toEqual(['Y', 'X']);
  });

  it('gives a repeated tone its next shade, so neighbours never merge', () => {
    const placed = placeGroups([
      { label: 'a', seats: 1, tone: 'neutral' },
      { label: 'b', seats: 1, tone: 'neutral' },
      { label: 'c', seats: 1, tone: 2 },
      { label: 'd', seats: 1 },
      { label: 'e', seats: 1 },
      { label: 'f', seats: 1 },
      { label: 'g', seats: 1 },
    ]);
    expect(placed.map((g) => `${g.tone}:${g.shade}`)).toEqual(['neutral:0', 'neutral:1', '2:0', '4:0', '5:0', '1:1', '2:2']);
  });

  it('gives eleven untoned lists eleven colours: the five hues, then deeper and paler in turn, then grey', () => {
    const placed = placeGroups(Array.from({ length: 11 }, (_, i) => ({ label: `L${i}`, seats: 11 - i })));
    const keys = placed.map((g) => `${g.tone}:${g.shade}`);
    expect(keys).toEqual(['1:0', '2:0', '3:0', '4:0', '5:0', '1:1', '2:2', '3:1', '4:2', '5:1', 'neutral:2']);
    expect(new Set(keys).size).toBe(11);
  });
});

describe('SeatChart with sides', () => {
  it('fills the last side from the right, with vacant seats between, and says who is short', () => {
    const { container } = render(<SeatChart groups={SIDED} sides={SIDES} total={125} majority={63} label="Assembly" />);
    const seats = Array.from(container.querySelectorAll('[data-slot="seat-chart-seat"]'));
    expect(seats[0]!.getAttribute('data-group')).toBe('0');
    expect(seats.at(-1)!.getAttribute('data-group')).toBe('1');
    expect(seats[70]!.getAttribute('data-group')).toBe('-1');
    expect(seats[0]!.getAttribute('class')).toContain('fill-chart-3');
    expect(container.querySelector('[data-group="2"]')!.getAttribute('class')).toContain('var(--chart-3),black_30%');

    const sentence = screen.getByRole('img').getAttribute('aria-label')!;
    expect(sentence).toContain('Coalition 65: North 30, South 25, Centre 10.');
    expect(sentence).toContain('No side: Free 5.');
    expect(sentence).toContain('Coalition holds a majority.');
    expect(describeSeats(SIDED.slice(0, 2), 120, 61, SIDES)).toContain('The largest side, Coalition, is 31 seats short.');
  });

  it('shows big totals per side, and a legend headed by side', () => {
    const { container } = render(<SeatChart groups={SIDED} sides={SIDES} majority={61} majorityLabel="61 to govern" />);
    const tally = container.querySelector('[data-slot="seat-chart-tally"]')!;
    expect(tally.textContent).toBe('Coalition65Opposition50');
    const legend = container.querySelector('[data-slot="seat-chart-legend"]')!;
    expect(legend.textContent).toContain('Coalition 65');
    expect(legend.textContent).toContain('No side');
    expect(screen.getByText('61 to govern')).toBeTruthy();
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Group',
      'Side',
      'Seats',
      'Share',
    ]);
    expect(within(screen.getByRole('table')).getByText('—')).toBeTruthy();
  });

  it('can show the two leading groups instead, or no totals', () => {
    const { container, rerender } = render(<SeatChart groups={GROUPS} tally="leaders" total={130} />);
    expect(container.querySelector('[data-slot="seat-chart-tally"]')!.textContent).toBe('Group A32Others35');
    rerender(<SeatChart groups={SIDED} sides={SIDES} tally="none" total={130} />);
    expect(container.querySelector('[data-slot="seat-chart-tally"]')).toBeNull();
    expect(screen.getAllByText('Vacant').length).toBeGreaterThan(0);
  });

  it('centres the total of a middle side between the outer two', () => {
    const three: SeatSide[] = [SIDES[0]!, { id: 'mid', label: 'Middle', tone: 'neutral' }, SIDES[1]!];
    const { container } = render(
      <SeatChart
        groups={[...SIDED.slice(0, 4), { label: 'Swing', seats: 8, side: 'mid' }]}
        sides={three}
      />,
    );
    const columns = container.querySelectorAll('[data-slot="seat-chart-tally"] > div');
    expect(Array.from(columns).map((c) => c.className.match(/items-(start|center|end)/)![1])).toEqual(['start', 'center', 'end']);
  });

  it('lists a side with no groups as holding none', () => {
    const sides: SeatSide[] = [...SIDES, { id: 'x', label: 'Empty', tone: 'neutral' }];
    expect(describeSeats(SIDED, 120, undefined, sides)).toContain('Empty 0.');
  });
});

describe('SeatChart highlight', () => {
  it('dims the other groups and shows the count while a legend entry is hovered or focused', () => {
    const { container } = render(<SeatChart groups={GROUPS} majority={61} />);
    const entry = screen.getByRole('button', { name: /Group B/ });
    fireEvent.pointerEnter(entry);
    expect(container.querySelector('[data-group="0"]')!.getAttribute('class')).toContain('opacity-20');
    expect(container.querySelector('[data-group="1"]')!.getAttribute('class')).not.toContain('opacity-20');
    expect(container.querySelector('[data-slot="seat-chart-total"]')!.textContent).toBe('24');
    expect(screen.getByText('Group B: 24 seats, 20%')).toBeTruthy();
    fireEvent.pointerLeave(entry);
    expect(container.querySelector('[data-slot="seat-chart-total"]')!.textContent).toBe('120');

    fireEvent.focus(entry);
    expect(container.querySelector('[data-slot="seat-chart-total"]')!.textContent).toBe('24');
    fireEvent.blur(entry);
    expect(screen.getByText('61 needed for a majority')).toBeTruthy();
  });

  it('pins a group on click, and lets go on a second click', () => {
    const { container } = render(<SeatChart groups={GROUPS} />);
    const entry = screen.getByRole('button', { name: /Group C/ });
    fireEvent.click(entry);
    expect(entry.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-slot="seat-chart-total"]')!.textContent).toBe('17');
    fireEvent.click(entry);
    expect(entry.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-slot="seat-chart-total"]')!.textContent).toBe('120');
  });

  it('follows the pointer across the seats', () => {
    const { container } = render(<SeatChart groups={[{ label: 'A', seats: 3 }]} total={5} />);
    const svg = screen.getByRole('img');
    fireEvent.pointerMove(container.querySelector('[data-group="0"]')!);
    expect(container.querySelector('[data-slot="seat-chart-total"]')!.textContent).toBe('3');
    fireEvent.pointerMove(container.querySelector('[data-group="-1"]')!);
    expect(container.querySelector('[data-slot="seat-chart-total"]')!.textContent).toBe('5');
    fireEvent.pointerMove(container.querySelector('[data-group="0"]')!);
    fireEvent.pointerMove(svg);
    expect(container.querySelector('[data-slot="seat-chart-total"]')!.textContent).toBe('5');
    fireEvent.pointerMove(container.querySelector('[data-group="0"]')!);
    fireEvent.pointerLeave(svg);
    expect(container.querySelector('[data-slot="seat-chart-total"]')!.textContent).toBe('5');
    expect(screen.getByText('5 seats')).toBeTruthy();
  });
});
