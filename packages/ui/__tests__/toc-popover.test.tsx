/**
 * TocPopover on a narrow screen: a long outline scrolls inside the room the
 * screen has left, and picking a link closes the popover with focus on the
 * heading it jumped to, not back on the trigger.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toc, TocPopover, type TocItem } from '../src/primitives/toc.js';

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const items: TocItem[] = [
  { id: 'one', label: 'One', level: 2 },
  { id: 'two', label: 'Two', level: 2 },
];

function Page(props: { onNavigate?: (id: string) => void }) {
  return (
    <>
      <TocPopover items={items} onNavigate={props.onNavigate} />
      <h2 id="one">One</h2>
      <h2 id="two">Two</h2>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', StubObserver);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe('TocPopover', () => {
  it('caps its height at the room left on screen and scrolls', async () => {
    render(<Page />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'On this page' })));
    const content = await waitFor(() => document.querySelector<HTMLElement>('[data-slot="toc-popover-content"]')!);
    expect(content.className).toContain('max-h-(--available-height)');
    expect(content.className).toContain('overflow-y-auto');
  });

  it('closes when a link is picked and leaves focus on the heading', async () => {
    const onNavigate = vi.fn();
    render(<Page onNavigate={onNavigate} />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'On this page' })));
    const link = await screen.findByRole('link', { name: 'Two' });
    act(() => fireEvent.click(link));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Two' })).toBeNull());
    const heading = document.getElementById('two')!;
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(heading);
    expect(onNavigate).toHaveBeenCalledWith('two');
  });
});

describe('Toc', () => {
  it('keeps a tabindex the heading already has', () => {
    render(
      <>
        <Toc items={items} />
        <h2 id="one" tabIndex={0}>
          One
        </h2>
        <h2 id="two">Two</h2>
      </>,
    );
    act(() => fireEvent.click(screen.getByRole('link', { name: 'One' })));
    expect(document.getElementById('one')!.getAttribute('tabindex')).toBe('0');
  });
});
