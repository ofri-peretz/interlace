/**
 * Carousel. jsdom does no layout and does not scroll, so these tests give
 * the row a size and a scroll position by hand and pin what the component
 * does with them: the roles a screen reader hears, which buttons are on, how
 * far and which way a page goes (also right to left and under reduced
 * motion), and the server markup.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, MIN_VIEWPORT } =
  await import('../src/patterns/carousel.js');

let resize: (() => void) | undefined;
class FakeResizeObserver {
  constructor(callback: () => void) {
    resize = callback;
  }
  observe() {}
  disconnect() {}
}

const scrollBy = vi.fn();

beforeEach(() => {
  reduced.value = false;
  resize = undefined;
  scrollBy.mockClear();
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  (HTMLElement.prototype as unknown as { scrollBy: unknown }).scrollBy = scrollBy;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as unknown as { scrollBy?: unknown }).scrollBy;
});

/** Give the row a width, a scroll width and a position, then tell the component it scrolled. */
function layout(row: HTMLElement, { client, scroll, left }: { client: number; scroll: number; left: number }) {
  Object.defineProperty(row, 'clientWidth', { configurable: true, value: client });
  Object.defineProperty(row, 'scrollWidth', { configurable: true, value: scroll });
  Object.defineProperty(row, 'scrollLeft', { configurable: true, value: left });
  fireEvent.scroll(row);
}

const Example = ({ onScroll, dir }: { onScroll?: () => void; dir?: 'rtl' }) => (
  <div dir={dir}>
    <Carousel aria-label="Shapes">
      <h2>Shapes</h2>
      <CarouselContent onScroll={onScroll}>
        <CarouselItem>Triangle</CarouselItem>
        <CarouselItem>Square</CarouselItem>
        <CarouselItem positionLabel={(i, n) => `Card ${i} / ${n}`}>Circle</CarouselItem>
        {null}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext label="More shapes" />
    </Carousel>
  </div>
);

const row = () => document.querySelector<HTMLElement>('[data-slot="carousel-content"]')!;

describe('Carousel', () => {
  it('renders every card on the server, in order, as slides', () => {
    const html = renderToStaticMarkup(<Example />);
    expect(html).toContain('<section data-slot="carousel" aria-roledescription="carousel"');
    expect(html).toContain(`data-min-viewport="${MIN_VIEWPORT}"`);
    expect(html).toContain('aria-label="Shapes"');
    expect(html.match(/<div data-slot="carousel-item" role="group" aria-roledescription="slide"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="1 of 3"');
    expect(html).toContain('aria-label="Card 3 / 3"');
    expect(html).toMatch(/<div[^>]*data-slot="carousel-content"[^>]*tabindex="0"|<div[^>]*tabindex="0"[^>]*data-slot="carousel-content"/);
    expect(html.indexOf('Triangle')).toBeLessThan(html.indexOf('Circle'));
  });

  it('names the region and its slides for a screen reader', () => {
    render(<Example />);
    expect(screen.getByRole('region', { name: 'Shapes' })).toBeTruthy();
    expect(screen.getByRole('group', { name: '2 of 3' }).textContent).toBe('Square');
  });

  it('switches Previous off at the start and Next off at the end', () => {
    render(<Example />);
    layout(row(), { client: 300, scroll: 900, left: 0 });
    const previous = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'More shapes' });
    expect(previous).toHaveProperty('disabled', true);
    expect(next).toHaveProperty('disabled', false);
    expect(next.getAttribute('aria-controls')).toBe(row().id);

    layout(row(), { client: 300, scroll: 900, left: 300 });
    expect(previous).toHaveProperty('disabled', false);
    expect(next).toHaveProperty('disabled', false);

    layout(row(), { client: 300, scroll: 900, left: 599.7 });
    expect(next).toHaveProperty('disabled', true);
  });

  it('shows no buttons when every card fits, and measures again when the row resizes', () => {
    render(<Example />);
    layout(row(), { client: 900, scroll: 900, left: 0 });
    expect(screen.queryByRole('button')).toBeNull();
    Object.defineProperty(row(), 'clientWidth', { configurable: true, value: 300 });
    React.act(() => resize?.());
    expect(screen.getByRole('button', { name: 'More shapes' })).toBeTruthy();
  });

  it('pages one view along the reading direction, smoothly', () => {
    const onScroll = vi.fn();
    render(<Example onScroll={onScroll} />);
    layout(row(), { client: 300, scroll: 900, left: 300 });
    expect(onScroll).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'More shapes' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' });
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -300, behavior: 'smooth' });
  });

  it('pages the other way in a right-to-left page, where scroll positions run negative', () => {
    render(<Example dir="rtl" />);
    layout(row(), { client: 300, scroll: 900, left: -300 });
    const previous = screen.getByRole('button', { name: 'Previous' });
    expect(previous).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByRole('button', { name: 'More shapes' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -300, behavior: 'smooth' });
    expect(document.querySelector('[data-slot="carousel-next"] svg')!.getAttribute('class')).toContain('rtl:rotate-180');
  });

  it('jumps instead of gliding under reduced motion', () => {
    reduced.value = true;
    render(<Example />);
    layout(row(), { client: 300, scroll: 900, left: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'More shapes' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 300, behavior: 'auto' });
  });

  it('passes clicks through to the app', () => {
    const onClick = vi.fn();
    render(
      <Carousel aria-label="Row">
        <CarouselContent>
          <CarouselItem>One</CarouselItem>
        </CarouselContent>
        <CarouselNext onClick={onClick} />
      </Carousel>,
    );
    layout(row(), { client: 300, scroll: 900, left: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('measures once laid out, even without a ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Example />);
    // jsdom lays nothing out, so the row measures as fitting and the buttons go.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('pages nowhere when there is no row yet, and a lone card has no place to announce', () => {
    render(
      <Carousel aria-label="Empty">
        <CarouselNext />
      </Carousel>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(scrollBy).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(<CarouselItem>Alone</CarouselItem>)).not.toContain('aria-label');
  });

  it('asks for a Carousel around its parts', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<CarouselNext />)).toThrow('CarouselNext must be used inside <Carousel>.');
    expect(() => render(<CarouselPrevious />)).toThrow('CarouselPrevious must be used inside <Carousel>.');
    expect(() => render(<CarouselContent />)).toThrow('CarouselContent must be used inside <Carousel>.');
  });
});
