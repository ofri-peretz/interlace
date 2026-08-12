import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CONCEPTS_SOURCE, conceptBySlug, listConcepts } from '@/lib/concepts';

/**
 * `/concepts` is DERIVED from the Storybook MDX, not forked from it. That is
 * only true while the projection stays faithful, so this suite checks the
 * things a derivation can silently get wrong: dropped pages, un-decoded JSX
 * entities, Storybook-relative links that 404 off-origin, and empty blocks
 * from a parser that fell through.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '../../../..');

const pages = listConcepts();

describe('concepts', () => {
  it('derives every MDX page', () => {
    expect(pages).toHaveLength(7);
    expect(pages.map((p) => p.slug).sort()).toEqual([
      'accessibility',
      'color-theming',
      'layout',
      'loading-motion',
      'overview',
      'responsiveness',
      'versioning',
    ]);
  });

  it('opens with the overview', () => {
    expect(pages[0].slug).toBe('overview');
  });

  it('points at MDX files that exist', async () => {
    expect(CONCEPTS_SOURCE).toContain('apps/storybook');
    for (const page of pages) {
      await expect(access(join(REPO_ROOT, page.file))).resolves.toBeUndefined();
    }
  });

  it('carries real content, not a parser fall-through', () => {
    for (const page of pages) {
      expect(page.blocks.length, `${page.slug} is empty`).toBeGreaterThan(15);
      expect(page.lead.length, `${page.slug} has no lead`).toBeGreaterThan(40);
      expect(page.headings.length).toBeGreaterThan(2);
      for (const block of page.blocks) {
        if (block.type === 'paragraph' || block.type === 'quote') {
          expect(block.text.trim()).not.toBe('');
          // A blockquote parsed as a paragraph keeps its literal marker.
          expect(block.text.startsWith('>')).toBe(false);
        }
        if (block.type === 'code') expect(block.code.trim()).not.toBe('');
        if (block.type === 'table') {
          // Single-column tables are legal and used (Accessibility's keyboard
          // step list is one) — what must never happen is a headerless or
          // bodyless table from a parser that half-matched.
          expect(block.head.length).toBeGreaterThan(0);
          expect(block.rows.length).toBeGreaterThan(0);
          for (const row of block.rows) {
            expect(row.length).toBe(block.head.length);
          }
        }
      }
    }
  });

  it('decodes the JSX entities MDX authors write', () => {
    const all = JSON.stringify(pages);
    expect(all).not.toContain('&amp;');
    expect(all).not.toContain('&lt;');
    expect(conceptBySlug('color-theming')?.title).toBe('Color & theming');
  });

  it('rewrites Storybook-relative links so they resolve off-origin', () => {
    // `(?path=/docs/…)` is relative INSIDE Storybook and a 404 anywhere else.
    for (const page of pages) {
      for (const block of page.blocks) {
        const text =
          block.type === 'paragraph' ||
          block.type === 'heading' ||
          block.type === 'quote'
            ? block.text
            : block.type === 'list'
              ? block.items.map((i) => i.text).join(' ')
              : '';
        expect(text, `${page.slug} still carries a Storybook-relative link`).not.toContain(
          '(?path=',
        );
      }
    }
  });

  it('links every internal concept reference to a page that exists', () => {
    const slugs = new Set(pages.map((p) => p.slug));
    for (const page of pages) {
      for (const [, href] of JSON.stringify(page.blocks).matchAll(
        /\]\((\/concepts\/[a-z0-9-]+)\)/g,
      )) {
        expect(slugs, `${page.slug} links to ${href}`).toContain(
          href.replace('/concepts/', ''),
        );
      }
    }
  });

  it('keeps the live demos in Storybook rather than forking them', () => {
    const demos = pages.flatMap((p) =>
      p.blocks.filter((b) => b.type === 'demo'),
    );
    expect(demos.length).toBeGreaterThan(0);
    for (const demo of demos) {
      if (demo.type !== 'demo') continue;
      expect(demo.storybookId).toMatch(/^concepts(-[a-z0-9-]+)?--docs$/);
    }
  });
});

describe('concept MDX source', () => {
  it('is the only place the prose is authored', async () => {
    // The registry must not grow a second copy: if this ever fails, someone
    // pasted the doctrine into a page instead of extending the generator.
    const page = conceptBySlug('responsiveness');
    const firstParagraph = page?.blocks.find((b) => b.type === 'paragraph');
    expect(firstParagraph).toBeTruthy();
    const mdx = await readFile(join(REPO_ROOT, page!.file), 'utf8');
    if (firstParagraph?.type === 'paragraph') {
      const opening = firstParagraph.text.split(' ').slice(0, 6).join(' ');
      expect(mdx).toContain(opening);
    }
  });
});
