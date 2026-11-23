/**
 * ReadingLayout: the text column with a Toc rail beside it at @4xl of its
 * own width, folding to a sticky "On this page" bar below that. These lock
 * the container-query switch (no viewport media query), the sticky offset
 * seam, and the bare render when there is no contents list.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MIN_VIEWPORT, ReadingLayout } from '../src/patterns/reading-layout.js';
import type { TocItem } from '../src/primitives/toc.js';

const toc: TocItem[] = [
  { id: 'closing', label: 'The closing', level: 2 },
  { id: 'works', label: 'The works', level: 3 },
];

const body = (
  <>
    <h2 id="closing">The closing</h2>
    <p>Six weeks.</p>
    <h3 id="works">The works</h3>
    <p>New bearings.</p>
  </>
);

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => vi.stubGlobal('IntersectionObserver', StubObserver));
afterEach(() => vi.unstubAllGlobals());

describe('ReadingLayout', () => {
  it('renders the rail and the bar, switched by its own width', () => {
    const { container } = render(<ReadingLayout toc={toc}>{body}</ReadingLayout>);
    const root = container.querySelector<HTMLElement>('[data-slot="reading-layout"]')!;
    expect(root.className).toContain('@container/reading');
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));

    const rail = container.querySelector('[data-slot="reading-layout-rail"]')!;
    const bar = container.querySelector('[data-slot="reading-layout-bar"]')!;
    expect(rail.className).toMatch(/\bhidden\b.*@4xl\/reading:block/);
    // The Toc's named nav is the landmark; the rail adds no unnamed one.
    expect(rail.tagName).toBe('DIV');
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(bar.className).toContain('@4xl/reading:hidden');
    // A container query, never a viewport breakpoint.
    expect(container.innerHTML).not.toMatch(/\b(md|lg|xl):(block|hidden|grid-cols)/);

    expect(screen.getByRole('navigation', { name: 'Table of contents' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'The works' }).getAttribute('href')).toBe('#works');
    expect(screen.getByRole('button', { name: 'On this page' })).toBeTruthy();
  });

  it('sticks the rail and the bar below --reading-offset, and offsets heading jumps', () => {
    const { container } = render(<ReadingLayout toc={toc}>{body}</ReadingLayout>);
    const root = container.querySelector<HTMLElement>('[data-slot="reading-layout"]')!;
    const bar = container.querySelector<HTMLElement>('[data-slot="reading-layout-bar"]')!;
    const rail = container.querySelector<HTMLElement>('[data-slot="reading-layout-rail"] > div')!;
    expect(bar.className).toMatch(/\bsticky\b/);
    expect(bar.className).toContain('top-[var(--reading-offset,0px)]');
    expect(bar.className).toMatch(/\bbg-background\b/);
    expect(rail.className).toMatch(/\bsticky\b/);
    expect(rail.className).toContain('--reading-offset');
    expect(rail.className).toMatch(/overflow-y-auto/);
    expect(root.className).toMatch(/scroll-mt-\[calc\(var\(--reading-offset,0px\)/);
  });

  it('renders the content alone when there is no contents list', () => {
    const { container } = render(<ReadingLayout>{body}</ReadingLayout>);
    expect(container.querySelector('[data-slot="reading-layout-rail"]')).toBeNull();
    expect(container.querySelector('[data-slot="reading-layout-bar"]')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByRole('heading', { name: 'The closing' })).toBeTruthy();
  });

  it('takes its labels and passes through props', () => {
    render(
      <ReadingLayout toc={toc} tocLabel="Inhalt" triggerLabel="Auf dieser Seite" data-testid="r" className="mt-4">
        {body}
      </ReadingLayout>,
    );
    expect(screen.getByRole('navigation', { name: 'Inhalt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Auf dieser Seite' })).toBeTruthy();
    expect(screen.getByTestId('r').className).toContain('mt-4');
  });
});
