/**
 * DirectionProvider sets the reading direction for the CSS (`dir`) and for
 * Base UI's keyboard handling (React context) from one prop. These tests
 * prove the keyboard half: without the provider, `dir="rtl"` alone leaves
 * ArrowRight moving to the next tab.
 */
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { DirectionProvider, MIN_VIEWPORT, useDirection } from '../src/primitives/direction.js';
import { Tabs, TabsList, TabsTrigger } from '../src/primitives/tabs.js';

afterEach(cleanup);

const ThreeTabs = () => (
  <Tabs defaultValue="one">
    <TabsList>
      <TabsTrigger value="one">One</TabsTrigger>
      <TabsTrigger value="two">Two</TabsTrigger>
      <TabsTrigger value="three">Three</TabsTrigger>
    </TabsList>
  </Tabs>
);

const Report = () => <output>{useDirection()}</output>;

describe('DirectionProvider', () => {
  it('puts dir on a wrapper that adds no box', () => {
    render(
      <DirectionProvider direction="rtl" lang="ar" className="extra">
        <p>نص</p>
      </DirectionProvider>,
    );
    const root = document.querySelector('[data-slot="direction"]');
    expect(root?.getAttribute('dir')).toBe('rtl');
    expect(root?.getAttribute('lang')).toBe('ar');
    expect(root?.className).toContain('contents');
    expect(root?.className).toContain('extra');
    expect(root?.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
  });

  it('defaults to left to right', () => {
    render(
      <DirectionProvider>
        <Report />
      </DirectionProvider>,
    );
    expect(document.querySelector('[data-slot="direction"]')?.getAttribute('dir')).toBe('ltr');
    expect(screen.getByRole('status').textContent).toBe('ltr');
  });

  it('tells Base UI the direction', () => {
    render(
      <DirectionProvider direction="rtl">
        <Report />
      </DirectionProvider>,
    );
    expect(screen.getByRole('status').textContent).toBe('rtl');
  });

  it('in RTL, ArrowLeft moves to the next tab', async () => {
    const user = userEvent.setup();
    render(
      <DirectionProvider direction="rtl">
        <ThreeTabs />
      </DirectionProvider>,
    );
    await user.click(screen.getByRole('tab', { name: 'One' }));
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Two' }));
  });

  it('in LTR, ArrowRight moves to the next tab', async () => {
    const user = userEvent.setup();
    render(
      <DirectionProvider direction="ltr">
        <ThreeTabs />
      </DirectionProvider>,
    );
    await user.click(screen.getByRole('tab', { name: 'One' }));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Two' }));
  });
});
