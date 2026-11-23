/**
 * Interlace effects contract.
 *
 * An effect in `src/effects/` is either decoration (hidden from assistive
 * tech, never in the way of the pointer) or content that moves (CountUp,
 * Scroller, StaggerList, SheenText), which renders in full on the server and
 * announces once. Either way it is coloured from tokens and still under
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
const { CountUp } = await import('../src/effects/count-up.js');
const { Scroller } = await import('../src/effects/scroller.js');
const { StaggerList } = await import('../src/effects/stagger-list.js');
const { SheenText } = await import('../src/effects/sheen-text.js');
const { Sheen } = await import('../src/effects/sheen.js');
const { EdgeGlow } = await import('../src/effects/edge-glow.js');
const { GridField, gridFieldCells } = await import('../src/effects/grid-field.js');
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
    ['Sheen', () => <Sheen />, '[data-slot="sheen"]'],
    ['EdgeGlow', () => <EdgeGlow />, '[data-slot="edge-glow"]'],
    ['GridField', () => <GridField />, '[data-slot="grid-field"]'],
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
    // @ts-expect-error aria-hidden is omitted from the props on purpose
    const edge = render(<EdgeGlow aria-hidden={false} />);
    expect(edge.container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
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

  it.each([1, 3, 7, 42])('SkyBackdrop rests every cloud inside the sky (seed %i), so the loop wraps unseen', (seed) => {
    const { container } = render(<SkyBackdrop seed={seed} clouds={8} animated={false} />);
    const clouds = [...container.querySelectorAll<HTMLElement>('[data-slot="sky-backdrop-cloud"]')];
    expect(clouds).toHaveLength(8);
    for (const cloud of clouds) {
      expect(parseFloat(cloud.style.left) + parseFloat(cloud.style.width)).toBeLessThan(100);
    }
  });

  it.each([
    ['GradientMesh', () => <GradientMesh animated={false}>{null}</GradientMesh>],
    ['SkyBackdrop', () => <SkyBackdrop animated={false}>{null}</SkyBackdrop>],
  ] as const)('%s adds no content wrapper for null children', (_name, make) => {
    const { container } = render(make());
    const root = container.firstElementChild!;
    expect([...root.children].every((child) => child.getAttribute('aria-hidden') === 'true')).toBe(true);
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

describe('CountUp', () => {
  it('renders the final figure on the server, and one stable label', () => {
    const html = renderToStaticMarkup(<CountUp value={4800} format={{ notation: 'compact' }} locale="en-US" />);
    expect(html).toContain('4.8K');
    expect(html.match(/4\.8K/g)!.length).toBe(3);
    render(<CountUp value={120} locale="en-US" />);
    expect(screen.getByText('120', { selector: '[data-slot="count-up-label"]' }).className).toContain('sr-only');
    expect(document.querySelector('[data-slot="count-up-digits"]')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('drops to the start value and waits for the viewport when motion is allowed', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    render(<CountUp value={120} locale="en-US" />);
    expect(document.querySelector('[data-slot="count-up-digits"]')!.textContent).toBe('0');
    expect(raf).not.toHaveBeenCalled();
  });

  it('shows the final value at once under reduced motion', () => {
    reduced.value = true;
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    render(<CountUp value={120} locale="en-US" />);
    expect(document.querySelector('[data-slot="count-up-digits"]')!.textContent).toBe('120');
    expect(raf).not.toHaveBeenCalled();
  });
});

describe('Scroller', () => {
  const items = ['Alpha', 'Beta', 'Gamma'].map((n) => <a key={n} href={`#${n}`}>{n}</a>);

  it('announces each item once and takes each link once in the tab order', () => {
    const { container } = render(<Scroller label="Partners">{items}</Scroller>);
    const lists = container.querySelectorAll('[data-slot="scroller-list"]');
    expect(lists).toHaveLength(2);
    expect(lists[0]!.hasAttribute('aria-hidden')).toBe(false);
    expect(lists[1]!.getAttribute('aria-hidden')).toBe('true');
    expect(lists[1]!.hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('region', { name: 'Partners' })).toBeTruthy();
    expect(animateSpy).toHaveBeenCalled();
  });

  it('gives a visible pause control that reports its state', () => {
    render(<Scroller>{items}</Scroller>);
    const button = screen.getByRole('button', { name: 'Pause' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    act(() => button.click());
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('under reduced motion: no clone, no control that controls nothing, and a scrollable row', () => {
    reduced.value = true;
    const { container } = render(<Scroller>{items}</Scroller>);
    expect(container.querySelectorAll('[data-slot="scroller-list"]')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[data-slot="scroller-viewport"]')!.className).toContain('overflow-x-auto');
    expect(animateSpy).not.toHaveBeenCalled();
  });
});

describe('StaggerList', () => {
  it('is a real list on the server, every item present', () => {
    const html = renderToStaticMarkup(
      <StaggerList as="ol">
        <span>One</span>
        <span>Two</span>
        {null}
      </StaggerList>,
    );
    expect(html).toContain('<ol data-slot="stagger-list"');
    expect(html.match(/<li /g)).toHaveLength(2);
    expect(html).not.toContain('opacity');
  });

  it('hides items until their turn when motion is allowed, and shows focus at once', () => {
    const { container } = render(
      <StaggerList>
        <a href="#a">A</a>
        <a href="#b">B</a>
      </StaggerList>,
    );
    const items = [...container.querySelectorAll<HTMLElement>('[data-slot="stagger-list-item"]')];
    expect(items.every((li) => li.style.opacity === '0')).toBe(true);
    act(() => items[1]!.querySelector('a')!.focus());
    expect(items[1]!.style.opacity).toBe('');
    expect(items[0]!.style.opacity).toBe('0');
  });

  it('leaves every item visible under reduced motion', () => {
    reduced.value = true;
    const { container } = render(
      <StaggerList>
        <span>A</span>
      </StaggerList>,
    );
    expect((container.querySelector('[data-slot="stagger-list-item"]') as HTMLElement).style.opacity).toBe('');
  });
});

describe('SheenText', () => {
  it('is real text, with a forced-colours fallback', () => {
    render(<SheenText>matters</SheenText>);
    const el = screen.getByText('matters');
    expect(el.className).toContain('forced-colors:bg-none');
    expect(el.getAttribute('style')).toContain('var(--primary)');
  });

  it('asks for an animation only when motion is allowed', () => {
    render(<SheenText>a</SheenText>);
    expect(animateSpy).toHaveBeenCalled();
    animateSpy.mockClear();
    reduced.value = true;
    render(<SheenText>b</SheenText>);
    expect(animateSpy).not.toHaveBeenCalled();
  });
});

describe('Sheen and EdgeGlow', () => {
  it('Sheen sits under the label and is gone under reduced motion', () => {
    const { container, rerender } = render(<Sheen />);
    expect(container.firstElementChild!.className).toContain('-z-10');
    reduced.value = true;
    rerender(<Sheen />);
    expect(container.firstElementChild).toBeNull();
  });

  it('EdgeGlow holds its arc still under reduced motion instead of vanishing', () => {
    reduced.value = true;
    const { container } = render(<EdgeGlow />);
    expect(container.querySelector('[data-slot="edge-glow-arc"]')).not.toBeNull();
    expect(animateSpy).not.toHaveBeenCalled();
  });
});

describe('GridField', () => {
  it('lights the same cells for the same seed, on the server too', () => {
    expect(gridFieldCells(6, 9)).toEqual(gridFieldCells(6, 9));
    expect(gridFieldCells(6, 9)).not.toEqual(gridFieldCells(6, 10));
    const html = renderToStaticMarkup(<GridField lit={3} seed={9} cell={10} />);
    const [c, r] = gridFieldCells(3, 9, 32, 16)[0]!;
    expect(html).toContain(`x="${c * 10 + 1}" y="${r * 10 + 1}"`);
  });

  it('listens on the surface it covers, never on its pointer-events-none root', () => {
    // A pointer-events-none element is not a hit target, so a listener on the
    // field itself could never fire. That shipped once, in the component this
    // replaces: `interactive` was a prop the component accepted and ignored.
    const calls: Array<{ target: EventTarget; type: string }> = [];
    const original = Element.prototype.addEventListener;
    vi.spyOn(Element.prototype, 'addEventListener').mockImplementation(function (
      this: Element,
      type: string,
      ...rest: [EventListenerOrEventListenerObject, (boolean | AddEventListenerOptions)?]
    ) {
      calls.push({ target: this, type });
      return original.call(this, type, ...rest);
    } as typeof Element.prototype.addEventListener);

    render(
      <section data-testid="surface">
        <GridField interactive />
      </section>,
    );
    const root = document.querySelector('[data-slot="grid-field"]')!;
    const moves = calls.filter((c) => c.type === 'pointermove').map((c) => c.target);
    expect(moves).toContain(root.parentElement);
    expect(moves).not.toContain(root);
    expect(document.querySelector('[data-slot="grid-field-hover"]')).not.toBeNull();
  });

  it('adds no listener and no highlight when not interactive', () => {
    // Targets, not just types: React attaches its own delegated pointermove
    // to the container it renders into, whatever the component does.
    const targets: EventTarget[] = [];
    const original = Element.prototype.addEventListener;
    vi.spyOn(Element.prototype, 'addEventListener').mockImplementation(function (
      this: Element,
      type: string,
      ...rest: [EventListenerOrEventListenerObject, (boolean | AddEventListenerOptions)?]
    ) {
      if (type === 'pointermove') targets.push(this);
      return original.call(this, type, ...rest);
    } as typeof Element.prototype.addEventListener);
    render(
      <section>
        <GridField />
      </section>,
    );
    const root = document.querySelector('[data-slot="grid-field"]')!;
    expect(targets).not.toContain(root);
    expect(targets).not.toContain(root.parentElement);
    expect(document.querySelector('[data-slot="grid-field-hover"]')).toBeNull();
  });

  it('draws dots instead of lines, and lights the cells it is given', () => {
    const html = renderToStaticMarkup(<GridField mark="dots" cell={20} cells={[[2, 3]]} />);
    expect(html).toContain('<circle');
    expect(html).not.toContain('<path');
    expect(html).toContain('x="41" y="61"');
    expect(html.match(/data-slot="grid-field-cell"/g)).toHaveLength(1);
  });

  it('draws in theme tokens', () => {
    const html = renderToStaticMarkup(<GridField />);
    expect(html).toContain('var(--border)');
    expect(html).toContain('var(--primary)');
  });
});
