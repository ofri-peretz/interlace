/**
 * Timeline: a short dated record. These lock what a reader depends on: a
 * real ordered list in date order, every part in words, a dot that is never
 * read, and a vertical-only timeline that never becomes a size container.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MIN_VIEWPORT, Timeline } from '../src/patterns/timeline.js';

describe('Timeline', () => {
  it('is an ordered list of events with date, title, body and source as text', () => {
    const { container } = render(
      <Timeline aria-label="The record">
        <Timeline.Item date="1968" title="Council vote" source="City archive, minutes">
          <q>The bridge will be built.</q>
        </Timeline.Item>
        <Timeline.Item date="1993" title="Letter" />
      </Timeline>,
    );
    const list = screen.getByRole('list', { name: 'The record' });
    expect(list.tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const first = container.querySelector('[data-slot="timeline-item"]');
    for (const slot of ['date', 'title', 'body', 'source']) {
      expect(first?.querySelector(`[data-slot="timeline-${slot}"]`)).not.toBeNull();
    }
    const second = container.querySelectorAll('[data-slot="timeline-item"]')[1];
    expect(second?.querySelector('[data-slot="timeline-body"]')).toBeNull();
    expect(second?.querySelector('[data-slot="timeline-source"]')).toBeNull();
  });

  it('hides the dot and keeps the date-only item to its date', () => {
    const { container } = render(
      <Timeline>
        <Timeline.Item date="2024" />
      </Timeline>,
    );
    expect(container.querySelector('[data-slot="timeline-dot"]')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[data-slot="timeline-title"]')).toBeNull();
    expect(screen.getByRole('listitem').textContent).toBe('2024');
  });

  it('marks the accent event on the item and in the dot colour', () => {
    const { container } = render(
      <Timeline>
        <Timeline.Item date="1968" />
        <Timeline.Item date="1977" marker="accent" />
      </Timeline>,
    );
    const items = [...container.querySelectorAll('[data-slot="timeline-item"]')];
    expect(items.map((li) => li.getAttribute('data-marker'))).toEqual(['default', 'accent']);
    expect(items[1]?.querySelector('[data-slot="timeline-dot"]')?.className).toContain('bg-highlight');
  });

  it('is a size container only when responsive', () => {
    const { container, rerender } = render(<Timeline />);
    const root = () => container.querySelector('[data-slot="timeline"]');
    expect(root()?.className).toContain('@container/timeline');
    expect(root()?.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(container.querySelector('ol')?.getAttribute('data-orientation')).toBe('responsive');
    rerender(<Timeline orientation="vertical" />);
    expect(root()?.className ?? '').not.toContain('@container');
    expect(container.querySelector('ol')?.getAttribute('data-orientation')).toBe('vertical');
  });

  it('merges className onto the list', () => {
    const { container } = render(<Timeline className="mt-8" />);
    expect(container.querySelector('ol')?.className).toContain('mt-8');
  });
});
