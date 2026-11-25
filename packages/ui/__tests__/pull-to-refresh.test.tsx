/**
 * PullToRefresh: the damped pull, arming at the threshold, the refresh
 * promise and its words, the button twin, and the moves that are not a pull.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dampPull, MIN_VIEWPORT, PullToRefresh } from '../src/patterns/pull-to-refresh.js';

function mockReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

const touch = (x: number, y: number) => ({ clientX: x, clientY: y, identifier: 0 }) as unknown as Touch;

function pull(el: HTMLElement, path: Array<[number, number]>, opts: { end?: 'touchend' | 'touchcancel' } = {}) {
  const [first, ...rest] = path;
  fireEvent.touchStart(el, { touches: [touch(...first!)] });
  for (const p of rest) fireEvent.touchMove(el, { touches: [touch(...p)] });
  fireEvent[opts.end === 'touchcancel' ? 'touchCancel' : 'touchEnd'](el, { touches: [] });
}

function region(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-slot="pull-to-refresh"]')!;
}

beforeEach(() => {
  mockReducedMotion(false);
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('dampPull', () => {
  it('is half speed to the threshold, a fifth past it, and stops at one and a half', () => {
    expect(dampPull(-10, 64)).toBe(0);
    expect(dampPull(100, 64)).toBe(50);
    expect(dampPull(228, 64)).toBe(74);
    expect(dampPull(10_000, 64)).toBe(96);
  });
});

describe('PullToRefresh', () => {
  it('is a busy-aware region with a Refresh button twin and a live region', async () => {
    let resolve!: () => void;
    const onRefresh = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { container } = render(
      <PullToRefresh onRefresh={onRefresh} className="extra">
        <p>List</p>
      </PullToRefresh>,
    );
    const root = region(container);
    expect(root.className).toContain('extra');
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(root.getAttribute('data-state')).toBe('idle');
    const button = screen.getByRole('button', { name: 'Refresh' });
    fireEvent.click(button);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(root.getAttribute('data-state')).toBe('refreshing');
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Refreshing');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    // A second refresh while one runs does nothing.
    pull(root, [[0, 0], [0, 400]]);
    fireEvent.click(button);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    expect(screen.getByRole('status').textContent).toBe('Updated');
    expect(root.getAttribute('data-state')).toBe('settling');
    expect(root.style.getPropertyValue('--pull')).toBe('0px');
  });

  it('refreshes after a pull past the threshold, then settles back to idle', async () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();
    const { container } = render(
      <PullToRefresh onRefresh={onRefresh} threshold={40} labels={{ done: 'Up to date' }}>
        <p>List</p>
      </PullToRefresh>,
    );
    const root = region(container);
    fireEvent.touchStart(root, { touches: [touch(0, 0)] });
    fireEvent.touchMove(root, { touches: [touch(1, 2)] }); // inside the slack
    expect(root.getAttribute('data-state')).toBe('idle');
    fireEvent.touchMove(root, { touches: [touch(0, 46)] });
    expect(root.getAttribute('data-state')).toBe('pulling');
    expect(root.style.getPropertyValue('--pull')).toBe('20px');
    // A move the browser will not let us cancel (already scrolling) still tracks the pull.
    fireEvent.touchMove(root, { touches: [touch(0, 300)], cancelable: false });
    expect(root.getAttribute('data-state')).toBe('armed');
    fireEvent.touchMove(root, { touches: [touch(0, 310)] });
    expect(root.getAttribute('data-state')).toBe('armed');
    await act(async () => {
      fireEvent.touchEnd(root, { touches: [] });
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toBe('Up to date');
    act(() => vi.advanceTimersByTime(250));
    expect(root.getAttribute('data-state')).toBe('idle');
  });

  it('springs back without refreshing when released early', () => {
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh}>x</PullToRefresh>);
    const root = region(container);
    pull(
      root,
      [
        [0, 0],
        [0, 40],
      ],
      { end: 'touchcancel' },
    );
    expect(onRefresh).not.toHaveBeenCalled();
    expect(root.getAttribute('data-state')).toBe('settling');
  });

  it('never refreshes when the system cancels the gesture, even past the threshold', () => {
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh}>x</PullToRefresh>);
    const root = region(container);
    pull(
      root,
      [
        [0, 0],
        [0, 400],
      ],
      { end: 'touchcancel' },
    );
    expect(onRefresh).not.toHaveBeenCalled();
    expect(root.getAttribute('data-state')).toBe('settling');
    // A cancel with no pull under way changes nothing.
    fireEvent.touchCancel(root, { touches: [] });
    expect(root.getAttribute('data-state')).toBe('settling');
  });

  it('says so when the refresh fails', async () => {
    const onRefresh = vi.fn(() => Promise.reject(new Error('offline')));
    render(<PullToRefresh onRefresh={onRefresh}>x</PullToRefresh>);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    });
    expect(screen.getByRole('status').textContent).toBe('Could not refresh');
  });

  it('ignores swipes up, swipes across, two fingers, taps and pages not at their top', () => {
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh}>x</PullToRefresh>);
    const root = region(container);
    pull(root, [[0, 100], [0, 0]]); // up
    pull(root, [[0, 0], [100, 20]]); // across
    pull(root, [[0, 0]]); // a tap
    fireEvent.touchMove(root, { touches: [touch(0, 300)] }); // a move with no start
    fireEvent.touchStart(root, { touches: [touch(0, 0), touch(5, 5)] });
    fireEvent.touchMove(root, { touches: [touch(0, 300)] });
    fireEvent.touchEnd(root, { touches: [] });
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
    pull(root, [[0, 0], [0, 400]]);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(root.getAttribute('data-state')).toBe('idle');
  });

  it('does nothing while disabled, and can leave the button to the page', () => {
    const onRefresh = vi.fn();
    const { container, rerender } = render(
      <PullToRefresh onRefresh={onRefresh} disabled>
        x
      </PullToRefresh>,
    );
    pull(region(container), [[0, 0], [0, 400]]);
    expect(onRefresh).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Refresh' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <PullToRefresh onRefresh={onRefresh} button="hidden">
        x
      </PullToRefresh>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the content still under reduced motion', () => {
    mockReducedMotion(true);
    const { container } = render(<PullToRefresh onRefresh={vi.fn()}>x</PullToRefresh>);
    const root = region(container);
    fireEvent.touchStart(root, { touches: [touch(0, 0)] });
    fireEvent.touchMove(root, { touches: [touch(0, 60)] });
    const content = container.querySelector('[data-slot="pull-to-refresh-content"]')!;
    expect(content.className).not.toContain('translate-y-(--pull)');
    const indicator = container.querySelector('[data-slot="pull-to-refresh-indicator"]')!;
    expect(indicator.className).toContain('translate-y-2');
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
  });

  it('stops quietly when unmounted mid-refresh', async () => {
    let resolve!: () => void;
    const { unmount } = render(
      <PullToRefresh onRefresh={() => new Promise<void>((r) => (resolve = r))}>x</PullToRefresh>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    unmount();
    await act(async () => resolve());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('drops a pending settle when a new refresh starts', () => {
    vi.useFakeTimers();
    const { container } = render(<PullToRefresh onRefresh={() => new Promise<void>(() => {})}>x</PullToRefresh>);
    const root = region(container);
    pull(root, [
      [0, 0],
      [0, 40],
    ]);
    expect(root.getAttribute('data-state')).toBe('settling');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    act(() => vi.advanceTimersByTime(250));
    expect(root.getAttribute('data-state')).toBe('refreshing');
  });
});

describe('PullToRefresh in a narrow page', () => {
  it('renders its children inside the moving content', () => {
    render(
      <PullToRefresh onRefresh={vi.fn()}>
        <ul>
          <li>One</li>
        </ul>
      </PullToRefresh>,
    );
    expect(screen.getByRole('listitem').closest('[data-slot="pull-to-refresh-content"]')).not.toBeNull();
    expect(React.isValidElement(<PullToRefresh onRefresh={vi.fn()} />)).toBe(true);
  });
});
