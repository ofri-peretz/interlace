import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
/**
 * TimelineMap locks (R26) — geometry via the exported pure layout, SSR
 * honesty via renderToStaticMarkup (the crawler/no-JS view), and the
 * stateful keyboard contract via a mounted interaction test.
 */
import { describe, expect, it } from 'vitest';

import {
  TimelineMap,
  computeTimelineLayout,
  computeTracePath,
  type TimelineMapItem,
} from '../src/patterns/timeline-map.js';

const ITEMS: TimelineMapItem[] = [
  { id: 'a', href: '/a', label: 'Alpha', category: 'Guides', date: '2026-01-10', weight: 0.2 },
  { id: 'b', href: '/b', label: 'Beta', category: 'Guides', date: '2026-01-10', weight: 1 },
  { id: 'c', href: '/c', label: 'Gamma', category: 'Guides', date: '2026-01-10' },
  { id: 'd', href: '/d', label: 'Delta', category: null, date: '2026-06-15' },
];

describe('computeTimelineLayout', () => {
  it('fans same-(lane,day) bursts so no two dots share coordinates', () => {
    const { lanes } = computeTimelineLayout(ITEMS, 'Other');
    const coords = lanes.flatMap((l) => l.dots.map((d) => `${d.cx},${d.cy}`));
    expect(new Set(coords).size).toBe(coords.length);
  });

  it('centers the first dot of every group (solo dots never ride the edge)', () => {
    const { lanes } = computeTimelineLayout(ITEMS, 'Other');
    const solo = lanes.find((l) => l.name === 'Other')!.dots[0];
    expect(solo.cy).toBe(22);
  });

  it('orders lanes by count with the uncategorized lane last', () => {
    const { lanes } = computeTimelineLayout(ITEMS, 'Other');
    expect(lanes.map((l) => l.name)).toEqual(['Guides', 'Other']);
  });

  it('link weave: edge endpoints sit exactly on their dots, lane-offset applied', () => {
    const linked: TimelineMapItem[] = [
      { id: 'p', href: '/p', label: 'P', category: 'A', date: '2026-01-01', links: ['q', 'p', 'ghost'] },
      // q links BACK to p: a mutual citation must still be ONE thread —
      // two overlapping paths double the visual weight (review round 3).
      { id: 'q', href: '/q', label: 'Q', category: 'B', date: '2026-03-01', links: ['p'] },
    ];
    const { lanes, edges } = computeTimelineLayout(linked, 'Other');
    // self-link, unknown target, and the reverse duplicate all dropped
    expect(edges).toHaveLength(1);
    const [e] = edges;
    const flat = lanes.flatMap((l, li) =>
      l.dots.map((d) => ({ id: d.item.id, x: d.cx, y: li * 44 + d.cy })),
    );
    const p = flat.find((d) => d.id === 'p')!;
    const q = flat.find((d) => d.id === 'q')!;
    expect([e.x1, e.y1, e.x2, e.y2]).toEqual([p.x, p.y, q.x, q.y]);
    // the two dots live in different lanes, so the thread crosses lanes
    expect(e.y1).not.toBe(e.y2);
  });

  it('fit-all: the layout stretches to the given strip width', () => {
    // The whole territory rides the wider axis — the latest dot lands
    // near the right edge of a 1000px strip, not parked at the 560 floor.
    const maxCx = (w?: number) =>
      Math.max(
        ...computeTimelineLayout(ITEMS, 'Other', w).lanes.flatMap((l) =>
          l.dots.map((d) => d.cx),
        ),
      );
    expect(maxCx(1000)).toBeGreaterThan(900);
    expect(maxCx()).toBeLessThan(560); // default keeps the floor geometry
  });

  it('the axis is never empty — endpoint fallback inside a single quarter', () => {
    const narrow = computeTimelineLayout(
      [
        { id: 'x', href: '/x', label: 'X', category: 'C', date: '2026-01-05' },
        { id: 'y', href: '/y', label: 'Y', category: 'C', date: '2026-02-20' },
      ],
      'Other',
    );
    expect(narrow.ticks.length).toBeGreaterThan(0);
  });

  it('traversal order is chronological', () => {
    const { order } = computeTimelineLayout(ITEMS, 'Other');
    expect(order.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('the reader\'s thread (trace)', () => {
  it('threads visited dots in order, skipping unknowns and repeats', () => {
    const { lanes } = computeTimelineLayout(ITEMS, 'Other');
    const t = computeTracePath(lanes, ['a', 'ghost', 'b', 'b', 'd'])!;
    expect(t.points).toBe(3);
    // Starts exactly on the first visited dot, in lane-stack coords.
    const flat = lanes.flatMap((l, li) =>
      l.dots.map((d) => ({ id: d.item.id, x: d.cx, y: li * 44 + d.cy })),
    );
    const a = flat.find((d) => d.id === 'a')!;
    expect(t.d.startsWith(`M ${a.x} ${a.y}`)).toBe(true);
    // Speaks the corpus threads' curve grammar, never straight lines.
    expect(t.d).toMatch(/[QC]/);
  });

  it('a single visited dot is a beginning, not yet a thread', () => {
    const { lanes } = computeTimelineLayout(ITEMS, 'Other');
    expect(computeTracePath(lanes, ['a'])).toBeNull();
    expect(computeTracePath(lanes, ['ghost', 'nope'])).toBeNull();
  });

  it('a filtered-out lane drops its dots from the thread', () => {
    // Pre-fix, the hidden Delta dot still counted as a waypoint: with
    // only one visible trace point the overlay must not render at all —
    // a thread through invisible territory is a lie about the map.
    const filtered = renderToStaticMarkup(
      <TimelineMap
        items={ITEMS}
        filter={['Guides']}
        trace={{ ids: ['a', 'd'], label: 'Your thread: 2 read.' }}
        data-testid="map"
      >
        <TimelineMap.Chart />
      </TimelineMap>,
    );
    expect(filtered).not.toContain('timeline-map-trace');
    expect(filtered).not.toContain('Your thread');
  });

  it('renders warm over the cool web: strand-a, drawn, decorative, spoken', () => {
    const html = renderToStaticMarkup(
      <TimelineMap
        items={ITEMS}
        trace={{ ids: ['a', 'd'], label: 'Your thread: 2 of 4 read.' }}
        data-testid="map"
      >
        <TimelineMap.Chart />
      </TimelineMap>,
    );
    expect(html).toMatch(/timeline-map-trace"[^>]*aria-hidden/);
    expect(html).toMatch(/timeline-map-trace"[^>]*class="[^"]*text-strand-a/);
    expect(html).toContain('animate-strand-draw');
    expect(html).toContain('Your thread: 2 of 4 read.');
    // No trace prop → no overlay, no orphaned label (the SSR/crawler view).
    const bare = renderToStaticMarkup(
      <TimelineMap items={ITEMS} data-testid="map">
        <TimelineMap.Chart />
      </TimelineMap>,
    );
    expect(bare).not.toContain('timeline-map-trace');
    expect(bare).not.toContain('Your thread');
  });
});

describe('static markup (SSR honesty)', () => {
  const html = renderToStaticMarkup(
    <TimelineMap items={ITEMS} data-testid="map">
      <TimelineMap.Filter />
      <TimelineMap.Chart />
      <TimelineMap.Detail idle="Hover a dot." />
    </TimelineMap>,
  );

  it('link weave: threads render aria-hidden in strand-b, faint at rest', () => {
    const woven = renderToStaticMarkup(
      <TimelineMap
        items={[
          { id: 'p', href: '/p', label: 'P', category: 'A', date: '2026-01-01', links: ['q'] },
          { id: 'q', href: '/q', label: 'Q', category: 'B', date: '2026-03-01' },
        ]}
        data-testid="map"
      >
        <TimelineMap.Chart />
      </TimelineMap>,
    );
    expect(woven).toContain('data-slot="timeline-map-links"');
    expect(woven).toContain('text-strand-b');
    expect(woven).toContain('opacity-25'); // rest = faint web, no selection
    // decorative overlay never intercepts the pointer or the AT tree
    expect(woven).toMatch(/timeline-map-links"[^>]*aria-hidden/);
    // no links → no overlay at all
    expect(html).not.toContain('timeline-map-links');
  });

  it('renders every item as a real anchor with an accessible name', () => {
    for (const i of ITEMS) {
      expect(html).toContain(`href="${i.href}"`);
    }
    // Exact names — `toContain('label —')` passed even with the audible
    // double-space an absent category used to leave (caught in review).
    expect(html).toContain('aria-label="Alpha — Guides · 2026-01-10"');
    expect(html).toContain('aria-label="Delta — 2026-06-15"');
    expect(html).not.toContain('—  ');
  });

  it('exactly one dot is the roving tab stop', () => {
    expect(html.match(/tabindex="0"/gi)?.length ?? 0).toBe(1);
    expect(html.match(/tabindex="-1"/gi)?.length ?? 0).toBe(ITEMS.length - 1);
  });

  it('filter chips render pressed with counts', () => {
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Guides');
  });

  it('detail strip reserves height and shows the idle slot', () => {
    expect(html).toContain('min-h-12');
    expect(html).toContain('Hover a dot.');
  });

  it('marks use the strand-a token, never raw color', () => {
    expect(html).toContain('text-strand-a');
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders nothing dot-like for an empty items list', () => {
    const empty = renderToStaticMarkup(
      <TimelineMap items={[]} data-testid="map">
        <TimelineMap.Chart />
      </TimelineMap>,
    );
    expect(empty).not.toContain('<circle');
  });
});

describe('number axis', () => {
  const MINUTES: TimelineMapItem[] = [
    { id: 'q', href: '/q', label: 'Quick', category: 'Guides', value: 3 },
    { id: 'm', href: '/m', label: 'Mid', category: 'Guides', value: 8 },
    { id: 'm2', href: '/m2', label: 'Mid Twin', category: 'Guides', value: 8 },
    { id: 'd', href: '/d', label: 'Deep', category: 'Deep dives', value: 21 },
  ];
  const AXIS = { kind: 'number' as const, format: (v: number) => `${v} min` };

  it('positions by value and fans same-(lane,value) collisions', () => {
    const { lanes, order } = computeTimelineLayout(MINUTES, 'Other', 560, AXIS);
    const dots = lanes.flatMap((l) => l.dots);
    const cx = (id: string): number => dots.find((d) => d.item.id === id)!.cx;
    expect(cx('q')).toBeLessThan(cx('m'));
    expect(cx('m')).toBeLessThan(cx('d'));
    // Integer values collide constantly — the beeswarm must fan them.
    const coords = dots.map((d) => `${d.cx},${d.cy}`);
    expect(new Set(coords).size).toBe(coords.length);
    // Traversal order is by value, shortest first.
    expect(order.map((i) => i.id)).toEqual(['q', 'm', 'm2', 'd']);
  });

  it('ticks are nice steps rendered through the format', () => {
    const { ticks } = computeTimelineLayout(MINUTES, 'Other', 560, AXIS);
    expect(ticks.length).toBeGreaterThan(1);
    for (const t of ticks) expect(t.label).toMatch(/^\d+(\.\d+)? min$/);
    // A 3–21 span steps by 5: round labels, not raw data values.
    expect(ticks.map((t) => t.label)).toContain('5 min');
    expect(ticks.map((t) => t.label)).toContain('20 min');
  });

  it('a degenerate span (single shared value) still labels the axis', () => {
    const { ticks } = computeTimelineLayout(
      [
        { id: 'a', href: '/a', label: 'A', category: 'C', value: 7 },
        { id: 'b', href: '/b', label: 'B', category: 'C', value: 7 },
      ],
      'Other',
      560,
      AXIS,
    );
    expect(ticks).toHaveLength(1);
    expect(ticks[0].label).toBe('7 min');
  });

  it('items without a finite value are not rendered; dates are ignored', () => {
    const { order } = computeTimelineLayout(
      [
        { id: 'v', href: '/v', label: 'V', category: 'C', value: 5, date: '2020-01-01' },
        { id: 'no', href: '/no', label: 'No', category: 'C', date: '2026-01-01' },
      ],
      'Other',
      560,
      { kind: 'number' },
    );
    expect(order.map((i) => i.id)).toEqual(['v']);
  });

  it('SSR speaks the formatted value, never the date (aria + Detail)', () => {
    const html = renderToStaticMarkup(
      <TimelineMap items={MINUTES} axis={AXIS} data-testid="m">
        <TimelineMap.Chart />
        <TimelineMap.Detail idle="Hover a dot." />
      </TimelineMap>,
    );
    expect(html).toContain('aria-label="Deep — Deep dives · 21 min"');
    expect(html).not.toContain('2026-');

    // Without a format, values speak as plain numbers (String default).
    const bare = renderToStaticMarkup(
      <TimelineMap items={MINUTES} axis={{ kind: 'number' }} data-testid="m">
        <TimelineMap.Chart />
      </TimelineMap>,
    );
    expect(bare).toContain('aria-label="Deep — Deep dives · 21"');
  });
});

describe('link-weave ink budget', () => {
  const many = (n: number): TimelineMapItem[] => {
    const items: TimelineMapItem[] = [];
    for (let i = 0; i < n + 1; i++) {
      items.push({
        id: `n${i}`,
        href: `/n${i}`,
        label: `N${i}`,
        category: i % 2 ? 'A' : 'B',
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        links: i > 0 ? [`n${i - 1}`] : [],
      });
    }
    return items;
  };

  it('a dense web rests as texture, a sparse one as readable threads', () => {
    const dense = renderToStaticMarkup(
      <TimelineMap items={many(200)} data-testid="m">
        <TimelineMap.Chart />
      </TimelineMap>,
    );
    // 200 edges: the budgeted rest ink, never the sparse 0.25.
    expect(dense).toContain('opacity-[0.04]');
    expect(dense).not.toContain('opacity-25');

    // 80 edges: the middle tier (review — a typo in that branch of
    // restInk was invisible to the two extremes alone).
    const mid = renderToStaticMarkup(
      <TimelineMap items={many(80)} data-testid="m">
        <TimelineMap.Chart />
      </TimelineMap>,
    );
    expect(mid).toContain('opacity-10');
    expect(mid).not.toContain('opacity-25');
    expect(mid).not.toContain('opacity-[0.04]');

    const sparse = renderToStaticMarkup(
      <TimelineMap items={many(3)} data-testid="m">
        <TimelineMap.Chart />
      </TimelineMap>,
    );
    expect(sparse).toContain('opacity-25');
    expect(sparse).not.toContain('opacity-[0.04]');
  });
});

describe('roving focus under filtering', () => {
  it('hiding the FOCUSED lane never traps the keyboard (stale focusedId)', async () => {
    // The real regression path (review round 2 — a static render starts
    // from focusedId=null and takes the same branch fixed or not): arrow
    // to a dot so focusedId is a non-null state, THEN hide that dot's
    // lane. Pre-fix, the stale id left every dot at tabIndex=-1 and the
    // chart fell out of the tab order.
    const user = userEvent.setup();
    const { container, unmount } = render(
      <TimelineMap
        items={[
          { id: 'a1', href: '/a1', label: 'A1', category: 'A', date: '2026-01-01' },
          { id: 'a2', href: '/a2', label: 'A2', category: 'A', date: '2026-02-01' },
          { id: 'b1', href: '/b1', label: 'B1', category: 'B', date: '2026-03-01' },
        ]}
        data-testid="m"
      >
        <TimelineMap.Filter />
        <TimelineMap.Chart />
      </TimelineMap>,
    );
    // Resting tab stop = the newest dot (b1). ArrowLeft moves the roving
    // focus to a2 — lane A, and focusedId is now non-null state.
    const b1 = container.querySelector<HTMLElement>('[data-item-id="b1"]')!;
    b1.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement?.getAttribute('data-item-id')).toBe('a2');
    // Hide lane A — the lane holding the focused dot.
    const chipA = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.startsWith('A') && b.getAttribute('aria-pressed') === 'true',
    )!;
    await user.click(chipA);
    // The trap: zero tab stops. The fix: exactly one, on a VISIBLE dot.
    const stops = [...container.querySelectorAll('[tabindex="0"]')].filter(
      (el) => el.hasAttribute('data-item-id'),
    );
    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute('data-item-id')).toBe('b1');
    unmount();
  });
});
