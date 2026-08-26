/**
 * StrandField locks — the decorative contract (HeroStrand's, extended to
 * an interactive exhibit), the depth model, the pointer-tilt gates, and
 * the strand-draw entrance with its reduce-safe stagger.
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StrandField } from '../src/effects/strand-field.js';
import type { Point } from '../src/charts/scale.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom implements no `PointerEvent` — without this shim every coordinate
// arrives `undefined` and the tilt silently no-ops (the charts test file
// carries the same shim, for the same reason).
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  globalThis.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

const series = (...values: (number | null)[]): Point[] =>
  values.map((v, i) => ({ t: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`, v }));

const THREADS = [
  { id: 'a', label: 'downloads', points: series(1, 2, 3) },
  { id: 'b', label: 'stars', points: series(9, 4, 6) },
  { id: 'c', label: 'visits', points: series(2, 2, 5) },
];

const field = (container: HTMLElement): HTMLElement =>
  container.querySelector('[data-slot="strand-field"]') as HTMLElement;

const stage = (container: HTMLElement): HTMLElement =>
  container.querySelector('[data-slot="strand-field-stage"]') as HTMLElement;

/** jsdom's zero-size boxes would no-op the tilt math. */
function withLayout() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('decorative contract', () => {
  it('is aria-hidden — theatre over the consumer’s accessible controls', () => {
    const { container } = render(<StrandField data-testid="f" series={THREADS} />);
    expect(field(container).getAttribute('aria-hidden')).toBe('true');
  });

  it('a consumer cannot un-hide it through ...rest', () => {
    const { container } = render(
      <StrandField data-testid="f" series={THREADS} aria-hidden={false as never} />,
    );
    expect(field(container).getAttribute('aria-hidden')).toBe('true');
  });

  it('holds no focusable element, ever — aria-hidden forbids it', () => {
    const { container } = render(
      <StrandField data-testid="f" series={THREADS} onStrandSelect={() => {}} />,
    );
    expect(field(container).querySelectorAll('button, a, [tabindex]')).toHaveLength(0);
  });
});

describe('the depth model', () => {
  it('fans planes into depth by default, symmetric about z=0', () => {
    const { container } = render(<StrandField data-testid="f" series={THREADS} />);
    const planes = [...container.querySelectorAll<HTMLElement>('[data-slot="strand-field-plane"]')];
    expect(planes.map((p) => p.style.transform)).toEqual([
      'translateZ(46px)',
      'translateZ(0px)',
      'translateZ(-46px)',
    ]);
  });

  it('woven collapses every plane to z=0 — the flat weave', () => {
    const { container } = render(<StrandField data-testid="f" series={THREADS} woven />);
    const planes = [...container.querySelectorAll<HTMLElement>('[data-slot="strand-field-plane"]')];
    expect(planes.every((p) => p.style.transform === 'translateZ(0px)')).toBe(true);
    expect(field(container).hasAttribute('data-woven')).toBe(true);
  });

  it('drops strands with fewer than two numeric points, and caps at seven', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      label: `s${i}`,
      points: i === 0 ? series(5) : series(1, 2, 3),
    }));
    const { container } = render(<StrandField data-testid="f" series={many} />);
    // s0 has one point and is not drawn; of the nine drawable, seven fit.
    expect(container.querySelectorAll('[data-slot="strand-field-plane"]')).toHaveLength(7);
    expect(container.querySelector('[data-strand-id="s0"]')).toBeNull();
  });

  it('recedes strands outside activeIds instead of removing them', () => {
    const { container } = render(
      <StrandField data-testid="f" series={THREADS} activeIds={['b']} />,
    );
    const planes = [...container.querySelectorAll<HTMLElement>('[data-slot="strand-field-plane"]')];
    expect(planes[0].className).toContain('opacity-40');
    expect(planes[1].className).toContain('opacity-100');
  });

  it('labels each strand at its line’s end height', () => {
    const { container } = render(<StrandField data-testid="f" series={THREADS} />);
    const labels = [...container.querySelectorAll<HTMLElement>('[data-slot="strand-field-label"]')];
    expect(labels.map((l) => l.textContent)).toEqual(['downloads', 'stars', 'visits']);
    expect(labels[0].style.top).toMatch(/%$/);
  });
});

describe('pointer tilt', () => {
  it('starts at the composed default pose — legible depth with no pointer', () => {
    const { container } = render(<StrandField data-testid="f" series={THREADS} />);
    expect(stage(container).style.transform).toBe('rotateX(18deg) rotateY(-12deg)');
  });

  it('tilts with the pointer inside its own bounds, and resets on leave', () => {
    const spy = withLayout();
    const { container } = render(<StrandField data-testid="f" series={THREADS} />);
    fireEvent.pointerMove(field(container), { clientX: 0, clientY: 0 });
    expect(stage(container).style.transform).toBe('rotateX(26deg) rotateY(-22deg)');
    fireEvent.pointerLeave(field(container));
    expect(stage(container).style.transform).toBe('rotateX(18deg) rotateY(-12deg)');
    spy.mockRestore();
  });

  it('does not tilt at all under prefers-reduced-motion', () => {
    const spy = withLayout();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true } as MediaQueryList),
    );
    const { container } = render(<StrandField data-testid="f" series={THREADS} />);
    fireEvent.pointerMove(field(container), { clientX: 0, clientY: 0 });
    expect(stage(container).style.transform).toBe('rotateX(18deg) rotateY(-12deg)');
    vi.unstubAllGlobals();
    spy.mockRestore();
  });

  it('ignores pointer movement when it has no layout box', () => {
    // jsdom's default zero-size rect IS the collapsed-parent case.
    const { container } = render(<StrandField data-testid="f" series={THREADS} />);
    fireEvent.pointerMove(field(container), { clientX: 50, clientY: 50 });
    expect(stage(container).style.transform).toBe('rotateX(18deg) rotateY(-12deg)');
  });
});

describe('selection shortcut', () => {
  it('clicking a strand reports its id', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <StrandField data-testid="f" series={THREADS} onStrandSelect={onSelect} />,
    );
    fireEvent.click(
      container.querySelector('[data-strand-id="b"]') as Element,
    );
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('renders no hit path and no pointer cursor without a handler — fully inert', () => {
    const { container } = render(<StrandField data-testid="f" series={THREADS} />);
    expect(container.querySelector('path[stroke="transparent"]')).toBeNull();
    expect(container.querySelector('.cursor-pointer')).toBeNull();
  });
});

describe('the entrance is the strand-draw verb', () => {
  it('every strand draws with pathLength=100 and the shared keyframe', () => {
    const { container } = render(<StrandField data-testid="f" series={THREADS} />);
    const strands = [
      ...container.querySelectorAll('[data-slot="strand-field-strand"] path[pathLength]'),
    ];
    expect(strands).toHaveLength(3);
    for (const path of strands) {
      expect(path.getAttribute('class')).toContain('animate-strand-draw');
      expect(path.getAttribute('pathLength')).toBe('100');
    }
  });

  it('staggers via a CSS variable, so the reduce zero-delay override can win', () => {
    const { container } = render(<StrandField data-testid="f" series={THREADS} />);
    const strands = [
      ...container.querySelectorAll<SVGPathElement>(
        '[data-slot="strand-field-strand"] path[pathLength]',
      ),
    ];
    expect(strands.map((p) => p.style.getPropertyValue('--sf-delay'))).toEqual([
      '0ms',
      '90ms',
      '180ms',
    ]);
    // The delay PROPERTY comes from the stylesheet, never inline — an
    // inline animation-delay would beat the motion-reduce override and a
    // reduce user would stare at an invisible strand for the queue.
    expect(strands.every((p) => p.style.animationDelay === '')).toBe(true);
    expect(strands[0].getAttribute('class')).toContain('motion-reduce:[animation-delay:0s]');
  });
});

describe('composition', () => {
  it('merges className onto the field root', () => {
    const { container } = render(
      <StrandField data-testid="f" series={THREADS} className="h-96" />,
    );
    expect(field(container).className).toContain('h-96');
  });

  it('uses the charts’ hue identity table, cycling past five', () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      label: `s${i}`,
      points: series(1, 2, 3),
    }));
    const { container } = render(<StrandField data-testid="f" series={eight} />);
    const strands = [
      ...container.querySelectorAll('[data-slot="strand-field-strand"] path[pathLength]'),
    ];
    expect(strands[0].getAttribute('class')).toContain('stroke-chart-1');
    expect(strands[5].getAttribute('class')).toContain('stroke-chart-1');
  });
});
