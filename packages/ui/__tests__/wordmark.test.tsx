/**
 * Wordmark: a text logo of stacked lines, here one name in three scripts.
 * These lock one accessible name for the whole lockup, a `lang` on every
 * line, and a font seam that names no font and no language.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Topbar } from '../src/patterns/topbar.js';
import { MIN_VIEWPORT, Wordmark } from '../src/patterns/wordmark.js';

const lines = (
  <>
    <Wordmark.Line lang="en">ACME</Wordmark.Line>
    <Wordmark.Line lang="ja">アクメ</Wordmark.Line>
    <Wordmark.Line lang="ar" dir="rtl">
      أكمي
    </Wordmark.Line>
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
    expect(link.getAttribute('data-variant')).toBe('framed');
    expect(link.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(link.className).toContain('focus-visible:ring-[3px]');
    expect(link.className).not.toContain('outline-none');
    const langs = [...container.querySelectorAll('[data-slot="wordmark-line"]')].map((l) => [
      l.getAttribute('lang'),
      l.getAttribute('dir'),
    ]);
    expect(langs).toEqual([
      ['en', null],
      ['ja', null],
      ['ar', 'rtl'],
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

  it('uses the heading font stack and special-cases no language', () => {
    render(<Wordmark label="Hello">{lines}</Wordmark>);
    const cls = screen.getByRole('img').className;
    expect(cls).toContain('font-heading');
    expect(cls).not.toContain(':lang(');
    expect(cls).not.toMatch(/--font-(arabic|hebrew)/);
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
  it('is md by default and steps down on a phone when responsive', () => {
    const { container, rerender } = render(
      <Wordmark href="/" label="Hello, home">
        {lines}
      </Wordmark>,
    );
    const root = () => container.querySelector('[data-slot="wordmark"]')!;
    expect(root().getAttribute('data-size')).toBe('md');
    expect(root().className).toContain('px-5');
    rerender(
      <Wordmark href="/" label="Hello, home" size="responsive">
        {lines}
      </Wordmark>,
    );
    expect(root().getAttribute('data-size')).toBe('responsive');
    expect(root().className).toContain('px-3');
    expect(root().className).toContain('md:px-5');
    const line = container.querySelector('[data-slot="wordmark-line"]')!;
    expect(line.className).toContain('max-md:group-data-[size=responsive]/wordmark:text-xs');
  });

  it('keeps a plain lockup bare at every size', () => {
    const { container } = render(
      <Wordmark label="Hello" variant="plain" size="sm">
        {lines}
      </Wordmark>,
    );
    const root = container.querySelector('[data-slot="wordmark"]')!;
    expect(root.className).not.toContain('px-3');
    expect(root.className).not.toContain('outline-2');
  });
});
