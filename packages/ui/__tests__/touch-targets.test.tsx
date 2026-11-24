/**
 * Touch targets and scrolling regions.
 *
 * - Tabs: a trigger is at least the target size (24px, 44px under
 *   data-density="comfortable") and the list grows to hold it.
 * - Slider: the thumb carries an invisible target-size hit area; the 20px
 *   knob itself is unchanged.
 * - Prose: a `<pre>` or `<table>` that scrolls sideways is focusable and
 *   named; one that fits is not a stray tab stop; author attributes win.
 */
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Prose } from '../src/primitives/prose.js';
import { SimpleSlider } from '../src/primitives/slider.js';
import { Tabs, TabsList, TabsTrigger } from '../src/primitives/tabs.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Tabs', () => {
  it('sizes triggers to the target token and lets the list grow', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const list = container.querySelector('[data-slot="tabs-list"]')!;
    expect(list.className).toContain('min-h-control');
    expect(list.className).toContain('items-stretch');
    expect(list.className).not.toMatch(/(^|\s)h-control/);
    for (const trigger of container.querySelectorAll('[data-slot="tabs-trigger"]')) {
      expect(trigger.className).toContain('min-h-target');
    }
  });
});

describe('Slider', () => {
  it('gives the thumb a target-size hit area without changing the knob', () => {
    const { container } = render(<SimpleSlider label="Volume" defaultValue={40} />);
    const thumb = container.querySelector('[data-slot="slider-thumb"]')!;
    expect(thumb.className).toContain('before:size-target');
    expect(thumb.className).toContain('size-5');
  });
});

/** jsdom has no layout: give every pre/table a fixed scrollWidth and clientWidth. */
function fakeWidths(scroll: () => number, client = 300) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(scroll);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => client);
}

const Content = ({ labelled = false }: { labelled?: boolean }) => (
  <>
    <pre>wide code</pre>
    <table>
      <tbody>
        <tr>
          <td>x</td>
        </tr>
      </tbody>
    </table>
    <table>
      <caption>Seats by list</caption>
      <tbody>
        <tr>
          <td>y</td>
        </tr>
      </tbody>
    </table>
    {labelled ? (
      <pre tabIndex={-1} aria-label="Mine">
        author
      </pre>
    ) : null}
  </>
);

describe('Prose scrolling regions', () => {
  it('leaves a pre or table that fits alone', () => {
    fakeWidths(() => 200);
    const { container } = render(
      <Prose>
        <Content />
      </Prose>,
    );
    for (const el of container.querySelectorAll('pre, table')) {
      expect(el.hasAttribute('tabindex')).toBe(false);
      expect(el.hasAttribute('aria-label')).toBe(false);
    }
  });

  it('makes an overflowing one focusable and named, then takes it back when it fits', () => {
    let wide = 900;
    fakeWidths(() => wide);
    let resize: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resize = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const { container, unmount } = render(
      <Prose>
        <Content labelled />
      </Prose>,
    );
    const [pre, plain, captioned, authored] = [
      ...container.querySelectorAll<HTMLElement>('pre, table'),
    ] as HTMLElement[];
    // In document order: pre, table, table, pre.
    expect(pre!.tagName).toBe('PRE');
    expect(pre!.getAttribute('tabindex')).toBe('0');
    expect(pre!.getAttribute('role')).toBe('region');
    expect(pre!.getAttribute('aria-label')).toBe('Code, scrolls sideways');
    expect(plain!.getAttribute('tabindex')).toBe('0');
    expect(plain!.hasAttribute('role')).toBe(false);
    expect(plain!.getAttribute('aria-label')).toBe('Table, scrolls sideways');
    // A caption already names the table.
    expect(captioned!.getAttribute('tabindex')).toBe('0');
    expect(captioned!.hasAttribute('aria-label')).toBe(false);
    // The author's own tabindex and label win.
    expect(authored!.getAttribute('tabindex')).toBe('-1');
    expect(authored!.getAttribute('aria-label')).toBe('Mine');
    expect(authored!.hasAttribute('role')).toBe(false);

    wide = 200;
    act(() => resize());
    for (const el of [pre, plain, captioned]) {
      expect(el!.hasAttribute('tabindex')).toBe(false);
      expect(el!.hasAttribute('data-prose-scroll')).toBe(false);
    }
    expect(pre!.hasAttribute('role')).toBe(false);
    expect(pre!.hasAttribute('aria-label')).toBe(false);
    expect(plain!.hasAttribute('aria-label')).toBe(false);
    expect(authored!.getAttribute('aria-label')).toBe('Mine');

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('keeps an author role and label on an overflowing pre', () => {
    fakeWidths(() => 900);
    const { container } = render(
      <Prose>
        <pre role="figure" aria-labelledby="cap">
          x
        </pre>
      </Prose>,
    );
    const pre = container.querySelector('pre')!;
    expect(pre.getAttribute('tabindex')).toBe('0');
    expect(pre.getAttribute('role')).toBe('figure');
    expect(pre.hasAttribute('aria-label')).toBe(false);
  });
});
