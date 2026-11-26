/**
 * Quadrant: two questions at once on a 2 x 2 grid. The model, the phone
 * pad (pointer, keys, words) and the screen map.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cellOf,
  cleanPoints,
  nudgePoint,
  quadrantShift,
  quarterOf,
  summarizeQuadrant,
} from '../src/games/quadrant-model.js';
import { MIN_VIEWPORT, Quadrant, QuadrantMap } from '../src/games/quadrant.js';

// jsdom has no PointerEvent; MouseEvent carries the coordinates the pad reads.
if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

afterEach(() => {
  cleanup();
  reduced.value = false;
  vi.restoreAllMocks();
});

const axes = { x: ['Easy', 'Hard'], y: ['Less useful', 'More useful'] } as const;

describe('quadrant-model', () => {
  it('cleans, places and bins dots', () => {
    expect(cleanPoints([{ x: 120, y: -5 }, { x: Number.NaN, y: 3 }, null as never])).toEqual([{ x: 100, y: 0 }]);
    expect(quarterOf({ x: 50, y: 50 })).toBe('top-end');
    expect(quarterOf({ x: 49, y: 49 })).toBe('bottom-start');
    expect(cellOf({ x: 0, y: 100 }, 4)).toEqual([0, 0]);
    expect(cellOf({ x: 100, y: 0 }, 4)).toEqual([3, 3]);
    expect(cellOf({ x: 30, y: 30 }, 0)).toEqual([0, 0]);
  });

  it('summarizes a room: quarters, cells, the most, middle and mean', () => {
    const s = summarizeQuadrant(
      [
        { x: 80, y: 90 },
        { x: 70, y: 70 },
        { x: 10, y: 20 },
      ],
      { cells: 2 },
    );
    expect(s.count).toBe(3);
    expect(s.quarters).toEqual({ 'top-start': 0, 'top-end': 2, 'bottom-start': 1, 'bottom-end': 0 });
    expect(s.most).toBe('top-end');
    expect(s.cells).toEqual([
      [0, 2],
      [1, 0],
    ]);
    expect(s.peak).toBe(2);
    expect(s.median).toEqual({ x: 70, y: 70 });
    expect(s.mean?.x).toBeCloseTo(160 / 3);
    // A tie is no winner; nobody is no picture.
    expect(
      summarizeQuadrant([
        { x: 10, y: 10 },
        { x: 90, y: 90 },
      ]).most,
    ).toBeNull();
    expect(summarizeQuadrant([])).toMatchObject({ count: 0, most: null, peak: 0, mean: null, median: null });
  });

  it('measures the shift and is the same in any order', () => {
    expect(quadrantShift([{ x: 20, y: 20 }], [{ x: 70, y: 40 }])).toEqual({ x: 50, y: 20 });
    expect(quadrantShift([], [{ x: 1, y: 1 }])).toBeNull();
    const room = Array.from({ length: 60 }, (_, i) => ({ x: (i * 37) % 101, y: (i * 53) % 101 }));
    expect(summarizeQuadrant([...room].reverse())).toEqual(summarizeQuadrant(room));
  });

  it('nudges with keys, mirrored in right to left, never off the grid', () => {
    const p = { x: 50, y: 50 };
    expect(nudgePoint(p, 'ArrowRight')).toEqual({ x: 55, y: 50 });
    expect(nudgePoint(p, 'ArrowRight', 5, 'rtl')).toEqual({ x: 45, y: 50 });
    expect(nudgePoint(p, 'ArrowLeft')).toEqual({ x: 45, y: 50 });
    expect(nudgePoint(p, 'ArrowUp', 10)).toEqual({ x: 50, y: 60 });
    expect(nudgePoint({ x: 50, y: 2 }, 'ArrowDown')).toEqual({ x: 50, y: 0 });
    expect(nudgePoint(p, 'Home')).toEqual({ x: 0, y: 50 });
    expect(nudgePoint(p, 'End')).toEqual({ x: 100, y: 50 });
    expect(nudgePoint(p, 'PageUp')).toEqual({ x: 50, y: 100 });
    expect(nudgePoint(p, 'PageDown')).toEqual({ x: 50, y: 0 });
    expect(nudgePoint(p, 'a')).toBeNull();
  });
});

describe('Quadrant', () => {
  it('moves the dot by keys, says where it is, and places once', () => {
    const onPlace = vi.fn();
    const { container } = render(<Quadrant prompt="This topic is…" axes={axes} onPlace={onPlace} />);
    expect(container.querySelector('[data-slot="quadrant"]')?.getAttribute('data-min-viewport')).toBe(
      String(MIN_VIEWPORT),
    );
    expect(screen.getByRole('group', { name: 'This topic is…' })).toBeTruthy();
    const dot = screen.getByRole('button', { name: 'In the middle' });
    expect(dot.getAttribute('aria-describedby')).toBeTruthy();
    for (let i = 0; i < 4; i++) fireEvent.keyDown(dot, { key: 'ArrowRight' });
    fireEvent.keyDown(dot, { key: 'PageUp' });
    fireEvent.keyDown(dot, { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(dot, { key: 'Tab' });
    expect(dot.getAttribute('aria-label')).toBe('Closer to Hard, closer to More useful');
    expect(container.querySelector('[data-slot="quadrant-announce"]')?.textContent).toBe(
      'Closer to Hard, closer to More useful',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Place my dot' }));
    expect(onPlace).toHaveBeenCalledWith({ x: 70, y: 99 });
    expect(container.querySelector('[data-slot="quadrant"]')?.getAttribute('data-state')).toBe('placed');
    const result = container.querySelector('[data-slot="quadrant-result"]') as HTMLElement;
    expect(result.textContent).toBe(
      '1 person placed a dot. Most are in More useful and Hard. Yours: Closer to Hard, closer to More useful.',
    );
    expect(document.activeElement).toBe(result);
    expect(container.querySelector('[data-slot="quadrant-chart"]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('follows a pointer, mirrored in right to left', () => {
    const onPlace = vi.fn();
    const { container } = render(<Quadrant prompt="Q" axes={axes} onPlace={onPlace} />);
    const pad = container.querySelector('[data-slot="quadrant-pad"]') as HTMLElement;
    pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    fireEvent.pointerDown(pad, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 180, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    // After the finger lifts, moving does nothing.
    fireEvent.pointerMove(pad, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Place my dot' }));
    expect(onPlace).toHaveBeenLastCalledWith({ x: 90, y: 90 });
    cleanup();

    const again = vi.fn();
    const r = render(
      <div dir="rtl" style={{ direction: 'rtl' }}>
        <Quadrant prompt="Q" axes={axes} onPlace={again} />
      </div>,
    );
    const pad2 = r.container.querySelector('[data-slot="quadrant-pad"]') as HTMLElement;
    pad2.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    fireEvent.pointerDown(pad2, { clientX: 180, clientY: 300, pointerId: 2 });
    fireEvent.pointerCancel(pad2, { pointerId: 2 });
    const dot = screen.getByRole('button', { name: /^Closer to Easy/ });
    fireEvent.keyDown(dot, { key: 'ArrowLeft' });
    fireEvent.click(screen.getByRole('button', { name: 'Place my dot' }));
    // 180 of 200 from the left is near the start in right to left; ArrowLeft moves toward the end.
    expect(again).toHaveBeenCalledWith({ x: 15, y: 0 });
  });

  it('ignores a pad with no size', () => {
    const onPlace = vi.fn();
    const { container } = render(<Quadrant prompt="Q" axes={axes} onPlace={onPlace} />);
    const pad = container.querySelector('[data-slot="quadrant-pad"]') as HTMLElement;
    fireEvent.pointerDown(pad, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Place my dot' }));
    expect(onPlace).toHaveBeenCalledWith({ x: 50, y: 50 });
  });

  it('waits for enough dots, then shows the room with before', () => {
    const room = [
      { x: 20, y: 20 },
      { x: 25, y: 30 },
    ];
    const { container, rerender } = render(
      <Quadrant prompt="Q" axes={axes} points={room} value={{ x: 30, y: 20 }} minResponses={5} />,
    );
    expect(screen.getByText('Thanks. The room shows once 5 people have placed a dot.')).toBeTruthy();
    expect(container.querySelector('[data-slot="quadrant-chart"]')).toBeNull();
    rerender(
      <Quadrant
        prompt="Q"
        axes={axes}
        points={[...room, { x: 30, y: 20 }]}
        pointsIncludeOwn
        value={{ x: 30, y: 20 }}
        before={[{ x: 80, y: 80 }]}
        minResponses={3}
        labels={{ result: (r) => `${r.count}|${r.most}|${r.mine}|${r.moved}` }}
      />,
    );
    expect(screen.getByText('3|Less useful and Easy|Closer to Easy, closer to Less useful|true')).toBeTruthy();
    expect(container.querySelector('[data-slot="quadrant-before"]')).toBeTruthy();
    expect(
      [...container.querySelectorAll('[data-slot="quadrant-count"]')].map((el) => [
        el.getAttribute('data-quarter'),
        el.textContent,
      ]),
    ).toEqual([
      ['top-start', '0'],
      ['top-end', '0'],
      ['bottom-start', '3'],
      ['bottom-end', '0'],
    ]);
  });

  it('plays the arrival only once placed here, and not under reduced motion', () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    render(<Quadrant prompt="Q" axes={axes} points={[{ x: 90, y: 90 }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Place my dot' }));
    expect(animate).toHaveBeenCalledTimes(2);
    cleanup();
    animate.mockClear();
    reduced.value = true;
    render(<Quadrant prompt="Q" axes={axes} points={[{ x: 90, y: 90 }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Place my dot' }));
    expect(animate).not.toHaveBeenCalled();
    cleanup();
    // Arriving already placed (a refresh) does not replay it.
    reduced.value = false;
    render(<Quadrant prompt="Q" axes={axes} points={[{ x: 90, y: 90 }]} defaultValue={{ x: 10, y: 10 }} />);
    expect(animate).not.toHaveBeenCalled();
  });
});

describe('QuadrantMap', () => {
  it('draws the room for a screen, in one sentence', () => {
    const points = Array.from({ length: 60 }, (_, i) => ({ x: 60 + (i % 40), y: 55 + (i % 45) }));
    const { container } = render(<QuadrantMap axes={axes} points={points} size="stage" locale="en-US" />);
    expect(container.querySelector('[data-slot="quadrant-map"]')?.getAttribute('data-min-viewport')).toBe(
      String(MIN_VIEWPORT),
    );
    expect(screen.getByText('60 people placed a dot. Most are in More useful and Hard.')).toBeTruthy();
    expect(container.querySelector('[data-slot="quadrant-mine"]')).toBeNull();
    cleanup();
    render(<QuadrantMap axes={axes} points={[]} />);
    expect(screen.getByText('No dots yet.')).toBeTruthy();
    cleanup();
    render(
      <QuadrantMap
        axes={axes}
        points={[
          { x: 10, y: 90 },
          { x: 90, y: 10 },
        ]}
        labels={{ empty: '-' }}
      />,
    );
    expect(screen.getByText('2 people placed a dot. The room is spread out.')).toBeTruthy();
  });
});
