/**
 * List (R26) — locks what a reader relies on: `number` is a real `ol` (so the
 * browser numbers it and screen readers count it), every other marker is a
 * `ul`, the marker is CSS on the item (never text a screen reader reads), and
 * the item content is whatever the caller put there.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { List, ListItem, MIN_VIEWPORT } from '../src/primitives/list.js';

describe('List', () => {
  it('renders a ul with bullets by default', () => {
    render(
      <List aria-label="Things">
        <ListItem>One</ListItem>
      </List>,
    );
    const list = screen.getByRole('list', { name: 'Things' });
    expect(list.tagName).toBe('UL');
    expect(list.dataset.marker).toBe('bullet');
    expect(list.dataset.minViewport).toBe(String(MIN_VIEWPORT));
  });

  it('renders an ol for marker="number" and keeps start', () => {
    render(
      <List marker="number" start={4} aria-label="Claims">
        <List.Item>Four</List.Item>
        <List.Item>Five</List.Item>
      </List>,
    );
    const list = screen.getByRole('list', { name: 'Claims' });
    expect(list.tagName).toBe('OL');
    expect(list.getAttribute('start')).toBe('4');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it.each(['check', 'cross'] as const)('renders a ul for marker="%s"', (marker) => {
    render(
      <List marker={marker} aria-label="Marks">
        <ListItem>Item</ListItem>
      </List>,
    );
    const list = screen.getByRole('list', { name: 'Marks' });
    expect(list.tagName).toBe('UL');
    expect(list.dataset.marker).toBe(marker);
  });

  it('draws the marker in CSS, so the item text is only the content', () => {
    render(
      <List marker="cross">
        <ListItem>
          That the bridge is <strong>unsafe</strong>.
        </ListItem>
      </List>,
    );
    const item = screen.getByRole('listitem');
    expect(item.textContent).toBe('That the bridge is unsafe.');
    expect(item.querySelector('[data-slot=list-marker]')?.getAttribute('aria-hidden')).toBe('true');
    expect(item.dataset.slot).toBe('list-item');
  });

  it('spaces items by density and merges className', () => {
    render(
      <List density="compact" className="mt-4" aria-label="Tight">
        <ListItem>One</ListItem>
      </List>,
    );
    const list = screen.getByRole('list', { name: 'Tight' });
    expect(list.className).toContain('space-y-1.5');
    expect(list.className).toContain('mt-4');
  });

  it('accepts ol props only on a numbered list', () => {
    render(
      <>
        <List marker="number" start={4} reversed aria-label="From four" />
        {/* @ts-expect-error start is an ol prop; a bullet list renders a ul */}
        <List marker="bullet" start={4} aria-label="Bullets" />
      </>,
    );
    expect(screen.getByRole('list', { name: 'From four' }).getAttribute('start')).toBe('4');
  });
});
