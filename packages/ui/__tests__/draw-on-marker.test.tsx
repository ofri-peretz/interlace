/**
 * DrawOn and Marker: editorial motion that draws something the server already
 * rendered in full. jsdom cannot show a line being drawn; it can show what
 * each component asks the browser for, which is what these tests pin.
 */
import { act, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { DrawOn } = await import('../src/effects/draw-on.js');
const { Marker } = await import('../src/effects/marker.js');

let intersect: (visible: boolean) => void = () => {};
let threshold: number | number[] | undefined;

class ControlledObserver {
  constructor(cb: IntersectionObserverCallback, init?: IntersectionObserverInit) {
    threshold = init?.threshold;
    intersect = (visible) =>
      cb([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const animateSpy = vi.fn(() => ({ cancel: vi.fn(), onfinish: null as null | (() => void) }));

beforeEach(() => {
  reduced.value = false;
  threshold = undefined;
  vi.stubGlobal('IntersectionObserver', ControlledObserver);
  animateSpy.mockClear();
  (Element.prototype as unknown as { animate: unknown }).animate = animateSpy;
  (SVGElement.prototype as unknown as { getTotalLength: () => number }).getTotalLength = () => 100;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as unknown as { animate?: unknown }).animate;
  delete (SVGElement.prototype as unknown as { getTotalLength?: unknown }).getTotalLength;
});

function Drawing({ order }: { order?: 'sequence' | 'together' }) {
  return (
    <DrawOn order={order} duration={1000} stagger={100} delay={50}>
      <svg viewBox="0 0 10 10" role="img" aria-label="A bridge">
        <path d="M0 0 L10 10" style={{ stroke: 'black', fill: 'none' }} />
        <circle cx="5" cy="5" r="2" style={{ stroke: 'black', fill: 'red' }} />
        <rect width="2" height="2" style={{ stroke: 'none', fill: 'blue' }} />
      </svg>
    </DrawOn>
  );
}

describe('DrawOn', () => {
  it('renders the finished drawing on the server, with the SVG untouched', () => {
    const html = renderToStaticMarkup(<Drawing />);
    expect(html).toContain('data-slot="draw-on"');
    expect(html).toContain('aria-label="A bridge"');
    expect(html).not.toContain('stroke-dash');
    expect(html).not.toContain('opacity');
  });

  it('hides each line before paint and draws them in order once in view', () => {
    const { container } = render(<Drawing />);
    const path = container.querySelector('path')!;
    const circle = container.querySelector('circle')!;
    const rect = container.querySelector('rect')!;
    expect(path.style.strokeDashoffset).toBe('100');
    expect(circle.style.fillOpacity).toBe('0');
    expect(rect.style.opacity).toBe('0');
    expect(threshold).toBe(0.3);

    act(() => intersect(true));
    const root = container.querySelector<HTMLElement>('[data-slot="draw-on"]')!;
    expect(root.dataset.drawn).toBe('true');
    const delays = animateSpy.mock.calls.map((c) => (c as unknown[])[1] as KeyframeAnimationOptions);
    // Two lines a stagger apart, the circle's fill after its outline, the rect at the end.
    expect(delays[0]).toMatchObject({ delay: 50, duration: 1000 });
    expect(delays[1]).toMatchObject({ delay: 150, duration: 1000 });
    expect(delays.length).toBe(4);
    expect(rect.style.opacity).toBe('');
    // When a line finishes, its dash styles go, so the drawing ends exactly as authored.
    const line = animateSpy.mock.results[0]!.value as { cancel: () => void; onfinish: null | (() => void) };
    line.onfinish?.();
    expect(path.style.strokeDasharray).toBe('');
    expect(path.style.strokeDashoffset).toBe('');
    expect(line.cancel).toHaveBeenCalled();
  });

  it('shows the drawing at once when focus lands inside', () => {
    const { container } = render(
      <DrawOn>
        <svg>
          <path d="M0 0 L1 1" style={{ stroke: 'black' }} />
          <a href="#x">
            <text>Read the survey</text>
          </a>
        </svg>
      </DrawOn>,
    );
    const path = container.querySelector('path')!;
    expect(path.style.strokeDashoffset).toBe('100');
    act(() => container.querySelector<HTMLElement>('[data-slot="draw-on"]')!.dispatchEvent(new FocusEvent('focusin')));
    expect(path.style.strokeDashoffset).toBe('');
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it('is simply there under reduced motion', () => {
    reduced.value = true;
    const { container } = render(<Drawing />);
    expect(container.querySelector('path')!.style.strokeDashoffset).toBe('');
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it('draws only once, even when its props change', () => {
    const { container, rerender } = render(<Drawing />);
    act(() => intersect(true));
    animateSpy.mockClear();
    rerender(<Drawing order="together" />);
    expect(container.querySelector('path')!.style.strokeDashoffset).toBe('');
    expect(animateSpy).not.toHaveBeenCalled();
  });
});

describe('Marker', () => {
  it('is a <mark> with its stroke in the server HTML', () => {
    const html = renderToStaticMarkup(<Marker>the one phrase</Marker>);
    expect(html).toMatch(/^<mark data-slot="marker" data-variant="band" data-tone="highlight"/);
    expect(html).toContain('the one phrase');
    expect(html).not.toContain('style=');
  });

  it('takes the stroke away before paint and sweeps it in once in view', () => {
    const { container } = render(<Marker delay={0}>phrase</Marker>);
    const mark = container.querySelector<HTMLElement>('[data-slot="marker"]')!;
    expect(mark.style.backgroundSize.startsWith('0%')).toBe(true);
    act(() => intersect(true));
    expect(mark.style.backgroundSize).toBe('');
    expect(mark.dataset.marked).toBe('true');
    const [frames, options] = animateSpy.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
    expect(String(frames[0]!.backgroundSize).startsWith('0%')).toBe(true);
    expect(String(frames[1]!.backgroundSize).startsWith('100%')).toBe(true);
    expect(options).toMatchObject({ delay: 0, duration: 700 });
  });

  it('starts at the inline-start edge in both directions', () => {
    const { container } = render(<Marker variant="underline">phrase</Marker>);
    const cls = container.querySelector('mark')!.getAttribute('class')!;
    expect(cls).toContain('bg-[position:0_100%]');
    expect(cls).toContain('rtl:bg-[position:100%_100%]');
  });

  it('keeps the text colour and falls back to an underline in forced colours', () => {
    const { container } = render(<Marker tone="primary">phrase</Marker>);
    const cls = container.querySelector('mark')!.getAttribute('class')!;
    expect(cls).toContain('text-inherit');
    expect(cls).toContain('forced-colors:underline');
    expect(cls).toContain('var(--primary)');
  });

  it('is simply there under reduced motion', () => {
    reduced.value = true;
    const { container } = render(<Marker>phrase</Marker>);
    expect(container.querySelector('mark')!.style.backgroundSize).toBe('');
    expect(animateSpy).not.toHaveBeenCalled();
  });
});
