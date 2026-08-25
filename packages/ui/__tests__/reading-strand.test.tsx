import { act, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
/**
 * ReadingStrand locks — the pure progress math, the SSR/CLS contract
 * (progressbar at scaleX(0)), and the rAF-throttled scroll wiring.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ReadingStrand,
  readingProgress,
} from '../src/primitives/reading-strand.js';

describe('readingProgress', () => {
  it('maps the read span linearly onto 0→1 and clamps both ends', () => {
    // 2000px span in a 1000px viewport: total travel = 1000.
    expect(readingProgress(0, 2000, 1000)).toBe(0);
    expect(readingProgress(-500, 2000, 1000)).toBe(0.5);
    expect(readingProgress(-1000, 2000, 1000)).toBe(1);
    expect(readingProgress(200, 2000, 1000)).toBe(0); // above the span
    expect(readingProgress(-5000, 2000, 1000)).toBe(1); // far past it
  });

  it('a span no taller than the viewport is already fully read', () => {
    expect(readingProgress(100, 800, 1000)).toBe(1);
  });
});

describe('SSR / CLS contract', () => {
  it('renders a named progressbar at scaleX(0) in the strand token', () => {
    const html = renderToStaticMarkup(<ReadingStrand data-testid="rs" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Reading progress"');
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain('scaleX(0)');
    expect(html).toContain('bg-strand-a');
    expect(html).toContain('pointer-events-none');
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('label overrides the accessible name', () => {
    const html = renderToStaticMarkup(
      <ReadingStrand data-testid="rs" label="Article progress" />,
    );
    expect(html).toContain('aria-label="Article progress"');
  });
});

describe('scroll wiring', () => {
  let frames: FrameRequestCallback[];
  const flushFrames = (): void => {
    const pending = frames;
    frames = [];
    act(() => pending.forEach((cb) => cb(0)));
  };

  beforeEach(() => {
    frames = [];
    let id = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return ++id;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('innerHeight', 1000);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const spanAt = (top: number): void => {
    vi.spyOn(
      document.getElementById('article')!,
      'getBoundingClientRect',
    ).mockReturnValue({ top, height: 2000 } as DOMRect);
  };

  it('tracks the target element, one measure per frame', () => {
    const host = document.createElement('div');
    host.id = 'article';
    document.body.appendChild(host);
    spanAt(0);
    const { getByRole, unmount } = render(
      <ReadingStrand data-testid="rs" target="article" />,
    );
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');

    spanAt(-500);
    // Two scrolls inside one frame coalesce into a single measure.
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
    });
    expect(frames).toHaveLength(1);
    flushFrames();
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    unmount();
    host.remove();
  });

  it('falls back to the document when the target id does not exist', () => {
    vi.spyOn(
      document.documentElement,
      'getBoundingClientRect',
    ).mockReturnValue({ top: -1000, height: 2000 } as DOMRect);
    const { getByRole, unmount } = render(
      <ReadingStrand data-testid="rs" target="missing" />,
    );
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    unmount();
  });

  it('a pending frame is cancelled on unmount', () => {
    const { unmount } = render(<ReadingStrand data-testid="rs" />);
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(frames).toHaveLength(1);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
