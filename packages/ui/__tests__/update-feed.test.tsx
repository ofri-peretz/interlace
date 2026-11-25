/**
 * UpdateFeed locks: newest first under real <time> headings, "New" in words
 * after `since` and never on a first visit, the summary count, the router
 * seam, month grouping and the empty state. The model is tested on its own.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { UpdateFeed } from '../src/patterns/update-feed.js';
import { countNewSince, groupUpdates, isNewSince, sortUpdates } from '../src/patterns/update-feed-model.js';

afterEach(cleanup);

const ENTRIES = [
  { id: 'b', date: '2026-11-20', kind: 'Article', title: 'Tide tables, explained', href: '/b' },
  { id: 'c', date: '2026-11-24', kind: 'Release', title: 'Version 2', href: '/c', description: 'Faster search.' },
  { id: 'a', date: '2026-11-24', kind: 'Article', title: 'Reading a nautical chart', href: '/a' },
  { id: 'd', date: '2026-10-02', title: 'Autumn schedule' },
];

describe('update-feed-model', () => {
  it('sorts newest first with ids breaking ties, unreadable dates last', () => {
    expect(sortUpdates([...ENTRIES, { id: 'x', date: 'soon' }]).map((e) => e.id)).toEqual(['a', 'c', 'b', 'd', 'x']);
  });
  it('groups by day or month and skips unreadable dates', () => {
    expect(groupUpdates([...ENTRIES, { id: 'x', date: '' }]).map((g) => [g.key, g.entries.length])).toEqual([
      ['2026-11-24', 2],
      ['2026-11-20', 1],
      ['2026-10-02', 1],
    ]);
    expect(groupUpdates(ENTRIES, 'month').map((g) => g.key)).toEqual(['2026-11', '2026-10']);
  });
  it('marks nothing new on a first visit and counts what came after since', () => {
    expect(isNewSince(ENTRIES[0]!, null)).toBe(false);
    expect(isNewSince(ENTRIES[0]!, 'garbage')).toBe(false);
    expect(countNewSince(ENTRIES, '2026-11-21')).toBe(2);
    expect(countNewSince(ENTRIES, '2026-11-24T09:00:00Z')).toBe(0);
  });
});

describe('UpdateFeed', () => {
  it('renders groups labelled by real dates, newest first', () => {
    render(<UpdateFeed entries={ENTRIES} locale="en-US" />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['November 24, 2026', 'November 20, 2026', 'October 2, 2026']);
    expect(headings[0]!.querySelector('time')!.getAttribute('dateTime')).toBe('2026-11-24');
    expect(screen.getByRole('region', { name: 'November 24, 2026' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Reading a nautical chart',
      'Version 2',
      'Tide tables, explained',
      'Autumn schedule',
    ]);
    expect(screen.getByRole('link', { name: 'Version 2' }).getAttribute('href')).toBe('/c');
    expect(document.querySelector('[data-slot="update-feed-summary"]')).toBeNull();
  });

  it('tags entries after since as New, in words, and says how many', () => {
    render(<UpdateFeed entries={ENTRIES} since="2026-11-21" locale="en-US" />);
    const fresh = document.querySelectorAll('[data-slot="update-feed-entry"][data-new]');
    expect(fresh).toHaveLength(2);
    expect(fresh[0]!.textContent).toContain('New');
    expect(document.querySelector('[data-slot="update-feed-summary"]')!.textContent).toBe(
      '2 new since your last visit',
    );
  });

  it('hands links to renderLink, moves headings down a level and groups by month', () => {
    render(
      <UpdateFeed
        entries={ENTRIES}
        groupBy="month"
        headingLevel={3}
        locale="en-US"
        renderLink={({ href, children, ...rest }) => (
          <a href={`/app${href}`} data-router="" {...rest}>
            {children}
          </a>
        )}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'November 2026',
      'October 2026',
    ]);
    const link = screen.getByRole('link', { name: 'Version 2' });
    expect(link.getAttribute('href')).toBe('/app/c');
    expect(link.dataset.slot).toBe('update-feed-title');
  });

  it('says so when there is nothing', () => {
    render(<UpdateFeed entries={[]} labels={{ empty: 'No updates.' }} />);
    expect(screen.getByText('No updates.')).toBeTruthy();
  });
});
