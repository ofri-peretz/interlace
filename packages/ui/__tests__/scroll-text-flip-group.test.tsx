/**
 * ScrollText and FlipGroup. jsdom has no ViewTimeline and no layout, so these
 * tests stub both and pin what each component asks the browser for: the
 * timeline ranges, the glide from the old place, and the still fallbacks.
 */
import { render } from '@testing-library/react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { ScrollText } = await import('../src/effects/scroll-text.js');
const { FlipGroup } = await import('../src/effects/flip-group.js');

const cancel = vi.fn();
const animateSpy = vi.fn(() => ({ cancel }));

beforeEach(() => {
  reduced.value = false;
  animateSpy.mockClear();
  cancel.mockClear();
  (Element.prototype as unknown as { animate: unknown }).animate = animateSpy;
  (Element.prototype as unknown as { getAnimations: unknown }).getAnimations = () => [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as unknown as { animate?: unknown }).animate;
  delete (Element.prototype as unknown as { getAnimations?: unknown }).getAnimations;
});

class FakeViewTimeline {
  options: unknown;
  constructor(options: unknown) {
    this.options = options;
  }
}

describe('ScrollText', () => {
  it('reads the sentence once and shows every word on the server', () => {
    const html = renderToStaticMarkup(<ScrollText as="h2">We build bridges people cross</ScrollText>);
    expect(html).toMatch(/^<h2 data-slot="scroll-text"/);
    expect(html).toContain('<span class="sr-only">We build bridges people cross</span>');
    expect(html).toContain('aria-hidden="true"');
    expect(html.match(/data-slot="scroll-text-word"/g)).toHaveLength(5);
    expect(html).not.toContain('style=');
  });

  it('gives each word its share of the range on a view timeline, from muted to full colour', () => {
    vi.stubGlobal('ViewTimeline', FakeViewTimeline);
    const { container, unmount } = render(
      <ScrollText start={20} end={60}>
        One two three four
      </ScrollText>,
    );
    const el = container.querySelector<HTMLElement>('[data-slot="scroll-text"]')!;
    expect(el.dataset.live).toBe('');
    expect(animateSpy).toHaveBeenCalledTimes(4);
    const calls = animateSpy.mock.calls as unknown as [Keyframe[], Record<string, unknown>][];
    expect(calls[0]![0]).toEqual([{ color: 'var(--muted-foreground)' }, { color: 'var(--foreground)' }]);
    expect(calls[0]![1]).toMatchObject({ rangeStart: 'cover 20%', rangeEnd: 'cover 30%', fill: 'both' });
    expect(calls[3]![1]).toMatchObject({ rangeStart: 'cover 50%', rangeEnd: 'cover 60%' });
    expect((calls[0]![1].timeline as FakeViewTimeline).options).toMatchObject({ subject: el, axis: 'block' });
    unmount();
    expect(cancel).toHaveBeenCalledTimes(4);
  });

  it('clamps a range that runs backwards or out of bounds', () => {
    vi.stubGlobal('ViewTimeline', FakeViewTimeline);
    render(
      <ScrollText start={-10} end={-20}>
        Two words
      </ScrollText>,
    );
    const calls = animateSpy.mock.calls as unknown as [Keyframe[], Record<string, unknown>][];
    expect(calls[1]![1]).toMatchObject({ rangeStart: 'cover 0%', rangeEnd: 'cover 0%' });
  });

  it('is simply in full colour without ViewTimeline or under reduced motion', () => {
    const { container } = render(<ScrollText>No timeline here</ScrollText>);
    expect(container.querySelector<HTMLElement>('[data-slot="scroll-text"]')!.dataset.live).toBeUndefined();
    vi.stubGlobal('ViewTimeline', FakeViewTimeline);
    reduced.value = true;
    render(<ScrollText>Asked for less motion</ScrollText>);
    expect(animateSpy).not.toHaveBeenCalled();
  });
});

function Ranked({ order, render: as }: { order: string[]; render?: React.ReactElement }) {
  return (
    <FlipGroup render={as} duration={300}>
      {order.map((id) => (
        <div key={id} data-flip-id={id}>
          {id}
        </div>
      ))}
    </FlipGroup>
  );
}

/** jsdom has no layout: place each item by its index in its parent. */
function stubLayout() {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const i = this.parentElement ? Array.from(this.parentElement.children).indexOf(this) : 0;
    return { left: 0, top: i * 40, width: 100, height: 40 } as DOMRect;
  };
}

describe('FlipGroup', () => {
  const original = Element.prototype.getBoundingClientRect;
  afterEach(() => {
    Element.prototype.getBoundingClientRect = original;
  });

  it('plays nothing on the first render', () => {
    stubLayout();
    const { container } = render(<Ranked order={['a', 'b']} />);
    expect(container.querySelector('[data-slot="flip-group"]')!.tagName).toBe('DIV');
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it('glides moved items from their old place and fades new ones in', () => {
    stubLayout();
    const { rerender } = render(<Ranked order={['a', 'b', 'c']} />);
    rerender(<Ranked order={['c', 'a', 'b', 'd']} />);
    const calls = animateSpy.mock.calls as unknown as [Keyframe[], KeyframeAnimationOptions][];
    const moves = calls.map(([frames]) => frames[0]);
    // c moved up two rows, a and b down one, d is new.
    expect(moves).toContainEqual({ transform: 'translate(0px, 80px)' });
    expect(moves).toContainEqual({ transform: 'translate(0px, -40px)' });
    expect(moves).toContainEqual({ opacity: 0 });
    expect(calls[0]![1]).toMatchObject({ duration: 300 });
  });

  it('leaves items that did not move alone, and can be the list itself', () => {
    stubLayout();
    const { container, rerender } = render(<Ranked order={['a', 'b']} render={<ol />} />);
    rerender(<Ranked order={['a', 'b']} render={<ol />} />);
    expect(container.querySelector('[data-slot="flip-group"]')!.tagName).toBe('OL');
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it('simply re-orders under reduced motion', () => {
    stubLayout();
    reduced.value = true;
    const { rerender } = render(<Ranked order={['a', 'b']} />);
    rerender(<Ranked order={['b', 'a']} />);
    expect(animateSpy).not.toHaveBeenCalled();
  });
});
