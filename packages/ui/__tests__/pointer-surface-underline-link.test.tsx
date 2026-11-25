/**
 * PointerSurface and UnderlineLink: motion that answers the reader's own
 * pointer or focus. jsdom computes no transform or transition, so these tests
 * pin what each component asks for: when it listens, what it writes, and
 * that a touch screen or a reader who asked for less motion gets a still page.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { PointerSurface } = await import('../src/effects/pointer-surface.js');
const { UnderlineLink } = await import('../src/effects/underline-link.js');

function stubPointer(fine: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: fine, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  window.matchMedia = globalThis.matchMedia;
}

// jsdom has no PointerEvent; a MouseEvent that carries `pointerType` is enough.
class FakePointerEvent extends MouseEvent {
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? 'mouse';
  }
}

beforeEach(() => {
  reduced.value = false;
  vi.stubGlobal('PointerEvent', FakePointerEvent);
  stubPointer(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function surface(container: HTMLElement) {
  const el = container.querySelector<HTMLElement>('[data-slot="pointer-surface"]')!;
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
  return el;
}

describe('PointerSurface', () => {
  it('renders its children still on the server, with no light layer', () => {
    const html = renderToStaticMarkup(
      <PointerSurface effect="both">
        <p>A choice</p>
      </PointerSurface>,
    );
    expect(html).toContain('data-slot="pointer-surface"');
    expect(html).toContain('<p>A choice</p>');
    expect(html).not.toContain('pointer-surface-light');
    expect(html).not.toContain('data-active');
  });

  it('follows a fine pointer: writes its position and lights up', () => {
    const { container } = render(
      <PointerSurface effect="both">
        <p>A choice</p>
      </PointerSurface>,
    );
    const el = surface(container);
    const light = container.querySelector('[data-slot="pointer-surface-light"]')!;
    expect(light.getAttribute('aria-hidden')).toBe('true');
    expect(light.getAttribute('class')).toContain('pointer-events-none');
    fireEvent.pointerMove(el, { clientX: 150, clientY: 25, pointerType: 'mouse' });
    expect(el.style.getPropertyValue('--pointer-x')).toBe('0.75');
    expect(el.style.getPropertyValue('--pointer-y')).toBe('0.25');
    expect(el.hasAttribute('data-active')).toBe(true);
    expect(el.getAttribute('class')).toContain('rotateX');
    fireEvent.pointerLeave(el);
    expect(el.style.getPropertyValue('--pointer-x')).toBe('0.5');
    expect(el.hasAttribute('data-active')).toBe(false);
  });

  it('lights from the centre when keyboard focus lands inside, and dims when it leaves', () => {
    const { container } = render(
      <PointerSurface>
        <a href="#plan">Choose the plan</a>
      </PointerSurface>,
    );
    const el = surface(container);
    act(() => container.querySelector('a')!.focus());
    expect(el.hasAttribute('data-active')).toBe(true);
    act(() => container.querySelector('a')!.blur());
    expect(el.hasAttribute('data-active')).toBe(false);
  });

  it('ignores touch, and does nothing for a coarse pointer', () => {
    const { container } = render(<PointerSurface>Card</PointerSurface>);
    const el = surface(container);
    fireEvent.pointerMove(el, { clientX: 150, clientY: 25, pointerType: 'touch' });
    expect(el.hasAttribute('data-active')).toBe(false);

    stubPointer(false);
    const coarse = render(<PointerSurface effect="tilt">Card</PointerSurface>);
    const still = surface(coarse.container);
    expect(still.getAttribute('class')).not.toContain('rotateX');
    fireEvent.pointerMove(still, { clientX: 150, clientY: 25, pointerType: 'mouse' });
    expect(still.hasAttribute('data-active')).toBe(false);
  });

  it('is still under reduced motion', () => {
    reduced.value = true;
    const { container } = render(<PointerSurface effect="both">Card</PointerSurface>);
    const el = surface(container);
    expect(container.querySelector('[data-slot="pointer-surface-light"]')).toBeNull();
    fireEvent.pointerMove(el, { clientX: 150, clientY: 25, pointerType: 'mouse' });
    expect(el.hasAttribute('data-active')).toBe(false);
  });

  it('keeps the caller’s handlers and style', () => {
    const onPointerMove = vi.fn();
    const onFocus = vi.fn();
    const { container } = render(
      <PointerSurface onPointerMove={onPointerMove} onFocus={onFocus} max={8} style={{ borderRadius: 12 }}>
        <button type="button">Pick</button>
      </PointerSurface>,
    );
    const el = surface(container);
    fireEvent.pointerMove(el, { clientX: 10, clientY: 10, pointerType: 'mouse' });
    act(() => container.querySelector('button')!.focus());
    expect(onPointerMove).toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalled();
    expect(el.style.getPropertyValue('--pointer-max')).toBe('8deg');
    expect(el.style.borderRadius).toBe('12px');
  });

  it('skips a surface with no size', () => {
    const { container } = render(<PointerSurface>Card</PointerSurface>);
    const el = container.querySelector<HTMLElement>('[data-slot="pointer-surface"]')!;
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
    fireEvent.pointerMove(el, { clientX: 1, clientY: 1, pointerType: 'mouse' });
    expect(el.hasAttribute('data-active')).toBe(false);
  });
});

describe('UnderlineLink', () => {
  it('is a real link with a thin underline at rest by default', () => {
    const html = renderToStaticMarkup(<UnderlineLink href="/about">About us</UnderlineLink>);
    expect(html.startsWith('<a ')).toBe(true);
    expect(html).toContain('data-slot="underline-link"');
    expect(html).toContain('data-rest="thin"');
    expect(html).toContain('data-tone="inherit"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('[--underline-rest:100%_1px]');
  });

  it('draws from the inline-start edge, in CSS, and falls back to an underline in forced colours', () => {
    const { container } = render(
      <UnderlineLink href="/" rest="none" tone="primary">
        Home
      </UnderlineLink>,
    );
    const cls = container.querySelector('a')!.getAttribute('class')!;
    expect(cls).toContain('bg-[position:0_100%]');
    expect(cls).toContain('rtl:bg-[position:100%_100%]');
    expect(cls).toContain('transition-[background-size]');
    expect(cls).toContain('[--underline-rest:0%_0.08em]');
    expect(cls).toContain('text-primary');
    expect(cls).toContain('forced-colors:underline');
    expect(cls).toContain('focus-visible:outline-ring');
  });

  it('renders a router link through `render`', () => {
    function RouterLink({ href, children, ...props }: React.ComponentProps<'a'>) {
      return (
        <a data-router="" href={href} {...props}>
          {children}
        </a>
      );
    }
    const { container } = render(<UnderlineLink render={<RouterLink href="/x" />}>Next</UnderlineLink>);
    const a = container.querySelector('a')!;
    expect(a.hasAttribute('data-router')).toBe(true);
    expect(a.dataset.slot).toBe('underline-link');
  });
});
