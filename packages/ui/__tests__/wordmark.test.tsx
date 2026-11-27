/**
 * Wordmark: a text logo of stacked lines, here one name in three scripts.
 * These lock one accessible name for the whole lockup, a `lang` on every
 * line, and a font seam that names no font and no language.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

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

const LABEL = 'ACME アクメ أكمي, home';
// The hint is a block-level box (it is absolutely positioned), so a browser puts a space before
// it: "أكمي , home". Compare with that space folded out.
const named = (expected: string) => (name: string) => name.replace(/\s+,/g, ',') === expected;

afterEach(() => vi.restoreAllMocks());

describe('Wordmark', () => {
  it('is one link with one name when it has an href', () => {
    const { container } = render(
      <Wordmark href="/" label={LABEL}>
        {lines}
      </Wordmark>,
    );
    const link = screen.getByRole('link', { name: named(LABEL) });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.getAttribute('data-variant')).toBe('framed');
    expect(link.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(link.className).toContain('focus-visible:ring-2');
    expect(link.className).not.toContain('outline-hidden');
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
      <Wordmark href="/" variant="plain">
        {lines}
      </Wordmark>,
    );
    expect(screen.getByRole('link').className).toContain('focus-visible:outline-hidden');
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
          <Wordmark href="/" hint=", home">
            {lines}
          </Wordmark>
        }
        mobileNav="none"
      />,
    );
    expect(screen.getByRole('link', { name: named(LABEL) })).toBeTruthy();
    const row = container.querySelector('[data-slot="topbar"] > div');
    expect(row?.className).toContain('min-h-14');
    expect(row?.className).not.toMatch(/(^|\s)h-14(\s|$)/);
  });
  it('is md by default and steps down on a phone when responsive', () => {
    const { container, rerender } = render(
      <Wordmark href="/" hint=", home">
        {lines}
      </Wordmark>,
    );
    const root = () => container.querySelector('[data-slot="wordmark"]')!;
    expect(root().getAttribute('data-size')).toBe('md');
    expect(root().className).toContain('px-5');
    rerender(
      <Wordmark href="/" hint=", home" size="responsive">
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

describe('Wordmark: the link is named by its lines', () => {
  it('has the lines, in order, as its name when there is no label', () => {
    render(<Wordmark href="/">{lines}</Wordmark>);
    expect(screen.getByRole('link', { name: 'ACME アクメ أكمي' }).hasAttribute('aria-label')).toBe(false);
  });

  it('ends the name with the hint, which is the last child and visually hidden', () => {
    const { container } = render(
      <Wordmark href="/" hint=", home">
        {lines}
      </Wordmark>,
    );
    const link = screen.getByRole('link', { name: named(LABEL) });
    const hint = link.lastElementChild!;
    expect(hint.getAttribute('data-slot')).toBe('wordmark-hint');
    expect(hint.className).toContain('sr-only');
    expect(hint.textContent).toBe(', home');
    expect(container.querySelectorAll('[data-slot="wordmark-hint"]')).toHaveLength(1);
    expect(link.querySelectorAll('[data-slot="wordmark-line"]')).toHaveLength(3);
  });

  it('renders no hint element for an empty hint, or when a label names the link', () => {
    const { container, rerender } = render(<Wordmark href="/">{lines}</Wordmark>);
    expect(container.querySelector('[data-slot="wordmark-hint"]')).toBeNull();
    rerender(
      <Wordmark href="/" hint="">
        {lines}
      </Wordmark>,
    );
    expect(container.querySelector('[data-slot="wordmark-hint"]')).toBeNull();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    rerender(
      <Wordmark href="/" label="Other" hint=", home">
        {lines}
      </Wordmark>,
    );
    expect(container.querySelector('[data-slot="wordmark-hint"]')).toBeNull();
    expect(screen.getByRole('link').getAttribute('aria-label')).toBe('Other');
  });

  it('names the link by a label that contains its lines', () => {
    render(
      <Wordmark href="/" label="ACME アクメ أكمي, home">
        {lines}
      </Wordmark>,
    );
    expect(screen.getByRole('link', { name: 'ACME アクメ أكمي, home' })).toBeTruthy();
  });

  it('keeps each line language', () => {
    const { container } = render(
      <Wordmark href="/" hint=", home">
        {lines}
      </Wordmark>,
    );
    const langs = [...container.querySelectorAll('[data-slot="wordmark-line"]')].map((l) => l.getAttribute('lang'));
    expect(langs).toEqual(['en', 'ja', 'ar']);
  });

  it('keeps label as the name of an image of text', () => {
    render(<Wordmark label="Acme">{lines}</Wordmark>);
    expect(screen.getByRole('img', { name: 'Acme' }).querySelector('[data-slot="wordmark-hint"]')).toBeNull();
  });
});

describe('Wordmark: a label that does not contain its lines', () => {
  it('warns once in development, naming the lines it misses', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Wordmark href="/" label="Acme, home">
        {lines}
      </Wordmark>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]![0]);
    expect(message).toContain('"アクメ", "أكمي"');
    expect(message).toContain('2.5.3');
  });

  it('names a single missing line in the singular', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Wordmark href="/" label="Acme, home">
        <Wordmark.Line lang="en">ACME</Wordmark.Line>
        <Wordmark.Line lang="en">Field notes</Wordmark.Line>
      </Wordmark>,
    );
    expect(String(warn.mock.calls[0]![0])).toContain('visible line "Field notes"');
  });

  it('does not warn when the label contains every line, ignoring case and spacing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Wordmark href="/" label="acme   FIELD notes, home">
        <Wordmark.Line lang="en">ACME</Wordmark.Line>
        <Wordmark.Line lang="en">Field notes</Wordmark.Line>
      </Wordmark>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn without a label, for an image of text, or for a line it cannot read as text', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Wordmark href="/">{lines}</Wordmark>);
    render(<Wordmark label="Hello">{lines}</Wordmark>);
    render(
      <Wordmark href="/" label="Acme, home">
        <Wordmark.Line lang="en">
          <b>ACME</b>
        </Wordmark.Line>
        <Wordmark.Line lang="en"> </Wordmark.Line>
        <p>not a line</p>
      </Wordmark>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('is silent in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Wordmark href="/" label="Acme, home">
        {lines}
      </Wordmark>,
    );
    vi.unstubAllEnvs();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('Wordmark: the types', () => {
  it('needs a label without an href, and takes a hint only with one', () => {
    type Props = React.ComponentProps<typeof Wordmark>;
    expectTypeOf<{ label: string; children: React.ReactNode }>().toMatchTypeOf<Props>();
    expectTypeOf<{ href: string; children: React.ReactNode }>().toMatchTypeOf<Props>();
    expectTypeOf<{ href: string; hint: string; children: React.ReactNode }>().toMatchTypeOf<Props>();
    expectTypeOf<{ hint: string; label: string; children: React.ReactNode }>().not.toMatchTypeOf<Props>();
    expectTypeOf<{ children: React.ReactNode }>().not.toMatchTypeOf<Props>();
  });
});
