// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RegistrySearch, type SearchItem } from '@/components/registry-search';

/**
 * The keyboard path, asserted by something that can press a key.
 *
 * This is the DS's own rule, taken from the charts work: an automated
 * accessibility scan cannot press a key, so it scored a hover-only crosshair
 * green. A search box is exactly the same shape of risk — every affordance here
 * (⌘K, `/`, ArrowDown into the results, Escape to clear) is invisible to axe and
 * to every static check, and all of them are one refactor away from silently
 * doing nothing.
 *
 * The equivalent of a Storybook `play` function, run in jsdom against the real
 * component and the real generated index.
 */

const index = JSON.parse(
  readFileSync(join(process.cwd(), 'public/data/search-index.json'), 'utf8'),
);

const items: SearchItem[] = index.items.slice(0, 40).map(
  (i: { name: string; title: string; blurb: string; categories: string[]; tier: string }) => ({
    name: i.name,
    title: i.title,
    description: i.blurb,
    categories: i.categories,
    meta: { tier: i.tier },
  }),
);

const tiers: Array<[string, string]> = [
  ['primitive', 'Primitives'],
  ['pattern', 'Patterns'],
];

beforeEach(() => {
  // The component fetches its index on first intent. Serve the real one.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => index }) as unknown as Response),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const field = () => screen.getByRole('searchbox', { name: /search components/i });
const results = () =>
  Array.from(document.querySelectorAll<HTMLAnchorElement>('a[data-search-result]'));

describe('RegistrySearch keyboard contract', () => {
  it('“/” focuses the field from anywhere on the page', async () => {
    const user = userEvent.setup();
    render(<RegistrySearch items={items} tiers={tiers} />);
    document.body.focus();
    await user.keyboard('/');
    expect(field()).toHaveFocus();
  });

  it('⌘K focuses and selects, so the next keystroke replaces the old query', async () => {
    const user = userEvent.setup();
    render(<RegistrySearch items={items} tiers={tiers} />);
    await user.click(field());
    await user.keyboard('badge');
    field().blur();
    await user.keyboard('{Meta>}k{/Meta}');
    expect(field()).toHaveFocus();
    await user.keyboard('button');
    expect(field()).toHaveValue('button');
  });

  it('ArrowDown steps from the field into the results and back out again', async () => {
    const user = userEvent.setup();
    render(<RegistrySearch items={items} tiers={tiers} />);
    await user.click(field());
    await user.keyboard('button');
    await waitFor(() => expect(results().length).toBeGreaterThan(1));

    await user.keyboard('{ArrowDown}');
    expect(results()[0]).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(results()[1]).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(results()[0]).toHaveFocus();

    // Up from the first result returns to the field rather than trapping focus.
    await user.keyboard('{ArrowUp}');
    expect(field()).toHaveFocus();
  });

  it('Escape clears the query and the tier filter, and returns focus to the field', async () => {
    const user = userEvent.setup();
    render(<RegistrySearch items={items} tiers={tiers} />);
    await user.click(screen.getByRole('button', { name: 'Primitives' }));
    await user.click(field());
    await user.keyboard('button');
    await waitFor(() => expect(results().length).toBeGreaterThan(0));

    // Escape works from a result too, not only from the field — otherwise a
    // keyboard user who has stepped into the list has no way back.
    await user.keyboard('{ArrowDown}');
    expect(results()[0]).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(field()).toHaveValue('');
    expect(field()).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Primitives' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(results()).toHaveLength(0);
  });

  it('announces the result count in a live region', async () => {
    const user = userEvent.setup();
    render(<RegistrySearch items={items} tiers={tiers} />);
    await user.click(field());
    await user.keyboard('button');
    const status = await screen.findByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => expect(status.textContent).toMatch(/\d+ match(es)?/));
  });

  it('the ⌘K hint is decorative, not an unlabelled control', () => {
    render(<RegistrySearch items={items} tiers={tiers} />);
    // Two ⌘K glyphs: the decorative badge in the field, and the one in the
    // hint sentence. Only the badge is hidden from assistive tech.
    const [badge] = screen.getAllByText('⌘K');
    expect(badge).toHaveAttribute('aria-hidden');
    // The shortcut is still ANNOUNCED — in the hint the field points at.
    expect(field()).toHaveAttribute('aria-describedby', 'registry-search-hint');
    expect(document.getElementById('registry-search-hint')?.textContent).toMatch(/Esc/);
  });
});

describe('RegistrySearch ranking, through the UI', () => {
  it('degrades to a name filter before the index arrives, then ranks once it lands', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const user = userEvent.setup();
    render(<RegistrySearch items={items} tiers={tiers} />);
    await user.click(field());
    // A question no substring filter can answer.
    await user.keyboard('loading placeholder');
    expect(results()).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toContain('0 matches');

    resolveFetch({ ok: true, json: async () => index });
    await waitFor(() => expect(results().length).toBeGreaterThan(0));
    const first = results()[0];
    expect(within(first).getByRole('heading').textContent).toBe('Skeleton');
  });
});
