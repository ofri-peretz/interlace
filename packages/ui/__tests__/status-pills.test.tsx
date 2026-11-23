/**
 * StatusPills: short facts about a page as a row of pills. These lock a real
 * list, the ok pill's hidden check, and that the default pill takes its
 * colour from the band around it.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MIN_VIEWPORT, StatusPills } from '../src/patterns/status-pills.js';

describe('StatusPills', () => {
  it('is a list of pills whose words carry the meaning', () => {
    const { container } = render(
      <StatusPills aria-label="About this answer" className="mt-4">
        <StatusPills.Item tone="ok">Checked by a second reader</StatusPills.Item>
        <StatusPills.Item>9 facts</StatusPills.Item>
      </StatusPills>,
    );
    const list = screen.getByRole('list', { name: 'About this answer' });
    expect(list.className).toContain('mt-4');
    expect(list.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Checked by a second reader', '9 facts']);
    expect(items.map((li) => li.getAttribute('data-tone'))).toEqual(['ok', 'default']);
    expect(container.querySelectorAll('[data-slot="status-pill-check"]')).toHaveLength(1);
  });

  it('hides the check and keeps the ok pill on the page background', () => {
    const { container } = render(
      <StatusPills>
        <StatusPills.Item tone="ok">Checked</StatusPills.Item>
      </StatusPills>,
    );
    expect(container.querySelector('[data-slot="status-pill-check"]')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('listitem').className).toContain('bg-background');
  });

  it('tints the default pill from the surrounding text colour', () => {
    render(
      <StatusPills>
        <StatusPills.Item>38 sources quoted</StatusPills.Item>
      </StatusPills>,
    );
    expect(screen.getByRole('listitem').className).toContain('bg-current/12');
  });
});
