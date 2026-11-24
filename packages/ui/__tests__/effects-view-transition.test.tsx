/**
 * View transitions: the fallback, the reduced-motion gate, flushing React
 * state inside the transition, valid names, and the page CSS.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({ useReducedMotion: () => reduced.value }));

const {
  Morph,
  PageTransitions,
  pageTransitionsCss,
  startViewTransition,
  supportsViewTransitions,
  useViewTransition,
  viewTransitionName,
} = await import('../src/effects/view-transition.js');

type Doc = Document & { startViewTransition?: unknown };

function stubTransitions(impl?: (arg: unknown) => unknown) {
  const calls: unknown[] = [];
  (document as Doc).startViewTransition = vi.fn((arg: unknown) => {
    calls.push(arg);
    if (impl) return impl(arg);
    const update = typeof arg === 'function' ? arg : (arg as { update: () => void }).update;
    update();
    return { finished: Promise.resolve() };
  });
  return calls;
}

function stubMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q }));
}

afterEach(() => {
  cleanup();
  delete (document as Doc).startViewTransition;
  vi.unstubAllGlobals();
  reduced.value = false;
});

describe('startViewTransition', () => {
  it('runs the update straight away without the API', () => {
    const update = vi.fn();
    expect(supportsViewTransitions()).toBe(false);
    expect(startViewTransition(update)).toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('uses the API, with types where they are asked for', () => {
    stubMotion(false);
    const calls = stubTransitions();
    const update = vi.fn();
    expect(supportsViewTransitions()).toBe(true);
    expect(startViewTransition(update)).not.toBeNull();
    expect(calls[0]).toBe(update);
    startViewTransition(update, { types: ['forward'] });
    expect(calls[1]).toEqual({ update, types: ['forward'] });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('falls back to the callback form on engines without types', () => {
    stubMotion(false);
    const calls = stubTransitions((arg) => {
      if (typeof arg !== 'function') throw new TypeError('callback only');
      (arg as () => void)();
      return {};
    });
    const update = vi.fn();
    startViewTransition(update, { types: ['back'] });
    expect(calls).toHaveLength(2);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('skips the transition under reduced motion or when asked', () => {
    const calls = stubTransitions();
    stubMotion(true);
    const update = vi.fn();
    expect(startViewTransition(update)).toBeNull();
    stubMotion(false);
    expect(startViewTransition(update, { skip: true })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(update).toHaveBeenCalledTimes(2);
    vi.stubGlobal('matchMedia', undefined);
    expect(startViewTransition(update)).not.toBeNull();
  });
});

describe('useViewTransition', () => {
  function Toggle() {
    const [open, setOpen] = React.useState(false);
    const transition = useViewTransition();
    return (
      <button type="button" onClick={() => transition(() => setOpen((o) => !o), { types: ['open'] })}>
        {open ? 'open' : 'closed'}
      </button>
    );
  }

  it('flushes React state inside the transition', () => {
    stubMotion(false);
    let seen = '';
    stubTransitions((arg) => {
      (arg as { update: () => void }).update();
      seen = document.querySelector('button')!.textContent!;
      return {};
    });
    render(<Toggle />);
    act(() => fireEvent.click(screen.getByRole('button')));
    expect(seen).toBe('open');
  });

  it('just updates under reduced motion', () => {
    stubMotion(false);
    const calls = stubTransitions();
    reduced.value = true;
    render(<Toggle />);
    act(() => fireEvent.click(screen.getByRole('button')));
    expect(screen.getByRole('button').textContent).toBe('open');
    expect(calls).toHaveLength(0);
  });
});

describe('Morph', () => {
  it('names its child, keeping its own style', () => {
    render(
      <Morph name="Card 42!">
        <img alt="A bridge" style={{ width: 10 }} />
      </Morph>,
    );
    const img = screen.getByRole('img') as HTMLElement;
    expect(img.style.width).toBe('10px');
    expect(img.style.getPropertyValue('view-transition-name')).toBe('Card-42');
    expect(img.getAttribute('data-slot')).toBe('morph');
  });

  it('keeps a slot the child already has', () => {
    render(
      <Morph name="hero">
        <img alt="A hill" data-slot="figure-image" />
      </Morph>,
    );
    expect(screen.getByRole('img').getAttribute('data-slot')).toBe('figure-image');
  });

  it('can stand down', () => {
    render(
      <Morph name="x" disabled>
        <p>Text</p>
      </Morph>,
    );
    expect(screen.getByText('Text').getAttribute('style')).toBeNull();
    expect(screen.getByText('Text').getAttribute('data-slot')).toBeNull();
  });

  it('makes names valid identifiers', () => {
    expect(viewTransitionName('card/42')).toBe('card-42');
    expect(viewTransitionName('42')).toBe('vt-42');
    expect(viewTransitionName('-4x')).toBe('vt-4x');
    expect(viewTransitionName('  ')).toBe('vt-');
    expect(viewTransitionName('café')).toBe('cafe');
    expect(viewTransitionName('none')).toBe('vt-none');
    expect(viewTransitionName('auto')).toBe('vt-auto');
  });
});

describe('PageTransitions', () => {
  it('renders the page CSS on the server, gated on reduced motion', () => {
    const html = renderToStaticMarkup(<PageTransitions />);
    expect(html).toContain('data-slot="page-transitions"');
    expect(html).toContain('@view-transition{navigation:auto}');
    expect(html).toContain('@media (prefers-reduced-motion:reduce)');
    expect(html).toContain('ilx-vt-in');
  });

  it('can stay in one document, fade, or leave the page still', () => {
    expect(pageTransitionsCss({ crossDocument: false })).not.toContain('@view-transition');
    expect(pageTransitionsCss({ page: 'fade' })).toContain('ilx-vt-fade-in 300ms');
    expect(pageTransitionsCss({ page: 'none' })).toContain('::view-transition-new(root){animation:none}');
    // Only opacity and transform move.
    const keyframes = pageTransitionsCss().match(/@keyframes[^}]+\{[^}]+\}\}/g) ?? [];
    expect(keyframes).toHaveLength(4);
    for (const k of keyframes) expect(k.replace(/opacity:[^;}]+|transform:[^;}]+/g, '')).not.toMatch(/:[^{]*[;}]/);
  });
});
