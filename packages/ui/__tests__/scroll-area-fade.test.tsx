/**
 * ScrollArea edge fades. jsdom cannot paint a mask or scroll, so this locks
 * the contract the browser check relies on: the mask reads Base UI's own
 * overflow variables (so it is 0 at an edge and with no overflow), it falls
 * back to 0 when they are unset, it drops under keyboard focus so the ring
 * is not clipped, and `fade="none"` leaves no mask at all.
 */

import { cleanup, render } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ScrollArea } from '../src/primitives/scroll-area.js';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const viewport = () =>
  document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;

describe('ScrollArea edge fades', () => {
  it('fades both edges by default, driven by the overflow variables', () => {
    render(<ScrollArea>content</ScrollArea>);
    const vp = viewport();
    expect(vp.dataset.fade).toBe('edges');
    expect(vp.className).toContain('var(--scroll-area-overflow-y-start,0px)');
    expect(vp.className).toContain('var(--scroll-area-overflow-y-end,0px)');
    expect(vp.className).toContain('focus-visible:[mask-image:none]');
  });

  it('keeps the focus ring classes', () => {
    render(<ScrollArea>content</ScrollArea>);
    expect(viewport().className).toContain('focus-visible:ring-2');
  });

  it('fade="none" has no mask', () => {
    render(<ScrollArea fade="none">content</ScrollArea>);
    const vp = viewport();
    expect(vp.dataset.fade).toBe('none');
    expect(vp.className).not.toContain('mask-image');
  });
});
