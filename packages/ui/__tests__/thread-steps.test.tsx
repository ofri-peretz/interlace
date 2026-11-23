/**
 * ThreadSteps: an ordered list held together by the woven thread.
 *
 * Locks what a reader depends on (a real ordered list, the current step
 * marked for assistive tech, every state in words) and what the motion
 * promises: the server HTML is fully drawn, woven strands draw in only when
 * their step is reached, loose strands never move, and reduced motion or a
 * missing IntersectionObserver leaves everything drawn.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { ThreadSteps, ThreadStep, MIN_VIEWPORT } = await import('../src/patterns/thread-steps.js');

let ioCallback: IntersectionObserverCallback | null = null;
const observed: Element[] = [];
const disconnect = vi.fn();

class StubObserver {
  constructor(cb: IntersectionObserverCallback) {
    ioCallback = cb;
  }
  observe(target: Element) {
    observed.push(target);
  }
  unobserve() {}
  disconnect = disconnect;
  takeRecords() {
    return [];
  }
}

const cancel = vi.fn();
const animate = vi.fn(() => ({ cancel }));

beforeEach(() => {
  reduced.value = false;
  ioCallback = null;
  observed.length = 0;
  vi.stubGlobal('IntersectionObserver', StubObserver);
  Object.defineProperty(SVGElement.prototype, 'animate', {
    value: animate,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(SVGElement.prototype, 'getAnimations', {
    value: () => [{ cancel }],
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  animate.mockClear();
  cancel.mockClear();
  disconnect.mockClear();
  delete (SVGElement.prototype as { animate?: unknown }).animate;
  delete (SVGElement.prototype as { getAnimations?: unknown }).getAnimations;
});

const strandPaths = (step: Element) =>
  Array.from(step.querySelectorAll<SVGPathElement>('[data-slot="thread-step-strand"] path'));

function Tracker() {
  return (
    <ThreadSteps data-testid="steps">
      <ThreadSteps.Step title="Find the claim" state="complete">
        Where it was said.
      </ThreadSteps.Step>
      <ThreadSteps.Step title="Read the sources" state="current" />
      <ThreadSteps.Step title="Write the answer" state="upcoming" />
    </ThreadSteps>
  );
}

describe('ThreadSteps', () => {
  it('is a real ordered list that declares its minimum viewport', () => {
    render(<Tracker />);
    const list = screen.getByTestId('steps');
    expect(list.tagName).toBe('OL');
    expect(list.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Where it was said.')).toBeTruthy();
  });

  it('marks the current step for assistive tech and says every state in words', () => {
    render(<Tracker />);
    const items = screen.getAllByRole('listitem');
    expect(items[1]!.getAttribute('aria-current')).toBe('step');
    expect(items[0]!.getAttribute('aria-current')).toBeNull();
    expect(items[0]!.textContent).toContain('(Complete)');
    expect(items[1]!.textContent).toContain('(Current step)');
    expect(items[2]!.textContent).toContain('(Not started)');
  });

  it('weaves after a plain or complete step and leaves a loose strand after the rest', () => {
    render(
      <ThreadSteps>
        <ThreadStep title="Plain" />
        <ThreadStep title="Current" state="current" />
        <ThreadStep title="Upcoming" state="upcoming" />
      </ThreadSteps>,
    );
    const [plain, current, upcoming] = screen.getAllByRole('listitem');
    expect(strandPaths(plain!)).toHaveLength(2);
    expect(strandPaths(current!)).toHaveLength(1);
    expect(strandPaths(current!)[0]!.getAttribute('stroke-dasharray')).toBe('2 4');
    expect(strandPaths(upcoming!)).toHaveLength(1);
    // A plain sequence carries no state text and no state attribute.
    expect(plain!.textContent).toBe('Plain');
    expect(plain!.hasAttribute('data-state')).toBe(false);
  });

  it('keeps the strand and knot out of the accessibility tree', () => {
    render(<Tracker />);
    const step = screen.getAllByRole('listitem')[0]!;
    expect(
      step.querySelector('[data-slot="thread-step-strand"]')!.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(
      step.querySelector('[data-slot="thread-step-knot"]')!.closest('[aria-hidden]'),
    ).not.toBeNull();
  });

  it('ships the server HTML fully drawn', () => {
    const html = renderToStaticMarkup(<Tracker />);
    expect(html).not.toContain('stroke-dashoffset');
  });

  it('hides the woven strands until the step is reached, then draws them', () => {
    render(<Tracker />);
    const step = screen.getAllByRole('listitem')[0]!;
    const paths = strandPaths(step);
    expect(observed).toContain(step);
    expect(paths.every((p) => p.style.strokeDashoffset === '100')).toBe(true);

    act(() =>
      ioCallback!(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(animate).not.toHaveBeenCalled();

    act(() =>
      ioCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(animate).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalled();
    expect(paths.every((p) => p.style.strokeDashoffset === '')).toBe(true);
  });

  it('never animates a loose strand', () => {
    render(
      <ThreadSteps>
        <ThreadStep title="Current" state="current" />
        <ThreadStep title="Upcoming" state="upcoming" />
      </ThreadSteps>,
    );
    expect(observed).toHaveLength(0);
  });

  it('cancels the draw and restores the strands on unmount', () => {
    const { unmount } = render(<Tracker />);
    const paths = strandPaths(screen.getAllByRole('listitem')[0]!);
    unmount();
    expect(cancel).toHaveBeenCalled();
    expect(paths.every((p) => p.style.strokeDashoffset === '')).toBe(true);
  });

  it('cleans up even where getAnimations is missing', () => {
    delete (SVGElement.prototype as { getAnimations?: unknown }).getAnimations;
    const { unmount } = render(<Tracker />);
    unmount();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('stays drawn under reduced motion', () => {
    reduced.value = true;
    render(<Tracker />);
    expect(observed).toHaveLength(0);
    expect(strandPaths(screen.getAllByRole('listitem')[0]!)[0]!.style.strokeDashoffset).toBe('');
  });

  it('stays drawn without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Tracker />);
    expect(strandPaths(screen.getAllByRole('listitem')[0]!)[0]!.style.strokeDashoffset).toBe('');
  });

  it('stays drawn where SVG cannot animate', () => {
    delete (SVGElement.prototype as { animate?: unknown }).animate;
    render(<Tracker />);
    expect(observed).toHaveLength(0);
  });

  it('merges className and forwards props on both parts', () => {
    render(
      <ThreadSteps className="extra-list" aria-label="How we check">
        <ThreadStep title="One" className="extra-step" id="step-one" />
      </ThreadSteps>,
    );
    const list = screen.getByRole('list', { name: 'How we check' });
    expect(list.className).toContain('extra-list');
    const step = screen.getByRole('listitem');
    expect(step.className).toContain('extra-step');
    expect(step.id).toBe('step-one');
  });
});
