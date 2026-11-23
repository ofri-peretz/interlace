/**
 * Interlace effects contract.
 *
 * Every effect in `src/effects/` is decoration: hidden from assistive tech,
 * never in the way of the pointer, coloured from tokens, and still under
 * `prefers-reduced-motion: reduce`. jsdom cannot show that anything looks
 * right; it can show what each component asks the browser for, which is what
 * these tests pin.
 */
import { act, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { Starfield } = await import('../src/effects/starfield.js');
const { GradientMesh } = await import('../src/effects/gradient-mesh.js');
const { LightBeam } = await import('../src/effects/light-beam.js');
const { ThreadLines, threadPaths } = await import('../src/effects/thread-lines.js');
const { SkyBackdrop } = await import('../src/effects/sky-backdrop.js');
const { RotatingText } = await import('../src/effects/rotating-text.js');
const { FocusGrid } = await import('../src/patterns/focus-grid.js');
const { HeroCosmic } = await import('../src/patterns/hero-cosmic.js');

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function stubCanvas() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setTransform: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  return ctx;
}

const animateSpy = vi.fn(() => ({ play: vi.fn(), pause: vi.fn(), cancel: vi.fn() }));

beforeEach(() => {
  reduced.value = false;
  vi.stubGlobal('IntersectionObserver', StubObserver);
  vi.stubGlobal('ResizeObserver', StubObserver);
  animateSpy.mockClear();
  (Element.prototype as unknown as { animate: unknown }).animate = animateSpy;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete (Element.prototype as unknown as { animate?: unknown }).animate;
});

describe('every effect is hidden from assistive tech and the pointer', () => {
  it.each([
    ['Starfield', () => <Starfield />, '[data-slot="starfield"]'],
    ['LightBeam', () => <LightBeam />, '[data-slot="light-beam"]'],
    ['ThreadLines', () => <ThreadLines />, '[data-slot="thread-lines"]'],
    ['GradientMesh', () => <GradientMesh />, '[data-slot="gradient-mesh-glows"]'],
    ['SkyBackdrop', () => <SkyBackdrop />, '[data-slot="sky-backdrop"] > [aria-hidden]'],
  ] as const)('%s', (_name, make, selector) => {
    stubCanvas();
    const { container } = render(make());
    const layer = container.querySelector(selector)!;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.getAttribute('class')).toContain('pointer-events-none');
  });

  it('cannot be un-hidden by a caller', () => {
    stubCanvas();
    // @ts-expect-error aria-hidden is omitted from the props on purpose
    const { container } = render(<LightBeam aria-hidden={false} />);
    expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Starfield', () => {
  it('runs one frame loop and stops it on unmount', () => {
    stubCanvas();
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = render(<Starfield />);
    expect(raf).toHaveBeenCalledTimes(1);
    unmount();
    expect(cancel).toHaveBeenCalledWith(42);
  });

  it('paints once and requests no frame under reduced motion', () => {
    reduced.value = true;
    const ctx = stubCanvas();
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    render(<Starfield />);
    expect(raf).not.toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('names tokens, never a literal colour', () => {
    const src = readFileSync(resolve(__dirname, '../src/effects/starfield.tsx'), 'utf8');
    expect(src).toContain("'var(--hero-star)'");
    expect(src).not.toMatch(/['"]#[0-9a-f]{3,8}['"]/i);
  });
});

describe('GradientMesh, ThreadLines and SkyBackdrop animate only when allowed', () => {
  it.each([
    ['GradientMesh', () => <GradientMesh />],
    ['ThreadLines', () => <ThreadLines />],
    ['SkyBackdrop', () => <SkyBackdrop />],
  ] as const)('%s asks for animations when motion is allowed', (_name, make) => {
    render(make());
    expect(animateSpy).toHaveBeenCalled();
  });

  it.each([
    ['GradientMesh', () => <GradientMesh />],
    ['ThreadLines', () => <ThreadLines />],
    ['SkyBackdrop', () => <SkyBackdrop />],
  ] as const)('%s asks for none under reduced motion', (_name, make) => {
    reduced.value = true;
    render(make());
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it('GradientMesh defaults its glows to theme tokens', () => {
    const { container } = render(<GradientMesh animated={false} />);
    const styles = [...container.querySelectorAll('[data-slot="gradient-mesh-glows"] > span')].map(
      (n) => n.getAttribute('style') ?? '',
    );
    expect(styles.join(' ')).toContain('var(--primary)');
    expect(styles.join(' ')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('ThreadLines', () => {
  it('draws the same bundle for the same seed, on the server too', () => {
    expect(threadPaths(5, 11)).toEqual(threadPaths(5, 11));
    expect(threadPaths(5, 11)).not.toEqual(threadPaths(5, 12));
    expect(renderToStaticMarkup(<ThreadLines seed={11} count={5} />)).toContain(threadPaths(5, 11)[0]);
  });

  it('strokes with the strand tokens', () => {
    const { container } = render(<ThreadLines count={2} animated={false} />);
    const strokes = [...container.querySelectorAll('[data-slot="thread-lines-thread"]')].map((p) =>
      p.getAttribute('stroke'),
    );
    expect(strokes).toEqual(['var(--strand-a)', 'var(--strand-b)']);
  });
});

describe('LightBeam', () => {
  it('renders on the server with no script', () => {
    const html = renderToStaticMarkup(<LightBeam origin="top-left" />);
    expect(html).toContain('conic-gradient');
    expect(html).toContain('data-origin="top-left"');
  });
});

describe('RotatingText', () => {
  it('reserves the widest word and gives assistive tech one stable label', () => {
    render(<RotatingText words={['teams', 'founders', 'students']} />);
    expect(screen.getByText('teams, founders or students').className).toContain('sr-only');
    const words = document.querySelectorAll('[data-slot="rotating-text-word"]');
    expect(words).toHaveLength(3);
    for (const w of words) expect(w.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('[data-current]')?.textContent).toBe('teams');
  });

  it('rotates on its interval', () => {
    vi.useFakeTimers();
    render(<RotatingText words={['a', 'b']} interval={1000} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.querySelector('[data-current]')?.textContent).toBe('b');
  });

  it('holds the first word under reduced motion', () => {
    reduced.value = true;
    vi.useFakeTimers();
    render(<RotatingText words={['a', 'b']} interval={1000} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(document.querySelector('[data-current]')?.textContent).toBe('a');
  });
});

describe('FocusGrid', () => {
  it('is a list of cards, one link per card, rendered on the server', () => {
    const html = renderToStaticMarkup(
      <FocusGrid>
        <FocusGrid.Item media={<img src="a.jpg" alt="" />} title="Lisbon" href="/lisbon" />
        <FocusGrid.Item media={<img src="b.jpg" alt="" />} title="Porto" />
      </FocusGrid>,
    );
    expect(html).toContain('<ul data-slot="focus-grid"');
    expect(html.match(/<li[ >]/g)).toHaveLength(2);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain(':has(');
  });

  it('keeps the dimming that carries meaning outside motion-safe', () => {
    const { container } = render(
      <FocusGrid>
        <FocusGrid.Item media={null} title="A" />
      </FocusGrid>,
    );
    const classes = container.firstElementChild!.className.split(/\s+/);
    expect(classes.some((c) => c.endsWith(':opacity-55') && !c.startsWith('motion-safe:'))).toBe(true);
    expect(classes.filter((c) => c.includes('blur')).every((c) => c.startsWith('motion-safe:'))).toBe(true);
  });
});

describe('HeroCosmic', () => {
  it('composes one Starfield inside a hidden effects layer', () => {
    stubCanvas();
    const { container } = render(<HeroCosmic data-testid="hero" headline="Hello" />);
    const layer = container.querySelector('[data-slot="hero-cosmic-effects"]')!;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.querySelectorAll('canvas')).toHaveLength(1);
  });
});
