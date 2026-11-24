/**
 * The table of contents follows the reader. These lock the scroll-spy (the
 * last heading above the reading line is current, held on a pick), the rail's
 * marker and folding, and the narrow bar: it names the current section and
 * opens the list in a sheet that closes on a pick with focus on the heading.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toc, TocBar, type TocItem } from '../src/primitives/toc.js';

const items: TocItem[] = [
  { id: 'closing', label: 'Why the bridge closed', level: 2 },
  { id: 'bearings', label: 'The bearings', level: 3 },
  { id: 'detour', label: 'The detour', level: 2 },
  { id: 'reopening', label: 'Reopening', level: 2 },
];

/** Where each heading sits in the viewport, by id. */
let tops: Record<string, number> = {};

function Headings({ list = items }: { list?: TocItem[] }) {
  return (
    <>
      {list.map((item) => (
        <h2 key={item.id} id={item.id}>
          {item.label}
        </h2>
      ))}
    </>
  );
}

function scrollTo(next: Record<string, number>) {
  tops = next;
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

const original = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  tops = {};
  HTMLElement.prototype.getBoundingClientRect = function () {
    const top = tops[this.id] ?? 0;
    return { top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON() {} };
  };
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = original;
  vi.unstubAllGlobals();
});

describe('Toc scroll-spy', () => {
  it('marks nothing above the first heading, then the last heading past the reading line', async () => {
    tops = { closing: 600, bearings: 900, detour: 1400, reopening: 2000 };
    render(
      <>
        <Toc items={items} />
        <Headings />
      </>,
    );
    expect(document.querySelector('[aria-current]')).toBeNull();

    scrollTo({ closing: -300, bearings: 100, detour: 600, reopening: 1200 });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'The bearings' }).getAttribute('aria-current')).toBe('location'),
    );
    // Between headings the section stays current: no blank gap.
    scrollTo({ closing: -700, bearings: -300, detour: 400, reopening: 1000 });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'The bearings' }).getAttribute('aria-current')).toBe('location'),
    );
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1);
  });

  it('places the marker on the current entry', async () => {
    tops = { closing: -10, bearings: 400, detour: 900, reopening: 1500 };
    const { container } = render(
      <>
        <Toc items={items} />
        <Headings />
      </>,
    );
    const track = container.querySelector<HTMLElement>('[data-slot="toc-track"]')!;
    await waitFor(() => expect(track.hasAttribute('data-placed')).toBe(true));
    expect(track.style.getPropertyValue('--toc-h')).toMatch(/px$/);
    const indicator = container.querySelector<HTMLElement>('[data-slot="toc-indicator"]')!;
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
    // The slide is motion-safe only: reduced motion moves it without a glide.
    expect(indicator.className).not.toMatch(/(^|\s)transition-/);
    expect(indicator.className).toContain('motion-safe:transition-');
  });

  it('holds a picked entry while the jump scrolls past others', async () => {
    tops = { closing: -10, bearings: 400, detour: 900, reopening: 1500 };
    render(
      <>
        <Toc items={items} />
        <Headings />
      </>,
    );
    act(() => fireEvent.click(screen.getByRole('link', { name: 'Reopening' })));
    expect(screen.getByRole('link', { name: 'Reopening' }).getAttribute('aria-current')).toBe('location');
    // Mid-scroll the detour crosses the line; the pick still holds.
    scrollTo({ closing: -900, bearings: -500, detour: 0, reopening: 600 });
    expect(screen.getByRole('link', { name: 'Reopening' }).getAttribute('aria-current')).toBe('location');
    expect(document.activeElement).toBe(document.getElementById('reopening'));
  });

  it('marks the last heading on screen at the foot of the page', async () => {
    const doc = document.documentElement;
    Object.defineProperty(doc, 'scrollHeight', { configurable: true, value: 2000 });
    vi.stubGlobal('innerHeight', 600);
    vi.stubGlobal('scrollY', 1400);
    try {
      // The short last section never reaches the reading line, yet it wins.
      tops = { closing: -600, bearings: -200, detour: 50, reopening: 400 };
      render(
        <>
          <Toc items={items} />
          <Headings />
        </>,
      );
      scrollTo(tops);
      await waitFor(() =>
        expect(screen.getByRole('link', { name: 'Reopening' }).getAttribute('aria-current')).toBe('location'),
      );
    } finally {
      delete (doc as unknown as Record<string, unknown>).scrollHeight;
    }
  });

  it('shows a visible title and keeps the accessible name', () => {
    render(<Toc items={items} title="On this page" label="Contents" />);
    expect(screen.getByRole('navigation', { name: 'Contents' })).toBeTruthy();
    expect(screen.getByText('On this page').getAttribute('data-slot')).toBe('toc-title');
  });
});

describe('Toc folding', () => {
  const long: TocItem[] = Array.from({ length: 4 }, (_, s) => [
    { id: `s${s}`, label: `Section ${s}`, level: 2 as const },
    { id: `s${s}a`, label: `Part ${s}a`, level: 3 as const },
    { id: `s${s}b`, label: `Part ${s}b`, level: 3 as const },
  ]).flat();

  it('folds sub-entries outside the current section above ten entries, out of the tab order', async () => {
    tops = Object.fromEntries(long.map((item, i) => [item.id, 1000 + i * 300]));
    tops.s1 = -50;
    tops.s0 = -1000;
    tops.s0a = -800;
    tops.s0b = -600;
    const { container } = render(
      <>
        <Toc items={long} />
        <Headings list={long} />
      </>,
    );
    const item = (id: string) => container.querySelector<HTMLElement>(`[data-slot="toc-item"][data-id="${id}"]`)!;
    await waitFor(() => expect(item('s1').hasAttribute('data-active')).toBe(true));
    expect(item('s1a').hasAttribute('data-collapsed')).toBe(false);
    expect(item('s0a').hasAttribute('data-collapsed')).toBe(true);
    expect(item('s0a').hasAttribute('inert')).toBe(true);
    // Sections themselves never fold.
    expect(item('s2').hasAttribute('data-collapsed')).toBe(false);
  });

  it('never folds a short list, or when told not to', () => {
    const { container, unmount } = render(<Toc items={items} />);
    expect(container.querySelector('[data-collapsed]')).toBeNull();
    unmount();
    const again = render(<Toc items={long} collapse="never" />);
    expect(again.container.querySelector('[data-collapsed]')).toBeNull();
  });

  it('folds a short list when told to always', () => {
    const { container } = render(<Toc items={items} collapse="always" />);
    expect(container.querySelector('[data-id="bearings"]')!.hasAttribute('data-collapsed')).toBe(true);
  });
});

describe('TocBar', () => {
  it('names the current section on its button', async () => {
    tops = { closing: 600, bearings: 900, detour: 1400, reopening: 2000 };
    render(
      <>
        <TocBar items={items} />
        <Headings />
      </>,
    );
    expect(screen.getByRole('button', { name: 'On this page' })).toBeTruthy();
    scrollTo({ closing: -900, bearings: -500, detour: 100, reopening: 700 });
    await waitFor(() => expect(screen.getByRole('button', { name: /The detour/ })).toBeTruthy());
    expect(screen.getByRole('button', { name: /^On this page/ }).getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('opens the list in a sheet that closes on a pick, with focus on the heading', async () => {
    const onNavigate = vi.fn();
    render(
      <>
        <TocBar items={items} onNavigate={onNavigate} />
        <Headings />
      </>,
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: /On this page/ })));
    const dialog = await screen.findByRole('dialog', { name: 'On this page' });
    expect(dialog).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Table of contents' })).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole('link', { name: 'The detour' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('detour'));
    const heading = document.getElementById('detour')!;
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(heading);
    expect(window.location.hash).toBe('#detour');
  });

  it('carries the page progress as a variable for its hairline', async () => {
    tops = { closing: -300, bearings: 100, detour: 600, reopening: 1200 };
    const { container } = render(
      <>
        <TocBar items={items} />
        <Headings />
      </>,
    );
    const bar = container.querySelector<HTMLElement>('[data-slot="toc-bar"]')!;
    await waitFor(() => expect(bar.style.getPropertyValue('--toc-progress')).not.toBe(''));
    const line = container.querySelector<HTMLElement>('[data-slot="toc-bar-progress"]')!;
    expect(line.className).toContain('scale-x-(--toc-progress,0)');
    expect(line.getAttribute('aria-hidden')).toBe('true');
  });
});
