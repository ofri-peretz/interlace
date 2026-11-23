import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
/**
 * Citation (R26) — the inline source marker. Locks the parts a reader relies
 * on: the claim text renders without opening anything, the marker opens with
 * the keyboard and closes on Escape, several sources stack in one popover,
 * the status badge shows, and only https links become links.
 */
import { describe, expect, it } from 'vitest';

import { Citation, chipText, safeHref } from '../src/patterns/citation.js';

const SOURCES = [
  {
    publisher: 'Reuters',
    url: 'https://www.reuters.com/world/example',
    kind: 'news report',
    quote: 'The exact words from the page.',
  },
  {
    publisher: 'Bad data',
    // eslint-disable-next-line no-script-url
    url: 'javascript:alert(1)',
    kind: 'blog',
    quote: 'A second quote.',
  },
];

describe('safeHref', () => {
  it('keeps https and drops everything else', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a');
    expect(safeHref('http://example.com/a')).toBeUndefined();
    // eslint-disable-next-line no-script-url
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('not a url')).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});

describe('Citation', () => {
  it('renders the claim text and a numbered marker without opening', () => {
    render(
      <p>
        <Citation sources={SOURCES} number={3}>
          The claim.
        </Citation>
      </p>,
    );
    expect(screen.getByText('The claim.')).toBeTruthy();
    const trigger = screen.getByRole('button', { name: 'Sources (2)' });
    expect(trigger.textContent).toBe('[3]');
    expect(trigger.closest('sup')).not.toBeNull();
    expect(screen.queryByText('The exact words from the page.')).toBeNull();
  });

  it('opens from the keyboard, stacks every source, and closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Citation sources={SOURCES} status="short">
        The claim.
      </Citation>,
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sources (2)' }));
    await user.keyboard('{Enter}');

    await screen.findByText('The exact words from the page.');
    expect(screen.getByText('A second quote.')).toBeTruthy();
    expect(screen.getByText('Short of sources')).toBeTruthy();
    expect(document.querySelectorAll('[data-slot="citation-source"]')).toHaveLength(2);

    const reuters = screen.getByRole('link', { name: 'Reuters' });
    expect(reuters.getAttribute('href')).toBe('https://www.reuters.com/world/example');
    expect(reuters.getAttribute('rel')).toContain('noopener');
    // The javascript: source renders as text, never as a link.
    expect(screen.queryByRole('link', { name: 'Bad data' })).toBeNull();
    expect(screen.getByText('Bad data')).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('A second quote.')).toBeNull());
  });

  it('puts a pill naming the source after the text for marker="chip"', async () => {
    const user = userEvent.setup();
    render(
      <p>
        <Citation sources={SOURCES} marker="chip">
          The claim.
        </Citation>
      </p>,
    );
    expect(screen.getByText('The claim.')).toBeTruthy();
    // Visible text first, so a voice user can say what they see (WCAG 2.5.3).
    const trigger = screen.getByRole('button', { name: /^Reuters · Bad data ?, Sources \(2\)$/ });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.closest('sup')).toBeNull();
    await user.click(trigger);
    await screen.findByText('The exact words from the page.');
  });

  it('lets chipLabel shorten the pill', () => {
    render(
      <Citation sources={SOURCES} marker="chip" chipLabel="Reuters">
        The claim.
      </Citation>,
    );
    expect(screen.getByRole('button', { name: /^Reuters ?, Sources \(2\)$/ })).toBeTruthy();
  });

  it('caps a long pill and truncates it, keeping the whole text in its name', () => {
    const long = 'A Very Long Commission Name of Some International Body, and 3 more';
    render(
      <Citation sources={SOURCES} marker="chip" chipLabel={long}>
        The claim.
      </Citation>,
    );
    const button = screen.getByRole('button', { name: new RegExp(`^${long} ?, Sources`) });
    expect(button.className).toContain('max-w-[min(24ch,100%)]');
    const label = button.querySelector('[data-slot="citation-chip-label"]')!;
    expect(label.className).toContain('truncate');
    expect(label.textContent).toBe(long);
  });

  it('names each publisher once in the default pill text', () => {
    expect(chipText([{ publisher: 'AP' }, { publisher: 'AFP' }, { publisher: 'AP' }])).toBe(
      'AP · AFP',
    );
  });

  it('makes the text itself the trigger for marker="underline"', async () => {
    const user = userEvent.setup();
    render(
      <Citation sources={SOURCES.slice(0, 1)} marker="underline">
        a long phrase that has to wrap
      </Citation>,
    );
    const trigger = screen.getByRole('button', { name: /a long phrase that has to wrap/ });
    expect(trigger.tagName).toBe('SPAN');
    await user.click(trigger);
    await screen.findByText('The exact words from the page.');
  });

  it('renders plain words, with no marker, when there are no sources', () => {
    const { container } = render(
      <Citation marker="chip" sources={[]}>
        An unsourced line.
      </Citation>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).toBe('An unsourced line.');
    expect(container.querySelector('[data-slot="citation"]')?.getAttribute('data-marker')).toBe('none');
  });
});
