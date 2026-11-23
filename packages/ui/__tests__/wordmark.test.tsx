/**
 * Wordmark: a name in several scripts, stacked. These lock one accessible
 * name for the whole lockup, a `lang` on every line, and the Arabic font
 * seam that names no font.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Topbar } from '../src/patterns/topbar.js';
import { MIN_VIEWPORT, Wordmark } from '../src/patterns/wordmark.js';

const lines = (
  <>
    <Wordmark.Line lang="he" dir="rtl">
      שלום
    </Wordmark.Line>
    <Wordmark.Line lang="ar" dir="rtl">
      مرحبا
    </Wordmark.Line>
    <Wordmark.Line lang="en">HELLO</Wordmark.Line>
  </>
);

describe('Wordmark', () => {
  it('is one link with one name when it has an href', () => {
    const { container } = render(
      <Wordmark href="/" label="Hello, home">
        {lines}
      </Wordmark>,
    );
    const link = screen.getByRole('link', { name: 'Hello, home' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.getAttribute('data-variant')).toBe('sign');
    expect(link.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(link.className).toContain('focus-visible:ring-[3px]');
    expect(link.className).not.toContain('outline-none');
    const langs = [...container.querySelectorAll('[data-slot="wordmark-line"]')].map((l) => [
      l.getAttribute('lang'),
      l.getAttribute('dir'),
    ]);
    expect(langs).toEqual([
      ['he', 'rtl'],
      ['ar', 'rtl'],
      ['en', null],
    ]);
  });

  it('is an image of text with one name when it has no href', () => {
    render(
      <Wordmark label="Hello" variant="plain" className="mt-2">
        {lines}
      </Wordmark>,
    );
    const img = screen.getByRole('img', { name: 'Hello' });
    expect(img.tagName).toBe('SPAN');
    expect(img.className).toContain('mt-2');
    expect(img.className).not.toContain('bg-background');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('drops the default outline only on a plain link', () => {
    render(
      <Wordmark href="/" label="Hello" variant="plain">
        {lines}
      </Wordmark>,
    );
    expect(screen.getByRole('link').className).toContain('outline-none');
  });

  it('sends Arabic lines to --font-arabic and names no font', () => {
    render(<Wordmark label="Hello">{lines}</Wordmark>);
    const cls = screen.getByRole('img').className;
    expect(cls).toContain('font-(family-name:--font-arabic)');
    expect(cls).toContain('font-heading');
  });

  it('fits the Topbar logo slot: the row grows instead of clipping', () => {
    const { container } = render(
      <Topbar
        logo={
          <Wordmark href="/" label="Hello, home">
            {lines}
          </Wordmark>
        }
        mobileNav="none"
      />,
    );
    expect(screen.getByRole('link', { name: 'Hello, home' })).toBeTruthy();
    const row = container.querySelector('[data-slot="topbar"] > div');
    expect(row?.className).toContain('min-h-14');
    expect(row?.className).not.toMatch(/(^|\s)h-14(\s|$)/);
  });
});
